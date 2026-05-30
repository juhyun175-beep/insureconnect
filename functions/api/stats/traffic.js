/**
 * v2.1.70: 유입 경로 집계 — ic_traffic_hits 기반
 *   GET /api/stats/traffic (admin)
 *   응답: referrer/landing/device/utm (today/total) + recent
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const today = kstDateKey();

  const grp = async (col, todayOnly, { limit = 20, notNull = false } = {}) => {
    const where = [];
    if (todayOnly) where.push(`date = ?`);
    if (notNull) where.push(`${col} IS NOT NULL AND ${col} != ''`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const binds = todayOnly ? [today] : [];
    const rs = await env.DB.prepare(
      `SELECT ${col} AS name, COUNT(*) AS count FROM ic_traffic_hits ${whereSql}
       GROUP BY ${col} ORDER BY count DESC LIMIT ${limit}`
    ).bind(...binds).all();
    return (rs.results || []).map(r => ({ name: r.name || '(없음)', count: r.count }));
  };

  const recentRs = await env.DB.prepare(
    `SELECT ts, source, referrer, landing, device FROM ic_traffic_hits ORDER BY id DESC LIMIT 30`
  ).all();

  const [refT, refA, landT, landA, devT, devA, utmT, utmA] = await Promise.all([
    grp('source', true), grp('source', false),
    grp('landing', true, { limit: 15 }), grp('landing', false, { limit: 15 }),
    grp('device', true), grp('device', false),
    grp('utm_source', true, { notNull: true }), grp('utm_source', false, { notNull: true }),
  ]);

  return json({
    referrer_today: refT, referrer_total: refA,
    landing_today:  landT, landing_total:  landA,
    device_today:   devT, device_total:   devA,
    utm_today:      utmT, utm_total:      utmA,
    recent: (recentRs.results || []),
  });
});
