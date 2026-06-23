/**
 * v2.21.0: 주간 다이제스트 (성장 7/8) — POST /api/cron/weekly-digest
 *   이번 주 새 채용공고·강의·사례 + 인기글을 요약 → 옵트인 회원에게 카톡 메모 + 웹푸시.
 *
 *   ── 발송 게이트(중요): env.DIGEST_SEND_ENABLED === '1' 일 때만 실제 발송.
 *      미설정(기본)이면 DRY 모드 — 집계·메시지 생성만 하고 절대 발송하지 않음(안전).
 *   ── 인증: 관리자(x-admin-secret) 또는 외부 스케줄러용 CRON_SECRET(헤더 x-cron-secret).
 *   ── 빈도 가드: 직전 'send' 실행이 6일 이내면 실제 발송 생략(주 1회 보장, 중복 방지). dry는 항상 허용.
 *   ── 수신자: 카톡=alert_optin=1 & refresh_token 보유 / 푸시=active 구독. revoked/만료는 자동 비활성.
 *
 *   ※ Cloudflare Pages엔 네이티브 cron이 없음 → 외부 트리거가 주 1회 이 엔드포인트를 POST.
 *      예) Cloudflare Worker(cron) / GitHub Actions / cron-job.org 에서:
 *          curl -X POST -H "x-cron-secret: $CRON_SECRET" https://insureconnect.co.kr/api/cron/weekly-digest
 *      활성화 절차: (1) wrangler pages secret put CRON_SECRET  (2) 외부 cron 등록
 *                   (3) 미리보기로 검증  (4) DIGEST_SEND_ENABLED=1 설정 시 실제 발송 시작.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin } from '../../_lib/admin.js';
import { sendMemoToMember } from '../../_lib/kakao-msg.js';
import { sendWebPush } from '../../_lib/webpush.js';
import { SITE } from '../../_lib/auth.js';
import { BOARD_SEO_WHERE } from '../../_lib/board-seo.js';

export const onRequestOptions = () => corsPreflight();

function authed(request, env) {
  if (verifyAdmin(request, env)) return true;
  const secret = env.CRON_SECRET;
  return !!(secret && request.headers.get('x-cron-secret') === secret);
}

async function buildDigest(env) {
  const first = (sql) => env.DB.prepare(sql).first().catch(() => null);
  const all = (sql) => env.DB.prepare(sql).all().then((r) => r.results || []).catch(() => []);
  const SINCE = "datetime('now','-7 days')";

  const recruitsN = (await first(`SELECT COUNT(*) AS n FROM ic_recruitments WHERE status='approved' AND created_at >= ${SINCE}`))?.n || 0;
  const lecturesN = (await first(`SELECT COUNT(*) AS n FROM ic_lectures WHERE status='approved' AND created_at >= ${SINCE}`))?.n || 0;
  const casesN = (await first(`SELECT COUNT(*) AS n FROM ic_insurance_cases WHERE verify_status='approved' AND created_at >= ${SINCE}`))?.n || 0;
  const recruits = await all(`SELECT title FROM ic_recruitments WHERE status='approved' AND created_at >= ${SINCE} ORDER BY created_at DESC LIMIT 3`);
  const popular = await all(`SELECT title FROM ic_board_posts WHERE deleted=0 AND ${BOARD_SEO_WHERE} ORDER BY view_count DESC LIMIT 3`);

  const head = [];
  if (recruitsN) head.push(`📢 새 채용공고 ${recruitsN}건`);
  if (lecturesN) head.push(`🎓 새 강의 ${lecturesN}건`);
  if (casesN) head.push(`📚 새 사례 ${casesN}건`);

  const lines = [];
  if (head.length) lines.push(head.join(' · '));
  if (recruits.length) lines.push('채용: ' + recruits.map((r) => r.title).filter(Boolean).join(', ').slice(0, 80));
  if (popular.length) lines.push('인기글: ' + popular.map((p) => p.title).filter(Boolean).join(', ').slice(0, 80));
  if (!lines.length) lines.push('이번 주 새 소식과 사례를 확인해 보세요.');

  return {
    title: '📬 이번 주 인슈어커넥트',
    body: lines.join('\n').slice(0, 240),
    url: SITE + '/',
    hasContent: head.length > 0 || popular.length > 0,
    stats: { recruits: recruitsN, lectures: lecturesN, cases: casesN, popular: popular.length },
  };
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!authed(request, env)) return error('unauthorized', 401);

  const SEND = env.DIGEST_SEND_ENABLED === '1';
  const digest = await buildDigest(env);

  const kakaoMembers = (await env.DB.prepare(
    `SELECT id, kakao_access_token, kakao_refresh_token, kakao_token_expires
     FROM ic_members WHERE alert_optin = 1 AND kakao_refresh_token IS NOT NULL`
  ).all().catch(() => ({ results: [] }))).results || [];
  const pushSubs = (await env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM ic_push_subscriptions WHERE active = 1`
  ).all().catch(() => ({ results: [] }))).results || [];

  // ── DRY (기본): 절대 발송하지 않음 — 집계·미리보기만 ──
  if (!SEND) {
    await env.DB.prepare(
      `INSERT INTO ic_digest_runs (mode, recipients_kakao, recipients_push, note) VALUES ('dry', ?, ?, 'dry preview')`
    ).bind(kakaoMembers.length, pushSubs.length).run().catch(() => {});
    return json({
      ok: true, dry: true,
      message: 'DIGEST_SEND_ENABLED != 1 → 미발송(dry). 집계/미리보기만 반환합니다.',
      digest,
      recipients: { kakao: kakaoMembers.length, push: pushSubs.length },
    });
  }

  // ── SEND 모드 ── 빈도 가드: 6일 내 send 실행 있으면 생략(주 1회 보장)
  const last = await env.DB.prepare(
    `SELECT run_at FROM ic_digest_runs WHERE mode='send' AND run_at >= datetime('now','-6 days') ORDER BY run_at DESC LIMIT 1`
  ).first().catch(() => null);
  if (last) return json({ ok: true, skipped: true, reason: 'frequency_guard', last_send: last.run_at });
  if (!digest.hasContent) return json({ ok: true, skipped: true, reason: 'no_content' });

  // 카카오 메모 발송 (opt-in 회원)
  let kakaoSent = 0, kakaoFail = 0;
  if (env.KAKAO_REST_KEY) {
    for (const m of kakaoMembers) {
      const r = await sendMemoToMember(env, m, { title: digest.title, description: digest.body, url: digest.url, image: '' });
      if (r.ok) kakaoSent++;
      else { kakaoFail++; if (r.revoked) await env.DB.prepare(`UPDATE ic_members SET alert_optin=0 WHERE id=?`).bind(m.id).run().catch(() => {}); }
    }
  }

  // 웹푸시 발송 (active 구독)
  let pushSent = 0;
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:admin@insureconnect.co.kr' };
  if (vapid.publicKey && vapid.privateKey) {
    const payload = { title: digest.title, body: digest.body, url: digest.url, tag: 'ic-weekly-digest', type: 'digest', icon: '/logo.png', badge: '/logo.png' };
    for (const s of pushSubs) {
      try {
        const r = await sendWebPush({ subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid });
        if (r.removed) await env.DB.prepare(`UPDATE ic_push_subscriptions SET active=0 WHERE id=?`).bind(s.id).run().catch(() => {});
        else if (r.ok) { pushSent++; await env.DB.prepare(`UPDATE ic_push_subscriptions SET last_sent_at=? WHERE id=?`).bind(new Date().toISOString(), s.id).run().catch(() => {}); }
      } catch (_) {}
    }
  }

  await env.DB.prepare(
    `INSERT INTO ic_digest_runs (mode, recipients_kakao, recipients_push, kakao_sent, push_sent, note) VALUES ('send', ?, ?, ?, ?, 'sent')`
  ).bind(kakaoMembers.length, pushSubs.length, kakaoSent, pushSent).run().catch(() => {});

  return json({
    ok: true, sent: true, digest,
    kakao: { recipients: kakaoMembers.length, sent: kakaoSent, failed: kakaoFail },
    push: { recipients: pushSubs.length, sent: pushSent },
  });
});
