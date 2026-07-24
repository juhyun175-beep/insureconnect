/**
 * 메인 통계 — KPI + 7일 시계열
 *   loadDashboard()가 호출
 */
import { handle, corsPreflight } from '../../_lib/http.js';
import { edgeCachedJson } from '../../_lib/edge-cache.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx);

function kstDateKey(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const onRequestGet = async (ctx) => handle(async () => edgeCachedJson(
  ctx,
  'stats-main-v2',
  35,
  async () => {
    const { env } = ctx;
    const today = kstDateKey();
    // v2.1.15: 이번 주를 「일요일 시작 ~ 토요일 끝」(국내 달력 관례) 으로 계산
    const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
    const dow = nowKst.getUTCDay();
    const weekStart = new Date(nowKst);
    weekStart.setUTCDate(nowKst.getUTCDate() - dow);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + 9 * 3600 * 1000 - i * 86400 * 1000);
      last7.push(d.toISOString().slice(0, 10));
    }

    // 기존 7개 statement를 3개로 통합한다. 응답 필드는 그대로 유지한다.
    const [traffic, clicks, series] = await Promise.all([
      env.DB.prepare(`
        SELECT
          COUNT(*) AS total_visits,
          COALESCE(SUM(CASE WHEN date = ? THEN 1 ELSE 0 END), 0) AS today_visits,
          COALESCE(SUM(CASE WHEN date >= ? AND date <= ? THEN 1 ELSE 0 END), 0) AS week_visits
        FROM ic_traffic_hits
      `).bind(today, weekStartStr, today).first(),
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(clicks), 0) AS total_clicks,
          COALESCE(SUM(CASE WHEN date = ? THEN clicks ELSE 0 END), 0) AS today_clicks
        FROM ic_card_clicks_daily
      `).bind(today).first(),
      env.DB.prepare(`
        SELECT date, COUNT(*) AS visits, 0 AS clicks
        FROM ic_traffic_hits
        WHERE date >= ?
        GROUP BY date
        UNION ALL
        SELECT date, 0 AS visits, COALESCE(SUM(clicks), 0) AS clicks
        FROM ic_card_clicks_daily
        WHERE date >= ?
        GROUP BY date
      `).bind(last7[0], last7[0]).all(),
    ]);

    const seriesMap = new Map(last7.map((date) => [date, { visits: 0, clicks: 0 }]));
    for (const row of series.results || []) {
      const item = seriesMap.get(row.date);
      if (!item) continue;
      item.visits += Number(row.visits || 0);
      item.clicks += Number(row.clicks || 0);
    }

    return {
      today_visits: Number(traffic?.today_visits || 0),
      week_visits: Number(traffic?.week_visits || 0),
      total_visits: Number(traffic?.total_visits || 0),
      today_clicks: Number(clicks?.today_clicks || 0),
      total_clicks: Number(clicks?.total_clicks || 0),
      week_start_date: weekStartStr,
      week_end_date: weekEndStr,
      today_date: today,
      daily_visits_7d: last7.map((date) => ({ date, visits: seriesMap.get(date).visits })),
      daily_clicks_7d: last7.map((date) => ({ date, clicks: seriesMap.get(date).clicks })),
    };
  },
));
