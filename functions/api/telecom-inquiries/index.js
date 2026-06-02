/**
 * 통신(휴대폰) 견적 신청
 *   POST /api/telecom-inquiries → 사용자 신청 (공개)
 *   GET  /api/telecom-inquiries → 신청 목록 (관리자)
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
    `SELECT i.id, i.device_id, i.device_name_snapshot, i.customer_name, i.customer_phone,
            i.carrier_pref, i.preferred_time, i.organization, i.memo, i.status, i.created_at, i.updated_at,
            d.image_url AS device_image_url
     FROM ic_telecom_inquiries i
     LEFT JOIN ic_telecom_devices d ON d.id = i.device_id
     WHERE ${where}
     ORDER BY i.created_at DESC
     LIMIT ?`
  ).bind(...params, limit).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const body = await request.json();

  // 봇 스팸 방지(honeypot)
  if (body.website && String(body.website).trim()) return json({ ok: true });

  const name = (body.customer_name || '').trim();
  const phone = (body.customer_phone || '').trim();
  if (!name || name.length < 2) return error('이름을 입력해주세요');
  if (!phone || phone.length < 8) return error('연락 가능한 휴대폰을 입력해주세요');

  let deviceId = null;
  let deviceNameSnapshot = (body.device_name || '').trim().slice(0, 200);
  if (body.device_id) {
    const d = await env.DB.prepare(
      `SELECT id, name FROM ic_telecom_devices WHERE id = ? AND is_active = 1`
    ).bind(body.device_id).first();
    if (d) { deviceId = d.id; if (!deviceNameSnapshot) deviceNameSnapshot = d.name; }
  }
  if (!deviceNameSnapshot) deviceNameSnapshot = '(미지정 단말기)';

  const r = await env.DB.prepare(
    `INSERT INTO ic_telecom_inquiries
       (device_id, device_name_snapshot, customer_name, customer_phone,
        carrier_pref, preferred_time, organization, memo, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new') RETURNING id`
  ).bind(
    deviceId,
    deviceNameSnapshot,
    name.slice(0, 60),
    phone.slice(0, 30),
    body.carrier_pref ? String(body.carrier_pref).slice(0, 30) : null,
    body.preferred_time ? String(body.preferred_time).slice(0, 60) : null,
    body.organization ? String(body.organization).slice(0, 100) : null,
    body.memo ? String(body.memo).slice(0, 1000) : null
  ).first();
  return json({ id: r.id, ok: true });
});
