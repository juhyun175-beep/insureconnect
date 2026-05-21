/**
 * 체류 시간 통계 — ic_sessions_daily 집계
 * admin이 기대하는 필드명: today_count, today_avg, total_avg, distribution[{label,count}], recent[]
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

  const todayCount = todayRow?.sessions_count || 0;
  const todayAvg = todayCount ? Math.round((todayRow.total_duration_sec || 0) / todayCount) : 0;
  const totalCount = totalRow?.sc || 0;
  const totalAvg = totalCount ? Math.round((totalRow.td || 0) / totalCount) : 0;

  // 카운터 방식이라 개별 세션 분포는 추적 안 됨 → 평균 기준 자동 분류
  const dist = [
    { label: '30초 미만', count: 0 },
    { label: '30초~2분', count: 0 },
    { label: '2분~5분',  count: 0 },
    { label: '5분+',     count: 0 },
  ];
  if (todayAvg < 30) dist[0].count = todayCount;
  else if (todayAvg < 120) dist[1].count = todayCount;
  else if (todayAvg < 300) dist[2].count = todayCount;
  else dist[3].count = todayCount;

  return json({
    // admin 기존 필드명 호환
    today_count:     todayCount,
    today_avg:       todayAvg,
    total_avg:       totalAvg,
    distribution:    dist,
    recent:          [],
    // 신규 필드명
    today_sessions:  todayCount,
    today_avg_sec:   todayAvg,
    total_sessions:  totalCount,
    total_avg_sec:   totalAvg,
    recent_sessions: [],
    last_7_days: (last7.results || []).map(r => ({
      date: r.date,
      sessions: r.sessions_count,
      avg_sec: r.sessions_count ? Math.round(r.total_duration_sec / r.sessions_count) : 0
    }))
  });
});
