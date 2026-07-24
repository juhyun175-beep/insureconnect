/**
 * 체류 시간 통계 — ic_sessions_daily 집계
 * admin이 기대하는 필드명: today_count, today_avg, total_avg, distribution[{label,count}], recent[]
 */
import { handle, corsPreflight } from '../../_lib/http.js';
import { edgeCachedJson } from '../../_lib/edge-cache.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx);

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const onRequestGet = async (ctx) => handle(async () => edgeCachedJson(
  ctx,
  'stats-sessions-v2',
  60,
  async () => {
    const { env } = ctx;
    const today = kstDateKey();
    const [summary, last7] = await Promise.all([
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(sessions_count), 0) AS total_sessions,
          COALESCE(SUM(total_duration_sec), 0) AS total_duration_sec,
          COALESCE(SUM(CASE WHEN date = ? THEN sessions_count ELSE 0 END), 0) AS today_sessions,
          COALESCE(SUM(CASE WHEN date = ? THEN total_duration_sec ELSE 0 END), 0) AS today_duration_sec
        FROM ic_sessions_daily
      `).bind(today, today).first(),
      env.DB.prepare(`
        SELECT date, sessions_count, total_duration_sec
        FROM ic_sessions_daily
        ORDER BY date DESC
        LIMIT 7
      `).all(),
    ]);

    const todayCount = Number(summary?.today_sessions || 0);
    const todayDuration = Number(summary?.today_duration_sec || 0);
    const totalCount = Number(summary?.total_sessions || 0);
    const totalDuration = Number(summary?.total_duration_sec || 0);
    const todayAvg = todayCount ? Math.round(todayDuration / todayCount) : 0;
    const totalAvg = totalCount ? Math.round(totalDuration / totalCount) : 0;

    const dist = [
      { label: '30초 미만', count: 0 },
      { label: '30초~2분', count: 0 },
      { label: '2분~5분', count: 0 },
      { label: '5분+', count: 0 },
    ];
    if (todayAvg < 30) dist[0].count = todayCount;
    else if (todayAvg < 120) dist[1].count = todayCount;
    else if (todayAvg < 300) dist[2].count = todayCount;
    else dist[3].count = todayCount;

    return {
      today_count: todayCount,
      today_avg: todayAvg,
      total_avg: totalAvg,
      distribution: dist,
      recent: [],
      today_sessions: todayCount,
      today_avg_sec: todayAvg,
      total_sessions: totalCount,
      total_avg_sec: totalAvg,
      recent_sessions: [],
      last_7_days: (last7.results || []).map((row) => ({
        date: row.date,
        sessions: Number(row.sessions_count || 0),
        avg_sec: row.sessions_count
          ? Math.round(Number(row.total_duration_sec || 0) / Number(row.sessions_count))
          : 0,
      })),
    };
  },
));
