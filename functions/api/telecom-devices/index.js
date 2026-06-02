/**
 * 통신(휴대폰) 단말기 라인업 (렌트카 차량 라인업 구조 미러링)
 *   GET  /api/telecom-devices            → 활성 단말기만 (공개, 카드용)
 *   GET  /api/telecom-devices?status=all → 전체 (관리자)
 *   POST /api/telecom-devices            → 신규 등록 (관리자)
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') || 'active';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '24', 10), 200);
  if (statusParam !== 'active' && !verifyAdmin(request, env)) return unauthorized();

  const where = statusParam === 'all' ? '1=1' : 'is_active = 1';
  const rs = await env.DB.prepare(
    `SELECT id, name, options, promo_text, image_url, carrier, plan_text, monthly_text,
            sort_order, is_active, created_at, updated_at
     FROM ic_telecom_devices
     WHERE ${where}
     ORDER BY sort_order ASC, created_at DESC
     LIMIT ?`
  ).bind(limit).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  if (!body.name || !String(body.name).trim()) return error('name is required');

  const r = await env.DB.prepare(
    `INSERT INTO ic_telecom_devices
       (name, options, promo_text, image_url, carrier, plan_text, monthly_text, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    String(body.name).trim().slice(0, 200),
    body.options ? String(body.options).slice(0, 300) : null,
    body.promo_text ? String(body.promo_text).slice(0, 200) : null,
    body.image_url ? String(body.image_url).slice(0, 500) : null,
    body.carrier ? String(body.carrier).slice(0, 30) : null,
    body.plan_text ? String(body.plan_text).slice(0, 200) : null,
    body.monthly_text ? String(body.monthly_text).slice(0, 100) : null,
    Number.isFinite(+body.sort_order) ? +body.sort_order : 100,
    body.is_active === 0 || body.is_active === false ? 0 : 1
  ).first();
  return json({ id: r.id, ok: true });
});
