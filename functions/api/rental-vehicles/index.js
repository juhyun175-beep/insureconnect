/**
 * 렌트카 차량 라인업
 *   GET  /api/rental-vehicles            → 활성 차량만 (공개, 홈 카드용)
 *   GET  /api/rental-vehicles?status=all → 전체 (관리자)
 *   POST /api/rental-vehicles            → 신규 등록 (관리자)
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') || 'active';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '24', 10), 200);

  if (statusParam !== 'active' && !verifyAdmin(request, env)) {
    return unauthorized();
  }

  const where = statusParam === 'all' ? '1=1' : 'is_active = 1';
  const rs = await env.DB.prepare(
    `SELECT id, name, options, promo_text, image_url, category,
            sort_order, is_active, created_at, updated_at
     FROM ic_rental_vehicles
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
    `INSERT INTO ic_rental_vehicles
       (name, options, promo_text, image_url, category, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    String(body.name).trim().slice(0, 200),
    body.options ? String(body.options).slice(0, 300) : null,
    body.promo_text ? String(body.promo_text).slice(0, 60) : null,
    body.image_url ? String(body.image_url).slice(0, 500) : null,
    body.category ? String(body.category).slice(0, 30) : null,
    Number.isFinite(+body.sort_order) ? +body.sort_order : 100,
    body.is_active === 0 || body.is_active === false ? 0 : 1
  ).first();
  return json({ id: r.id });
});
