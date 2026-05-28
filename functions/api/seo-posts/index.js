/**
 * v2.0.0 (master): SEO 게시글 CRUD
 *
 *   GET  /api/seo-posts?category=&status=&limit=
 *   POST /api/seo-posts  (admin) — 신규 작성
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { isValidCategory } from '../../_lib/seo-categories.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const statusParam = url.searchParams.get('status') || 'published';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  // 관리자 외에는 published 만
  if (statusParam !== 'published' && !verifyAdmin(request, env)) return unauthorized();

  const where = [];
  const binds = [];
  if (statusParam !== 'all') { where.push('status = ?'); binds.push(statusParam); }
  if (category) {
    if (!isValidCategory(category)) return error('Invalid category', 400);
    where.push('category = ?'); binds.push(category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rs = await env.DB.prepare(
    `SELECT id, category, slug, title, excerpt, cover_image_url, view_count, status,
            author, created_at, updated_at
     FROM ic_seo_posts ${whereSql} ORDER BY created_at DESC LIMIT ?`
  ).bind(...binds, limit).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  if (!body.category || !isValidCategory(body.category)) return error('Invalid category');
  if (!body.slug || !/^[a-z0-9-]{2,80}$/.test(body.slug)) return error('Invalid slug (a-z, 0-9, -)');
  if (!body.title?.trim()) return error('title required');
  if (!body.content?.trim()) return error('content required');

  try {
    const r = await env.DB.prepare(
      `INSERT INTO ic_seo_posts
        (category, slug, title, excerpt, content, cover_image_url, tags, faq_json, status, author)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      body.category,
      body.slug.trim().toLowerCase(),
      body.title.trim().slice(0, 200),
      body.excerpt ? String(body.excerpt).slice(0, 300) : null,
      String(body.content),
      body.cover_image_url || null,
      body.tags ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)) : null,
      body.faq_json ? (typeof body.faq_json === 'string' ? body.faq_json : JSON.stringify(body.faq_json)) : null,
      body.status || 'published',
      body.author || 'admin'
    ).first();
    return json({ id: r.id, ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return error('이미 동일한 (category, slug) 조합이 존재합니다', 409);
    throw e;
  }
});
