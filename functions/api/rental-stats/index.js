/**
 * 렌트카 카드 통계
 *   GET /api/rental-stats
 *
 * 데이터 소스: ic_link_clicks_daily
 *   - 카드 클릭:  company_name='렌트카 견적 시작',     company_type='vehicle_{id}'
 *   - 신청 완료:  company_name='렌트카 견적 신청 완료', company_type='vehicle_{id}'
 *
 * 차량별 표시명·이미지는 ic_rental_vehicles 와 JOIN (vehicle_id 추출)
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const CLICK_NAME  = '렌트카 견적 시작';
const SUBMIT_NAME = '렌트카 견적 신청 완료';
const TRACK_NAMES = [CLICK_NAME, SUBMIT_NAME];

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  const today = kstDateKey();
  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '14', 10), 60);

  // 1) KPI
  const kpiQ = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS total_clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS total_submits,
       SUM(CASE WHEN company_name=? AND date=? THEN clicks ELSE 0 END) AS today_clicks,
       SUM(CASE WHEN company_name=? AND date=? THEN clicks ELSE 0 END) AS today_submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?)
       AND company_type LIKE 'vehicle_%'`
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
       AND company_type LIKE 'vehicle_%'
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
    timeline.push({ date: key, clicks: v.clicks, submits: v.submits });
  }

  // 3) 차량별 Top 클릭
  const perVehicleQ = await env.DB.prepare(
    `SELECT company_type,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS clicks,
       SUM(CASE WHEN company_name=? THEN clicks ELSE 0 END) AS submits
     FROM ic_link_clicks_daily
     WHERE company_name IN (?, ?)
       AND company_type LIKE 'vehicle_%'
     GROUP BY company_type
     ORDER BY clicks DESC
     LIMIT 30`
  ).bind(CLICK_NAME, SUBMIT_NAME, CLICK_NAME, SUBMIT_NAME).all();

  // 차량 메타데이터 (전체)
  const vehiclesQ = await env.DB.prepare(
    `SELECT id, name, image_url, is_active, delivery_type FROM ic_rental_vehicles`
  ).all();
  const vMap = new Map();
  for (const v of (vehiclesQ.results || [])) {
    vMap.set(+v.id, v);
  }

  const byVehicle = (perVehicleQ.results || []).map(r => {
    const idStr = String(r.company_type).replace(/^vehicle_/, '');
    const id = parseInt(idStr, 10);
    const v = vMap.get(id);
    const clicks  = +r.clicks  || 0;
    const submits = +r.submits || 0;
    return {
      vehicle_id: Number.isFinite(id) ? id : null,
      company_type: r.company_type,
      name: v ? v.name : `(삭제됨 #${idStr})`,
      image_url: v ? v.image_url : null,
      is_active: v ? v.is_active : 0,
      delivery_type: v ? v.delivery_type : null,
      clicks, submits,
      conversion: clicks > 0 ? Math.round(submits / clicks * 1000) / 10 : 0,   // 1자리 소수
    };
  });

  return json({
    kpi: {
      total_clicks:  tc,
      total_submits: ts,
      today_clicks:  dc,
      today_submits: ds,
      total_conversion: tc > 0 ? Math.round(ts / tc * 1000) / 10 : 0,
      today_conversion: dc > 0 ? Math.round(ds / dc * 1000) / 10 : 0,
    },
    timeline,                    // [{date, clicks, submits}, ...]
    by_vehicle: byVehicle,       // [{vehicle_id, name, image_url, clicks, submits, conversion}, ...]
    generated_at: new Date().toISOString(),
  });
});
