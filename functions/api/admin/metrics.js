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

  const [members_total, members_today, mau, wau, returning, posts, comments, visits_total, visits_today, alert_optin, push_subs, posts_7d, comments_7d, ai_usage_total, ai_usage_today] = await Promise.all([
    one(`SELECT COUNT(*) n FROM ic_members`),
    one(`SELECT COUNT(*) n FROM ic_members WHERE created_at >= ?`, todayKst),
    one(`SELECT COUNT(*) n FROM ic_members WHERE last_login >= ?`, d30),
    one(`SELECT COUNT(*) n FROM ic_members WHERE last_login >= ?`, d7),
    one(`SELECT COUNT(*) n FROM (SELECT user_id FROM ic_member_sessions GROUP BY user_id HAVING COUNT(*) > 1)`),
    one(`SELECT COUNT(*) n FROM ic_board_posts WHERE deleted = 0`),
    one(`SELECT COUNT(*) n FROM ic_board_comments WHERE deleted = 0`),
    one(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily`),
    one(`SELECT COALESCE(visits,0) n FROM ic_visits_daily WHERE date = ?`, todayKst),
    one(`SELECT COUNT(*) n FROM ic_members WHERE alert_optin = 1`),
    one(`SELECT COUNT(*) n FROM ic_push_subscriptions WHERE active = 1`),
    one(`SELECT COUNT(*) n FROM ic_board_posts WHERE deleted = 0 AND created_at >= ?`, d7),
    one(`SELECT COUNT(*) n FROM ic_board_comments WHERE deleted = 0 AND created_at >= ?`, d7),
    one(`SELECT COALESCE(SUM(count),0) n FROM ic_ai_usage`),
    one(`SELECT COALESCE(SUM(count),0) n FROM ic_ai_usage WHERE date = ?`, todayKst),
  ]);

  let roles = {};
  try {
    const rs = await env.DB.prepare(`SELECT role, COUNT(*) AS n FROM ic_members GROUP BY role`).all();
    (rs.results || []).forEach(r => { roles[r.role] = r.n; });
  } catch (_) {}

  const returning_rate = members_total ? Math.round(returning / members_total * 100) : 0;
  const alert_rate = members_total ? Math.round(alert_optin / members_total * 100) : 0;

  // v2.7.6: 최근 14일 추세 (KST 일자 라벨에 방문·신규가입 매핑)
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(now - i * 86400000 + 9 * 3600000).toISOString().slice(0, 10));
  const startDay = days[0];
  const visitMap = {}, signupMap = {};
  try { const rs = await env.DB.prepare(`SELECT date, visits FROM ic_visits_daily WHERE date >= ? ORDER BY date ASC`).bind(startDay).all(); (rs.results || []).forEach(r => { visitMap[r.date] = r.visits; }); } catch (_) {}
  try { const rs = await env.DB.prepare(`SELECT substr(created_at,1,10) d, COUNT(*) n FROM ic_members WHERE created_at >= ? GROUP BY d`).bind(startDay).all(); (rs.results || []).forEach(r => { signupMap[r.d] = r.n; }); } catch (_) {}
  const visit_series = days.map(d => ({ date: d, v: visitMap[d] || 0 }));
  const signup_series = days.map(d => ({ date: d, v: signupMap[d] || 0 }));
  // v2.16.8: 삼따AI 일별 사용 (ic_ai_usage)
  const aiMap = {};
  try { const rs = await env.DB.prepare(`SELECT date, SUM(count) n FROM ic_ai_usage WHERE date >= ? GROUP BY date`).bind(startDay).all(); (rs.results || []).forEach(r => { aiMap[r.date] = r.n; }); } catch (_) {}
  const ai_usage_series = days.map(d => ({ date: d, v: aiMap[d] || 0 }));

  return json({
    members_total, members_today, mau, wau, returning, returning_rate,
    alert_optin, alert_rate, push_subs, posts, comments, posts_7d, comments_7d,
    visits_total, visits_today, roles, visit_series, signup_series,
    ai_usage_total, ai_usage_today, ai_usage_series,
  });
});
