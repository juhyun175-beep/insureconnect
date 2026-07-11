/**
 * v2.123.0: 카카오톡 발송 대기열 — '전 회원 일괄발송'의 서브리퀘스트 한도/응답지연 해소.
 *   문제: 승인/방송 요청 안에서 N명 전원에게 동기 발송 → Cloudflare 요청당 fetch 한도
 *         (무료 50 / 유료 1000)에 걸려 회원이 늘면 중간부터 조용히 실패 + 응답 수십 초.
 *   해법: ic_kakao_queue 에 1문(INSERT..SELECT)으로 전원 등록 → 청크(기본 20명)로 드레인.
 *   드레인 트리거(모두 멱등·중복 안전):
 *     ① cron 워커(scripts/cron-worker) 5분 주기 → POST /api/cron/kakao-queue
 *     ② 등록 직후 인라인 1청크(소규모 발송은 즉시 완료 체감)
 *     ③ 관리자 대시보드 10초 폴링이 POST 킥(대시보드 열려 있으면 분당 ~120명)
 *   중복발송 방지: 행 단위 optimistic claim(pending→sending, changes 확인) — 동시 드레인 안전.
 *   실패 재시도: revoked 아닌 실패는 attempts<3 까지 pending 유지, 3회째 failed 확정.
 */
import { sendMemoToMember } from './kakao-msg.js';

const CLAIM_STALE_MIN = 10; // sending 상태로 이만큼 지나면 크래시로 보고 pending 복귀

export async function ensureKakaoQueue(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_kakao_queue (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       member_id INTEGER NOT NULL,
       payload_json TEXT NOT NULL,
       batch_key TEXT,
       status TEXT NOT NULL DEFAULT 'pending',
       attempts INTEGER NOT NULL DEFAULT 0,
       last_error TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       claimed_at TEXT,
       sent_at TEXT
     )`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_kakao_queue_status ON ic_kakao_queue(status, id)`).run().catch(() => {});
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_kakao_queue_batch ON ic_kakao_queue(batch_key)`).run().catch(() => {});
}

/** 수신동의 회원 수 (발송 대상 규모 사전 확인용) */
export async function optinCount(env) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_members WHERE alert_optin = 1 AND kakao_refresh_token IS NOT NULL`
  ).first().catch(() => null);
  return row?.n || 0;
}

/** 수신동의 전 회원을 대기열에 등록(단일 INSERT..SELECT — fetch 0회). batch_key 중복이면 skip. */
export async function enqueueBroadcast(env, payload, batchKey) {
  await ensureKakaoQueue(env);
  const dup = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_kakao_queue WHERE batch_key = ?`)
    .bind(batchKey).first().catch(() => null);
  if ((dup?.n || 0) > 0) return { queued: 0, duplicate: true };
  const r = await env.DB.prepare(
    `INSERT INTO ic_kakao_queue (member_id, payload_json, batch_key)
     SELECT id, ?, ? FROM ic_members WHERE alert_optin = 1 AND kakao_refresh_token IS NOT NULL`
  ).bind(JSON.stringify(payload), batchKey).run();
  return { queued: r?.meta?.changes ?? 0, duplicate: false };
}

/** 대기열 드레인 — 최대 max건 발송. 동시 실행 안전(행 claim). */
export async function drainKakaoQueue(env, max = 20) {
  await ensureKakaoQueue(env);
  // 크래시로 sending에 고인 행 복구
  await env.DB.prepare(
    `UPDATE ic_kakao_queue SET status = 'pending'
      WHERE status = 'sending' AND claimed_at < datetime('now', '-${CLAIM_STALE_MIN} minutes')`
  ).run().catch(() => {});

  const rs = await env.DB.prepare(
    `SELECT q.id AS qid, q.payload_json, q.attempts,
            m.id, m.kakao_access_token, m.kakao_refresh_token, m.kakao_token_expires
       FROM ic_kakao_queue q JOIN ic_members m ON m.id = q.member_id
      WHERE q.status = 'pending' ORDER BY q.id LIMIT ?`
  ).bind(max).all().catch(() => ({ results: [] }));
  const rows = rs.results || [];

  let sent = 0, failed = 0, revoked = 0, skipped = 0;
  for (const r of rows) {
    // optimistic claim — 다른 드레인이 이미 집었으면 skip
    const claim = await env.DB.prepare(
      `UPDATE ic_kakao_queue SET status = 'sending', claimed_at = datetime('now') WHERE id = ? AND status = 'pending'`
    ).bind(r.qid).run().catch(() => null);
    if (!((claim?.meta?.changes || 0) > 0)) { skipped++; continue; }

    let payload = {};
    try { payload = JSON.parse(r.payload_json) || {}; } catch (_) {}
    const res = await sendMemoToMember(env, r, payload);
    if (res.ok) {
      sent++;
      await env.DB.prepare(`UPDATE ic_kakao_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?`).bind(r.qid).run().catch(() => {});
    } else if (res.revoked) {
      revoked++;
      await env.DB.prepare(`UPDATE ic_kakao_queue SET status = 'revoked', last_error = ? WHERE id = ?`).bind(String(res.error || 'revoked').slice(0, 100), r.qid).run().catch(() => {});
      await env.DB.prepare(`UPDATE ic_members SET alert_optin = 0 WHERE id = ?`).bind(r.id).run().catch(() => {});
    } else {
      const attempts = (r.attempts || 0) + 1;
      const final = attempts >= 3;
      if (final) failed++;
      await env.DB.prepare(
        `UPDATE ic_kakao_queue SET status = ?, attempts = ?, last_error = ?, claimed_at = NULL WHERE id = ?`
      ).bind(final ? 'failed' : 'pending', attempts, String(res.error || 'send_fail').slice(0, 100), r.qid).run().catch(() => {});
    }
  }

  const rem = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_kakao_queue WHERE status = 'pending'`).first().catch(() => null);
  return { processed: rows.length, sent, failed, revoked, skipped, remaining: rem?.n || 0 };
}

/** 관리자용 대기열 현황 — 상태별 합계 + 최근 배치별 진행률 */
export async function kakaoQueueStats(env) {
  await ensureKakaoQueue(env);
  const totals = await env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM ic_kakao_queue GROUP BY status`
  ).all().catch(() => ({ results: [] }));
  const batches = await env.DB.prepare(
    `SELECT batch_key,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN status = 'pending' OR status = 'sending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked,
            MAX(created_at) AS created_at
       FROM ic_kakao_queue GROUP BY batch_key ORDER BY MAX(id) DESC LIMIT 12`
  ).all().catch(() => ({ results: [] }));
  const byStatus = {};
  (totals.results || []).forEach((r) => { byStatus[r.status] = r.n; });
  return { by_status: byStatus, batches: batches.results || [] };
}
