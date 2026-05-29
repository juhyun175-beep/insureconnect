/**
 * v2.1.0: 상품 API
 *
 *   GET  /api/products                  → active 상품 목록 (공개)
 *   GET  /api/products?all=1            → 모든 상품 (admin)
 *   GET  /api/products?type=&target_id= → 특정 콘텐츠의 상품 (공개)
 *   POST /api/products                  → 신규 등록 (admin)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const PUBLIC_FIELDS = ['id','slug','name','description','type','target_id','price_krw','download_filename','active','created_at'];

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';
  const type = url.searchParams.get('type');
  const targetId = url.searchParams.get('target_id');

  if (all && !verifyAdmin(request, env)) return unauthorized();

  const where = [];
  const binds = [];
  if (!all) { where.push('active = 1'); }
  if (type) { where.push('type = ?'); binds.push(type); }
  if (targetId) { where.push('target_id = ?'); binds.push(targetId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const fields = all
    ? '*'
    : PUBLIC_FIELDS.join(',');
  const rs = await env.DB.prepare(
    `SELECT ${fields} FROM ic_products ${whereSql} ORDER BY created_at DESC LIMIT 200`
  ).bind(...binds).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  if (!body.slug || !/^[a-z0-9-]{2,80}$/.test(body.slug)) return error('Invalid slug');
  if (!body.name?.trim()) return error('name required');
  if (!body.type || !['cardnews','bundle','other'].includes(body.type)) return error('Invalid type');
  if (!Number.isFinite(body.price_krw) || body.price_krw < 100) return error('price_krw must be >= 100');

  try {
    const r = await env.DB.prepare(
      `INSERT INTO ic_products
        (slug, name, description, type, target_id, price_krw, download_file_url, download_filename, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      body.slug.trim().toLowerCase(),
      body.name.trim().slice(0, 200),
      body.description ? String(body.description).slice(0, 1000) : null,
      body.type,
      body.target_id || null,
      Math.floor(body.price_krw),
      body.download_file_url || null,
      body.download_filename || null,
      body.active === false ? 0 : 1
    ).first();
    return json({ id: r.id, ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return error('slug 중복', 409);
    throw e;
  }
});
