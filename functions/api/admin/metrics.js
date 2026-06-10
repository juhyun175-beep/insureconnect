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
    one(`SELECT COUNT(*) n FROM ic_traffic_hits`),
    one(`SELECT COUNT(*) n FROM ic_traffic_hits WHERE date = ?`, todayKst),
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
  try { const rs = await env.DB.prepare(`SELECT date, COUNT(*) AS visits FROM ic_traffic_hits WHERE date >= ? GROUP BY date ORDER BY date ASC`).bind(startDay).all(); (rs.results || []).forEach(r => { visitMap[r.date] = r.visits; }); } catch (_) {}
  try { const rs = await env.DB.prepare(`SELECT substr(created_at,1,10) d, COUNT(*) n FROM ic_members WHERE created_at >= ? GROUP BY d`).bind(startDay).all(); (rs.results || []).forEach(r => { signupMap[r.d] = r.n; }); } catch (_) {}
  const visit_series = days.map(d => ({ date: d, v: visitMap[d] || 0 }));
  const signup_series = days.map(d => ({ date: d, v: signupMap[d] || 0 }));
  // v2.16.8: 삼따AI 일별 사용 (ic_ai_usage)
  const aiMap = {};
  try { const rs = await env.DB.prepare(`SELECT date, SUM(count) n FROM ic_ai_usage WHERE date >= ? GROUP BY date`).bind(startDay).all(); (rs.results || []).forEach(r => { aiMap[r.date] = r.n; }); } catch (_) {}
  const ai_usage_series = days.map(d => ({ date: d, v: aiMap[d] || 0 }));

  // v2.30.0: 북극성 지표 = 이번 달(1일~오늘) 기준 + 지난 달 동기간(MTD) 대비 증감(MoM). (이전: 최근 14일 합)
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  const nowKst = new Date(now + 9 * 3600000);
  const _y = nowKst.getUTCFullYear(), _mo = nowKst.getUTCMonth(), _dd = nowKst.getUTCDate();
  const _pad = (n) => String(n).padStart(2, '0');
  const _ymd = (yy, mm, dd) => `${yy}-${_pad(mm + 1)}-${_pad(dd)}`;
  const curMonStart = _ymd(_y, _mo, 1), curDay = _ymd(_y, _mo, _dd);
  const _lmDate = new Date(Date.UTC(_y, _mo - 1, 1));
  const lastMonStart = _ymd(_lmDate.getUTCFullYear(), _lmDate.getUTCMonth(), 1);
  const _lastMonDays = new Date(Date.UTC(_y, _mo, 0)).getUTCDate();
  const lastMonSameDay = _ymd(_lmDate.getUTCFullYear(), _lmDate.getUTCMonth(), Math.min(_dd, _lastMonDays));

  // 가입 전환 (이번 달 / 지난 달 동기간)
  const mVisits  = await one(`SELECT COUNT(*) n FROM ic_traffic_hits WHERE date BETWEEN ? AND ?`, curMonStart, curDay);
  const mSignups = await one(`SELECT COUNT(*) n FROM ic_members WHERE substr(created_at,1,10) BETWEEN ? AND ?`, curMonStart, curDay);
  const lVisits  = await one(`SELECT COUNT(*) n FROM ic_traffic_hits WHERE date BETWEEN ? AND ?`, lastMonStart, lastMonSameDay);
  const lSignups = await one(`SELECT COUNT(*) n FROM ic_members WHERE substr(created_at,1,10) BETWEEN ? AND ?`, lastMonStart, lastMonSameDay);
  const signup_delta = (mVisits && lVisits) ? Math.round((pct(mSignups, mVisits) - pct(lSignups, lVisits)) * 10) / 10 : null;

  // 견적 전환 (이번 달 / 지난 달 동기간) — 렌트카+통신 클릭→신청
  const qSel = (st, en) => env.DB.prepare(
    `SELECT SUM(CASE WHEN company_name IN ('렌트카 견적 시작','통신 견적 시작') THEN clicks ELSE 0 END) AS c,
            SUM(CASE WHEN company_name IN ('렌트카 견적 신청 완료','통신 견적 신청 완료') THEN clicks ELSE 0 END) AS s
     FROM ic_link_clicks_daily WHERE date BETWEEN ? AND ?`
  ).bind(st, en).first().catch(() => null);
  const qm = await qSel(curMonStart, curDay), ql = await qSel(lastMonStart, lastMonSameDay);
  const qmc = +qm?.c || 0, qms = +qm?.s || 0, qlc = +ql?.c || 0, qls = +ql?.s || 0;
  const quote_delta = (qmc && qlc) ? Math.round((pct(qms, qmc) - pct(qls, qlc)) * 10) / 10 : null;

  // 누적 지표 (추천 가입률·AI 재방문율) — 전체 누적, 월 비교 비적용
  const referrals_total = await one(`SELECT COUNT(*) n FROM ic_referrals`);
  const ai_users = await one(`SELECT COUNT(DISTINCT ip_hash) n FROM ic_ai_usage`);
  const ai_repeat = await one(`SELECT COUNT(*) n FROM (SELECT ip_hash FROM ic_ai_usage GROUP BY ip_hash HAVING COUNT(DISTINCT date) > 1)`);

  const monthLabel = `${_mo + 1}월`;
  const northstar = {
    signup_conv:   { rate: pct(mSignups, mVisits), signups: mSignups, visits: mVisits, window: monthLabel, delta: signup_delta },
    referral_rate: { rate: pct(referrals_total, members_total), referred: referrals_total, total: members_total, window: '누적', delta: null },
    quote_conv:    { rate: pct(qms, qmc), submits: qms, clicks: qmc, window: monthLabel, delta: quote_delta },
    ai_revisit:    { rate: pct(ai_repeat, ai_users), repeat: ai_repeat, users: ai_users, window: '누적', delta: null },
  };

  return json({
    members_total, members_today, mau, wau, returning, returning_rate,
    alert_optin, alert_rate, push_subs, posts, comments, posts_7d, comments_7d,
    visits_total, visits_today, roles, visit_series, signup_series,
    ai_usage_total, ai_usage_today, ai_usage_series, northstar,
  });
});
