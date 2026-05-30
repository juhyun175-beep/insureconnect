/**
 * v2.4.0: 운영 지표 — GET /api/admin/metrics (admin)
 *   회원수·등급분포·MAU/WAU·재방문·게시판·방문자
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const now = Date.now();
  const todayKst = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const d30 = new Date(now - 30 * 86400000).toISOString();
  const d7 = new Date(now - 7 * 86400000).toISOString();

  const one = async (sql, ...binds) => {
    try { const r = await env.DB.prepare(sql).bind(...binds).first(); return r?.n ?? 0; } catch (_) { return 0; }
  };

  const [members_total, members_today, mau, wau, returning, posts, comments, visits_total, visits_today] = await Promise.all([
    one(`SELECT COUNT(*) n FROM ic_members`),
    one(`SELECT COUNT(*) n FROM ic_members WHERE created_at >= ?`, todayKst),
    one(`SELECT COUNT(*) n FROM ic_members WHERE last_login >= ?`, d30),
    one(`SELECT COUNT(*) n FROM ic_members WHERE last_login >= ?`, d7),
    one(`SELECT COUNT(*) n FROM (SELECT user_id FROM ic_member_sessions GROUP BY user_id HAVING COUNT(*) > 1)`),
    one(`SELECT COUNT(*) n FROM ic_board_posts WHERE deleted = 0`),
    one(`SELECT COUNT(*) n FROM ic_board_comments WHERE deleted = 0`),
    one(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily`),
    one(`SELECT COALESCE(visits,0) n FROM ic_visits_daily WHERE date = ?`, todayKst),
  ]);

  let roles = {};
  try {
    const rs = await env.DB.prepare(`SELECT role, COUNT(*) AS n FROM ic_members GROUP BY role`).all();
    (rs.results || []).forEach(r => { roles[r.role] = r.n; });
  } catch (_) {}

  const returning_rate = members_total ? Math.round(returning / members_total * 100) : 0;

  return json({
    members_total, members_today, mau, wau, returning, returning_rate,
    posts, comments, visits_total, visits_today, roles,
  });
});
