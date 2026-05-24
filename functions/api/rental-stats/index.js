/**
 * 렌트카 카드 통계
 *   GET /api/rental-stats
 *
 * 데이터 소스: ic_link_clicks_daily
 *   - 카드 클릭:  company_name='렌트카 견적 시작',     company_type='vehicle_{id}'
 *   - 신청 완료:  company_name='렌트카 견적 신청 완료', company_type='vehicle_{id}'
 *
 * v2.1.14: 삭제된 차량(ic_rental_vehicles 에 없는 vehicle_id)의 기록은
 *           KPI · 타임라인 · 차량별 표 전체에서 SQL 레벨로 제외.
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const CLICK_NAME  = '렌트카 견적 시작';
const SUBMIT_NAME = '렌트카 견적 신청 완료';

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  const today = kstDateKey();
  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '14', 10), 60);

  // 차량 메타데이터 — 현재 존재하는(삭제 안 된) 차량들
  const vehiclesQ = await env.DB.prepare(
    `SELECT id, name, image_url, is_active, delivery_type FROM ic_rental_vehicles`
  ).all();
  const vList = vehiclesQ.results || [];
  const vMap = new Map();
  for (const v of vList) vMap.set(+v.id, v);

  // 페이지 진입 카운트 — 좌측 빨간 PILL 클릭 (v2.1.24)
  const entryQ = await env.DB.prepare(
    `SELECT
       SUM(clicks) AS total,
       SUM(CASE WHEN date=? THEN clicks ELSE 0 END) AS today
     FROM ic_card_clicks_daily
     WHERE menu='좌측버튼' AND card='리스/렌트카'`
  ).bind(today).first() || {};
  const totalEntries = +entryQ.total || 0;
  const todayEntries = +entryQ.today || 0;

  const entryDailyQ = await env.DB.prepare(
    `SELECT date, clicks
       FROM ic_card_clicks_daily
      WHERE menu='좌측버튼' AND card='리스/렌트카'
        AND date >= date(?, ?)
      ORDER BY date ASC`
  ).bind(today, `-${days} days`).all();
  const entryDailyMap = new Map();
  for (const r of (entryDailyQ.results || [])) entryDailyMap.set(r.date, +r.clicks || 0);

  // 차량이 0대면 모든 통계 빈 값으로 즉시 반환
  if (vList.length === 0) {
    const emptyTimeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCHours(d.getUTCHours() + 9);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0,10);
      emptyTimeline.push({
        date: key,
        entries: entryDailyMap.get(key) || 0,
        clicks: 0, submits: 0
      });
    }
    return json({
      kpi: {
        total_entries: totalEntries, today_entries: todayEntries,
        total_clicks:0, total_submits:0, today_clicks:0, today_submits:0,
        total_conversion:0, today_conversion:0
      },
      timeline: emptyTimeline,
      by_vehicle: [],
      generated_at: new Date().toISOString(),
    });
  }

  // 공통 필터: 현재 존재하는 차량의 vehicle_{id} 만 (삭제된 차량 제외)
  const VALID_TYPES_SUBQ = `(SELECT 'vehicle_' || id FROM ic_rental_vehicles)`;

  // 1) KPI
  const kpiQ = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS total_clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS total_submits,
       SUM(CASE WHEN company_name=? AND date=? THEN clicks ELSE 0 END) AS today_clicks,
       SUM(CASE WHEN company_name=? AND date=? THEN clicks ELSE 0 END) AS today_submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?)
       AND company_type IN ${VALID_TYPES_SUBQ}`
  ).bind(CLICK_NAME, SUBMIT_NAME, CLICK_NAME, today, SUBMIT_NAME, today, CLICK_NAME, SUBMIT_NAME).first() || {};

  const tc = +kpiQ.total_clicks  || 0;
  const ts = +kpiQ.total_submits || 0;
  const dc = +kpiQ.today_clicks  || 0;
  const ds = +kpiQ.today_submits || 0;

  // 2) 일별 추이
  const dailyQ = await env.DB.prepare(
    `SELECT date,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?)
       AND company_type IN ${VALID_TYPES_SUBQ}
       AND date >= date(?, ?)
     GROUP BY date
     ORDER BY date ASC`
  ).bind(CLICK_NAME, SUBMIT_NAME, CLICK_NAME, SUBMIT_NAME, today, `-${days} days`).all();

  // 14일치 timeline 생성 (없는 날도 0으로 채움)
  const dailyMap = new Map();
  for (const r of (dailyQ.results || [])) {
    dailyMap.set(r.date, { clicks: +r.clicks || 0, submits: +r.submits || 0 });
  }
  const timeline = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(d.getUTCHours() + 9);   // KST
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const v = dailyMap.get(key) || { clicks: 0, submits: 0 };
    timeline.push({
      date: key,
      entries: entryDailyMap.get(key) || 0,   // v2.1.24: 페이지 진입 (좌측 PILL)
      clicks: v.clicks,
      submits: v.submits
    });
  }

  // 3) 차량별 Top 클릭 (역시 삭제된 차량 제외)
  const perVehicleQ = await env.DB.prepare(
    `SELECT company_type,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?)
       AND company_type IN ${VALID_TYPES_SUBQ}
     GROUP BY company_type
     ORDER BY clicks DESC
     LIMIT 30`
  ).bind(CLICK_NAME, SUBMIT_NAME, CLICK_NAME, SUBMIT_NAME).all();

  const byVehicle = (perVehicleQ.results || [])
    .map(r => {
      const idStr = String(r.company_type).replace(/^vehicle_/, '');
      const id = parseInt(idStr, 10);
      const v = vMap.get(id);
      if (!v) return null;            // 이중 안전망 (SQL 필터로 이미 걸러짐)
      const clicks  = +r.clicks  || 0;
      const submits = +r.submits || 0;
      return {
        vehicle_id: id,
        company_type: r.company_type,
        name: v.name,
        image_url: v.image_url,
        is_active: v.is_active,
        delivery_type: v.delivery_type,
        clicks, submits,
        conversion: clicks > 0 ? Math.round(submits / clicks * 1000) / 10 : 0,
      };
    })
    .filter(Boolean);

  return json({
    kpi: {
      total_entries: totalEntries,    // v2.1.24: 좌측 PILL → 리스/렌트카 페이지 진입
      today_entries: todayEntries,
      total_clicks:  tc,
      total_submits: ts,
      today_clicks:  dc,
      today_submits: ds,
      total_conversion: tc > 0 ? Math.round(ts / tc * 1000) / 10 : 0,
      today_conversion: dc > 0 ? Math.round(ds / dc * 1000) / 10 : 0,
      entry_to_click: totalEntries > 0 ? Math.round(tc / totalEntries * 1000) / 10 : 0,  // 진입→카드클릭
    },
    timeline,
    by_vehicle: byVehicle,
    generated_at: new Date().toISOString(),
  });
});
