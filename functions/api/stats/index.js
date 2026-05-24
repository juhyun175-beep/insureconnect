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
  // v2.1.15: 이번 주를 「일요일 시작 ~ 토요일 끝」(국내 달력 관례) 으로 계산
  //   → 일요일에 카운터가 0으로 리셋되어 그 날 방문만 잡힘 (이전: 월요일 시작이라 일요일에 6일치가 누적되어 "이번 주" 수치가 비정상적으로 커보였음)
  const nowKst = new Date(Date.now() + 9*3600*1000);
  const dow = nowKst.getUTCDay();   // 0=일, 1=월 … 6=토
  const weekStart = new Date(nowKst);
  weekStart.setUTCDate(nowKst.getUTCDate() - dow);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  // 토요일(이번 주 마지막) — 표시용
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // 7일 날짜 배열 (오늘부터 거꾸로 7일, 오래된 순) — 차트 X축
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 9*3600*1000 - i*86400*1000);
    last7.push(d.toISOString().slice(0, 10));
  }

  const [todayV, weekV, totalV, todayC, totalC, visitsRows, clicksRows] = await Promise.all([
    env.DB.prepare(`SELECT COALESCE(visits, 0) AS n FROM ic_visits_daily WHERE date = ?`).bind(today).first(),
    // 이번 주 (일요일 ~ 오늘) 합산 — 미래 날짜는 데이터가 없으니 자동 0
    env.DB.prepare(`SELECT COALESCE(SUM(visits), 0) AS n FROM ic_visits_daily WHERE date >= ? AND date <= ?`).bind(weekStartStr, today).first(),
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
    week_start_date: weekStartStr,   // 일요일
    week_end_date:   weekEndStr,     // 토요일 (UI 노출 — 데이터는 오늘까지만 집계)
    today_date:      today,          // 오늘까지 누적이라는 의미를 admin UI 에서 표시할 수 있도록
    daily_visits_7d: fill(visitsRows, 'visits'),
    daily_clicks_7d: fill(clicksRows, 'clicks'),
  });
});
