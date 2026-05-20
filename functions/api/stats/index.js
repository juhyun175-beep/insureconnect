/**
 * 메인 통계 — KPI + 7일 시계열
 *   loadDashboard()가 호출
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx);

function kstDateKey(d = new Date()) {
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ env }) => handle(async () => {
  const today = kstDateKey();
  // 이번 주 (월~일) KST
  const nowKst = new Date(Date.now() + 9*3600*1000);
  const day = nowKst.getUTCDay() || 7;
  const monday = new Date(nowKst); monday.setUTCDate(nowKst.getUTCDate() - day + 1);
  const mondayStr = monday.toISOString().slice(0, 10);

  // 7일 날짜 배열 (오늘부터 거꾸로 7일, 오래된 순)
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 9*3600*1000 - i*86400*1000);
    last7.push(d.toISOString().slice(0, 10));
  }

  const [todayV, weekV, totalV, todayC, totalC, visitsRows, clicksRows] = await Promise.all([
    env.DB.prepare(`SELECT COALESCE(visits, 0) AS n FROM ic_visits_daily WHERE date = ?`).bind(today).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(visits), 0) AS n FROM ic_visits_daily WHERE date >= ?`).bind(mondayStr).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(visits), 0) AS n FROM ic_visits_daily`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(clicks), 0) AS n FROM ic_card_clicks_daily WHERE date = ?`).bind(today).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(clicks), 0) AS n FROM ic_card_clicks_daily`).first(),
    env.DB.prepare(`SELECT date, visits FROM ic_visits_daily WHERE date >= ? ORDER BY date ASC`).bind(last7[0]).all(),
    env.DB.prepare(`SELECT date, SUM(clicks) AS clicks FROM ic_card_clicks_daily WHERE date >= ? GROUP BY date ORDER BY date ASC`).bind(last7[0]).all(),
  ]);

  // 7일 채워주기 (없는 날짜는 0)
  const fill = (rows, key) => {
    const map = new Map();
    (rows.results || []).forEach(r => map.set(r.date, r[key] || 0));
    return last7.map(d => ({ date: d, [key]: map.get(d) || 0 }));
  };

  return json({
    today_visits: todayV?.n || 0,
    week_visits:  weekV?.n || 0,
    total_visits: totalV?.n || 0,
    today_clicks: todayC?.n || 0,
    total_clicks: totalC?.n || 0,
    week_start_date: mondayStr,
    week_end_date: today,
    daily_visits_7d: fill(visitsRows, 'visits'),
    daily_clicks_7d: fill(clicksRows, 'clicks'),
  });
});
