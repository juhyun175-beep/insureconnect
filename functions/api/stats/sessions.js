/**
 * 체류 시간 통계 — ic_sessions_daily 집계
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx);

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ env }) => handle(async () => {
  const today = kstDateKey();
  const [todayRow, totalRow, last7] = await Promise.all([
    env.DB.prepare(`SELECT sessions_count, total_duration_sec FROM ic_sessions_daily WHERE date = ?`).bind(today).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(sessions_count),0) AS sc, COALESCE(SUM(total_duration_sec),0) AS td FROM ic_sessions_daily`).first(),
    env.DB.prepare(`SELECT date, sessions_count, total_duration_sec FROM ic_sessions_daily ORDER BY date DESC LIMIT 7`).all(),
  ]);

  const todaySessions = todayRow?.sessions_count || 0;
  const todayAvg = todaySessions ? Math.round((todayRow.total_duration_sec || 0) / todaySessions) : 0;
  const totalSessions = totalRow?.sc || 0;
  const totalAvg = totalSessions ? Math.round((totalRow.td || 0) / totalSessions) : 0;

  // 분포: 7일 데이터 → 평균 체류 분포
  const distribution = (last7.results || []).map(r => ({
    date: r.date,
    sessions: r.sessions_count,
    avg_sec: r.sessions_count ? Math.round(r.total_duration_sec / r.sessions_count) : 0
  }));

  return json({
    today_sessions: todaySessions,
    today_avg_sec:  todayAvg,
    total_sessions: totalSessions,
    total_avg_sec:  totalAvg,
    avg_duration:   todayAvg,
    distribution,
    recent_sessions: []
  });
});
