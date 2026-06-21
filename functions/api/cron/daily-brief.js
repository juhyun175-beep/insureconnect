/**
 * v2.44.0: 일간 모닝 브리핑 (리텐션 #4+#5) — POST /api/cron/daily-brief
 *   회원별 개인화: ⏰ 내 만기·갱신 임박 고객(미니 CRM ic_client_notes) + 📢 플랫폼 새 소식
 *   → 카톡 메모 + 웹푸시. "매일 여는 트리거 + 만기 알림으로 갱신 매출 사수".
 *
 *   ── 발송 게이트(중요): env.DAILY_BRIEF_ENABLED === '1' 일 때만 실제 발송.
 *      미설정(기본)이면 DRY — 집계/미리보기만 하고 절대 발송 안 함(안전).
 *   ── 인증: 관리자(x-admin-secret) 또는 외부 스케줄러용 CRON_SECRET(헤더 x-cron-secret).
 *   ── 빈도 가드: 같은 날 이미 send 했으면 생략(하루 1회 보장).
 *   ── 개인화: 보낼 내용(만기 임박 or 새 소식)이 없는 회원에겐 발송 생략(스팸 방지).
 *   ── 수신자: 카톡=alert_optin=1 & refresh_token / 푸시=active 구독(member_id 매핑). revoked/만료 자동 비활성.
 *
 *   ※ Cloudflare Pages엔 네이티브 cron 없음 → 외부 트리거가 매일 1회 POST.
 *      예) curl -X POST -H "x-cron-secret: $CRON_SECRET" https://insureconnect.co.kr/api/cron/daily-brief
 *      활성화: (1) wrangler pages secret put CRON_SECRET (2) 매일 cron 등록(Worker/GitHub Actions/cron-job.org)
 *             (3) DRY로 미리보기 검증 (4) DAILY_BRIEF_ENABLED=1 설정 시 실제 발송.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin } from '../../_lib/admin.js';
import { sendMemoToMember } from '../../_lib/kakao-msg.js';
import { sendWebPush } from '../../_lib/webpush.js';
import { SITE } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

function authed(request, env) {
  if (verifyAdmin(request, env)) return true;
  const s = env.CRON_SECRET;
  return !!(s && request.headers.get('x-cron-secret') === s);
}

async function ensureClientTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_client_notes (
       id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, name TEXT NOT NULL,
       phone TEXT, insurer TEXT, product TEXT, premium INTEGER, renew_date TEXT, memo TEXT,
       created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`
  ).run().catch(() => {});
}

async function platformNews(env) {
  const first = (sql) => env.DB.prepare(sql).first().catch(() => null);
  const SINCE = "datetime('now','-1 day')";
  const recruitsN = (await first(`SELECT COUNT(*) AS n FROM ic_recruitments WHERE status='approved' AND created_at >= ${SINCE}`))?.n || 0;
  const lecturesN = (await first(`SELECT COUNT(*) AS n FROM ic_lectures WHERE status='approved' AND created_at >= ${SINCE}`))?.n || 0;
  const newsN = (await first(`SELECT COUNT(DISTINCT set_id) AS n FROM ic_card_news WHERE created_at >= ${SINCE}`))?.n || 0;
  const bits = [];
  if (recruitsN) bits.push(`📢 새 채용 ${recruitsN}`);
  if (lecturesN) bits.push(`🎓 새 강의 ${lecturesN}`);
  if (newsN) bits.push(`🗞 새 카드뉴스 ${newsN}`);
  return bits.join(' · ');
}

/** 회원별 만기·갱신 임박 고객(지난 3일 ~ 향후 7일) */
async function memberRenewals(env, memberId) {
  const rs = await env.DB.prepare(
    `SELECT name, renew_date FROM ic_client_notes
     WHERE member_id = ? AND renew_date IS NOT NULL
       AND date(renew_date) BETWEEN date('now','-3 day') AND date('now','+7 day')
     ORDER BY renew_date ASC LIMIT 5`
  ).bind(memberId).all().catch(() => ({ results: [] }));
  return rs.results || [];
}

