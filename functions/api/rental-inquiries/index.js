/**
 * 렌트카 신청
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
            v.image_url AS vehicle_image_url
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

  // 공개 엔드포인트 — 기본 필드 검증
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
        preferred_time, organization, memo, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new') RETURNING id`
  ).bind(
    vehicleId,
    vehicleNameSnapshot,
    name.slice(0, 60),
    phone.slice(0, 30),
    body.preferred_time ? String(body.preferred_time).slice(0, 60) : null,
    body.organization ? String(body.organization).slice(0, 100) : null,
    body.memo ? String(body.memo).slice(0, 1000) : null
  ).first();
  return json({ id: r.id, ok: true });
});
