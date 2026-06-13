/**
 * v2.11.0: 공고 상단노출(포인트 사용처) — POST /api/postings/feature
 *   본인이 등록(submitter_id)한 「승인된」 채용/강의 공고를 포인트로 N일간 목록 최상단 노출
 *   { type: 'recruit'|'lecture', id }  →  COST 포인트 차감 + featured_until 연장
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const COST = 50;   // 포인트
const DAYS = 7;    // 노출 일수
// 화이트리스트(사용자 입력을 테이블명에 직접 쓰지 않음 — 인젝션 차단)
const TABLES = { recruit: 'ic_recruitments', lecture: 'ic_lectures', meetup: 'ic_meetings' };

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);

  const body = await request.json().catch(() => ({}));
  const table = TABLES[body.type];
  if (!table) return error('잘못된 공고 유형입니다.');
  const id = parseInt(body.id, 10);
  if (!Number.isFinite(id)) return error('잘못된 공고입니다.');

  // 소유·상태 확인 (table 은 화이트리스트 값)
  const post = await env.DB.prepare(
    `SELECT id, submitter_id, status, featured_until FROM ${table} WHERE id = ?`
  ).bind(id).first();
  if (!post) return error('공고를 찾을 수 없습니다.', 404);
  if (post.submitter_id == null || post.submitter_id !== user.id) {
    return json({ error: '본인이 등록한 공고만 상단노출할 수 있습니다.', code: 'not_owner' }, 403);
  }
  if (post.status !== 'approved') {
    return json({ error: '승인(게시)된 공고만 상단노출할 수 있습니다.', code: 'not_approved' }, 400);
  }

  // v2.13.9: 상단노출권(크레딧) 우선 사용 — 없으면 포인트(COST)
  const me = await env.DB.prepare(`SELECT points, feature_credit FROM ic_members WHERE id = ?`).bind(user.id).first();
  const points = me?.points || 0;
  const credit = me?.feature_credit || 0;
  const useCredit = credit > 0;
  if (!useCredit && points < COST) {
    return json({ error: '포인트가 부족합니다.', code: 'insufficient_points', need: COST, points, feature_credit: credit }, 402);
  }

  // 차감(크레딧 1장 우선, 없으면 포인트 COST) + 노출기간 연장(이미 노출중이면 그 만료시점에서 +DAYS, 아니면 now+DAYS)
  if (useCredit) {
    await env.DB.prepare(`UPDATE ic_members SET feature_credit = feature_credit - 1 WHERE id = ?`).bind(user.id).run();
  } else {
    await env.DB.prepare(`UPDATE ic_members SET points = points - ? WHERE id = ?`).bind(COST, user.id).run();
  }
  await env.DB.prepare(
    `UPDATE ${table}
        SET featured_until = datetime(
              CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now')
                   THEN featured_until ELSE datetime('now') END,
              '+' || ? || ' days')
      WHERE id = ?`
  ).bind(DAYS, id).run();
  try {
    await env.DB.prepare(
      `INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, ?, ?)`
    ).bind(user.id, useCredit ? 0 : -COST, useCredit ? 'feature_credit_use' : 'feature_posting').run();
  } catch (_) {}

  const upd = await env.DB.prepare(`SELECT featured_until FROM ${table} WHERE id = ?`).bind(id).first();
  return json({ ok: true, featured_until: upd?.featured_until || null, days: DAYS, used_credit: useCredit, points_used: useCredit ? 0 : COST, remaining: useCredit ? points : points - COST, feature_credit: useCredit ? credit - 1 : credit });
});