function briefLines(renewals, news) {
  const lines = [];
  if (renewals.length) {
    const names = renewals.map((r) => r.name).filter(Boolean).slice(0, 3).join(', ');
    lines.push(`⏰ 만기·갱신 임박 고객 ${renewals.length}명${names ? `: ${names}` : ''}`);
  }
  if (news) lines.push(news);
  return lines;
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!authed(request, env)) return error('unauthorized', 401);
  await ensureClientTable(env);

  const SEND = env.DAILY_BRIEF_ENABLED === '1';
  const news = await platformNews(env);

  const kakaoMembers = (await env.DB.prepare(
    `SELECT id, kakao_access_token, kakao_refresh_token, kakao_token_expires
     FROM ic_members WHERE alert_optin = 1 AND kakao_refresh_token IS NOT NULL`
  ).all().catch(() => ({ results: [] }))).results || [];
  const pushSubs = (await env.DB.prepare(
    `SELECT id, member_id, endpoint, p256dh, auth FROM ic_push_subscriptions WHERE active = 1`
  ).all().catch(() => ({ results: [] }))).results || [];

  // ── DRY (기본): 미발송, 미리보기만 ──
  if (!SEND) {
    const dueN = (await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM ic_client_notes WHERE renew_date IS NOT NULL
         AND date(renew_date) BETWEEN date('now','-3 day') AND date('now','+7 day')`
    ).first().catch(() => null))?.n || 0;
    return json({
      ok: true, dry: true,
      message: 'DAILY_BRIEF_ENABLED != 1 → 미발송(dry). 집계/미리보기만 반환.',
      news, upcoming_renewals_total: dueN,
      recipients: { kakao: kakaoMembers.length, push: pushSubs.length },
    });
  }

  // ── SEND ── 같은 날 중복 발송 방지
  const last = await env.DB.prepare(
    `SELECT run_at FROM ic_digest_runs WHERE mode='send' AND note='daily-brief' AND date(run_at)=date('now') ORDER BY run_at DESC LIMIT 1`
  ).first().catch(() => null);
  if (last) return json({ ok: true, skipped: true, reason: 'already_sent_today', last_send: last.run_at });

  // 카카오 메모 — 회원별 개인화
  let kakaoSent = 0, kakaoFail = 0;
  if (env.KAKAO_REST_KEY) {
    for (const m of kakaoMembers) {
      const ren = await memberRenewals(env, m.id);
      const lines = briefLines(ren, news);
      if (!lines.length) continue;
      const r = await sendMemoToMember(env, m, {
        title: '📬 오늘의 인슈어커넥트',
        description: lines.join('\n').slice(0, 240),
        url: SITE + (ren.length ? '/?go=clients' : '/'),
        image: '',
      });
      if (r.ok) kakaoSent++;
      else { kakaoFail++; if (r.revoked) await env.DB.prepare(`UPDATE ic_members SET alert_optin=0 WHERE id=?`).bind(m.id).run().catch(() => {}); }
    }
  }

  // 웹푸시 — 구독별(member_id) 개인화
  let pushSent = 0;
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:admin@insureconnect.co.kr' };
  if (vapid.publicKey && vapid.privateKey) {
    for (const s of pushSubs) {
      const ren = s.member_id ? await memberRenewals(env, s.member_id) : [];
      const lines = briefLines(ren, news);
      if (!lines.length) continue;
      try {
        const payload = { title: '📬 오늘의 인슈어커넥트', body: lines.join('\n').slice(0, 200), url: SITE + (ren.length ? '/?go=clients' : '/'), tag: 'ic-daily-brief', type: 'brief', icon: '/logo.png', badge: '/logo.png' };
        const r = await sendWebPush({ subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid });
        if (r.removed) await env.DB.prepare(`UPDATE ic_push_subscriptions SET active=0 WHERE id=?`).bind(s.id).run().catch(() => {});
        else if (r.ok) { pushSent++; await env.DB.prepare(`UPDATE ic_push_subscriptions SET last_sent_at=? WHERE id=?`).bind(new Date().toISOString(), s.id).run().catch(() => {}); }
      } catch (_) {}
    }
  }

  await env.DB.prepare(
    `INSERT INTO ic_digest_runs (mode, recipients_kakao, recipients_push, kakao_sent, push_sent, note) VALUES ('send', ?, ?, ?, ?, 'daily-brief')`
  ).bind(kakaoMembers.length, pushSubs.length, kakaoSent, pushSent).run().catch(() => {});

  return json({
    ok: true, sent: true, news,
    kakao: { recipients: kakaoMembers.length, sent: kakaoSent, failed: kakaoFail },
    push: { recipients: pushSubs.length, sent: pushSent },
  });
});
