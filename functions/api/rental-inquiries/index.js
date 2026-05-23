/**
 * 렌트카 신청 (견적 정보 포함)
 *   POST /api/rental-inquiries → 사용자 신청 (공개)
 *   GET  /api/rental-inquiries → 신청 목록 (관리자)
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') || 'all';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);

  const where = statusParam === 'all' ? '1=1' : 'status = ?';
  const params = statusParam === 'all' ? [] : [statusParam];

  const rs = await env.DB.prepare(
    `SELECT i.id, i.vehicle_id, i.vehicle_name_snapshot, i.customer_name, i.customer_phone,
            i.preferred_time, i.organization, i.memo, i.status, i.created_at, i.updated_at,
            i.contract_months, i.annual_km, i.selected_color, i.insurance_opts, i.estimated_monthly,
            i.business_type, i.deposit_prepay, i.insurance_age,
            v.image_url AS vehicle_image_url, v.delivery_type AS vehicle_delivery_type
     FROM ic_rental_inquiries i
     LEFT JOIN ic_rental_vehicles v ON v.id = i.vehicle_id
     WHERE ${where}
     ORDER BY i.created_at DESC
     LIMIT ?`
  ).bind(...params, limit).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const body = await request.json();

  const name = (body.customer_name || '').trim();
  const phone = (body.customer_phone || '').trim();
  if (!name || name.length < 2) return error('이름을 입력해주세요');
  if (!phone || phone.length < 8) return error('연락 가능한 휴대폰을 입력해주세요');

  let vehicleId = null;
  let vehicleNameSnapshot = (body.vehicle_name || '').trim().slice(0, 200);

  if (body.vehicle_id) {
    const v = await env.DB.prepare(
      `SELECT id, name FROM ic_rental_vehicles WHERE id = ? AND is_active = 1`
    ).bind(body.vehicle_id).first();
    if (v) {
      vehicleId = v.id;
      if (!vehicleNameSnapshot) vehicleNameSnapshot = v.name;
    }
  }
  if (!vehicleNameSnapshot) vehicleNameSnapshot = '(미지정 차량)';

  const r = await env.DB.prepare(
    `INSERT INTO ic_rental_inquiries
       (vehicle_id, vehicle_name_snapshot, customer_name, customer_phone,
        preferred_time, organization, memo, status,
        contract_months, annual_km, selected_color, insurance_opts, estimated_monthly,
        business_type, deposit_prepay, insurance_age)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    vehicleId,
    vehicleNameSnapshot,
    name.slice(0, 60),
    phone.slice(0, 30),
    body.preferred_time ? String(body.preferred_time).slice(0, 60) : null,
    body.organization ? String(body.organization).slice(0, 100) : null,
    body.memo ? String(body.memo).slice(0, 1000) : null,
    Number.isFinite(+body.contract_months) ? +body.contract_months : null,
    Number.isFinite(+body.annual_km) ? +body.annual_km : null,
    body.selected_color ? String(body.selected_color).slice(0, 50) : null,
    body.insurance_opts ? String(body.insurance_opts).slice(0, 100) : null,
    Number.isFinite(+body.estimated_monthly) ? +body.estimated_monthly : null,
    body.business_type ? String(body.business_type).slice(0, 30) : null,
    body.deposit_prepay ? String(body.deposit_prepay).slice(0, 200) : null,
    body.insurance_age ? String(body.insurance_age).slice(0, 30) : null
  ).first();
  return json({ id: r.id, ok: true });
});
