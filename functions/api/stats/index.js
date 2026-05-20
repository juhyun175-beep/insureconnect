/**
 * 통계 요약 — Supabase의 get_ic_stats RPC 대체
 * 일자별 카운터(ic_visits_daily, ic_card_clicks_daily)에서 집계
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx); // POST도 동일 처리

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ env }) => handle(async () => {
  const today = kstDateKey();
  // 이번 주 (월요일~일요일) 계산
  const now = new Date(Date.now() + 9*3600*1000);
  const day = now.getUTCDay() || 7; // 일=0 → 7
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - day + 1);
  const mondayStr = monday.toISOString().slice(0, 10);

  const [todayVisits, weekVisits, totalVisits, todayClicks, totalClicks] = await Promise.all([
    env.DB.prepare(`SELECT COALESCE(visits, 0) AS n FROM ic_visits_daily WHERE date = ?`).bind(today).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(visits), 0) AS n FROM ic_visits_daily WHERE date >= ?`).bind(mondayStr).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(visits), 0) AS n FROM ic_visits_daily`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(clicks), 0) AS n FROM ic_card_clicks_daily WHERE date = ?`).bind(today).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(clicks), 0) AS n FROM ic_card_clicks_daily`).first(),
  ]);

  return json({
    today_visits: todayVisits?.n || 0,
    week_visits:  weekVisits?.n || 0,
    total_visits: totalVisits?.n || 0,
    today_clicks: todayClicks?.n || 0,
    total_clicks: totalClicks?.n || 0,
    week_start_date: mondayStr,
    week_end_date: today,
  });
});
