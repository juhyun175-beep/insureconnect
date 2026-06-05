/**
 * v2.15.2: 통신·휴대폰 카드 통계 (렌트카-stats 미러) — GET /api/telecom-stats (관리자)
 *   데이터 소스: ic_link_clicks_daily
 *     - 카드 클릭:  company_name='통신 견적 시작',     company_type='device_{id}'
 *     - 신청 완료:  company_name='통신 견적 신청 완료', company_type='device_{id}'
 *   진입: ic_card_clicks_daily card IN ('통신','통신/휴대폰')
 *   삭제된 단말기(ic_telecom_devices 에 없는 device_id) 기록은 SQL 레벨로 제외.
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const CLICK_NAME = '통신 견적 시작';
const SUBMIT_NAME = '통신 견적 신청 완료';

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  const today = kstDateKey();
  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '14', 10), 60);

  const devQ = await env.DB.prepare(
    `SELECT id, name, image_url, is_active, carrier FROM ic_telecom_devices`
  ).all();
  const dList = devQ.results || [];
  const dMap = new Map();
  for (const v of dList) dMap.set(+v.id, v);

  // 진입 — 통신 페이지 카드 클릭(card IN '통신','통신/휴대폰')
  const entryQ = await env.DB.prepare(
    `SELECT SUM(clicks) AS total, SUM(CASE WHEN date=? THEN clicks ELSE 0 END) AS today
       FROM ic_card_clicks_daily WHERE card IN ('통신','통신/휴대폰')`
  ).bind(today).first() || {};
  const totalEntries = +entryQ.total || 0;
  const todayEntries = +entryQ.today || 0;

  const entryDailyQ = await env.DB.prepare(
    `SELECT date, SUM(clicks) AS clicks FROM ic_card_clicks_daily
      WHERE card IN ('통신','통신/휴대폰') AND date >= date(?, ?)
      GROUP BY date ORDER BY date ASC`
  ).bind(today, `-${days} days`).all();
  const entryDailyMap = new Map();
  for (const r of (entryDailyQ.results || [])) entryDailyMap.set(r.date, +r.clicks || 0);

  const mkTimeline = (dailyMap) => {
    const t = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setUTCHours(d.getUTCHours() + 9); d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const v = (dailyMap && dailyMap.get(key)) || { clicks: 0, submits: 0 };
      t.push({ date: key, entries: entryDailyMap.get(key) || 0, clicks: v.clicks || 0, submits: v.submits || 0 });
    }
    return t;
  };

  if (dList.length === 0) {
    return json({
      kpi: { total_entries: totalEntries, today_entries: todayEntries, total_clicks: 0, total_submits: 0, today_clicks: 0, today_submits: 0, total_conversion: 0, today_conversion: 0, entry_to_click: 0 },
      timeline: mkTimeline(null), by_device: [], generated_at: new Date().toISOString(),
    });
  }

  const VALID = `(SELECT 'device_' || id FROM ic_telecom_devices)`;

  const kpiQ = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS total_clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS total_submits,
       SUM(CASE WHEN company_name=? AND date=? THEN clicks ELSE 0 END) AS today_clicks,
       SUM(CASE WHEN company_name=? AND date=? THEN clicks ELSE 0 END) AS today_submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?) AND company_type IN ${VALID}`
  ).bind(CLICK_NAME, SUBMIT_NAME, CLICK_NAME, today, SUBMIT_NAME, today, CLICK_NAME, SUBMIT_NAME).first() || {};
  const tc = +kpiQ.total_clicks || 0, ts = +kpiQ.total_submits || 0, dc = +kpiQ.today_clicks || 0, ds = +kpiQ.today_submits || 0;

  const dailyQ = await env.DB.prepare(
    `SELECT date,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?) AND company_type IN ${VALID} AND date >= date(?, ?)
     GROUP BY date ORDER BY date ASC`
  ).bind(CLICK_NAME, SUBMIT_NAME, CLICK_NAME, SUBMIT_NAME, today, `-${days} days`).all();
  const dailyMap = new Map();
  for (const r of (dailyQ.results || [])) dailyMap.set(r.date, { clicks: +r.clicks || 0, submits: +r.submits || 0 });

  const perQ = await env.DB.prepare(
    `SELECT company_type,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?) AND company_type IN ${VALID}
     GROUP BY company_type ORDER BY clicks DESC LIMIT 30`
  ).bind(CLICK_NAME, SUBMIT_NAME, CLICK_NAME, SUBMIT_NAME).all();
  const byDevice = (perQ.results || []).map((r) => {
    const id = parseInt(String(r.company_type).replace(/^device_/, ''), 10);
    const v = dMap.get(id); if (!v) return null;
    const clicks = +r.clicks || 0, submits = +r.submits || 0;
    return { device_id: id, company_type: r.company_type, name: v.name, image_url: v.image_url, is_active: v.is_active, carrier: v.carrier, clicks, submits, conversion: clicks > 0 ? Math.round(submits / clicks * 1000) / 10 : 0 };
  }).filter(Boolean);

  return json({
    kpi: {
      total_entries: totalEntries, today_entries: todayEntries,
      total_clicks: tc, total_submits: ts, today_clicks: dc, today_submits: ds,
      total_conversion: tc > 0 ? Math.round(ts / tc * 1000) / 10 : 0,
      today_conversion: dc > 0 ? Math.round(ds / dc * 1000) / 10 : 0,
      entry_to_click: totalEntries > 0 ? Math.round(tc / totalEntries * 1000) / 10 : 0,
    },
    timeline: mkTimeline(dailyMap), by_device: byDevice, generated_at: new Date().toISOString(),
  });
});
