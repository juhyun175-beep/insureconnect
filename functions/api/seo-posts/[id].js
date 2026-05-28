/**
 * v2.0.0 (master): SEO 게시글 단건 조회 + 수정 + 삭제
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { isValidCategory } from '../../_lib/seo-categories.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ params, env }) => handle(async () => {
  const row = await env.DB.prepare(
    `SELECT * FROM ic_seo_posts WHERE id = ?`
  ).bind(params.id).first();
  if (!row) return error('Not found', 404);
  return json(row);
});

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();

  if (body.category && !isValidCategory(body.category)) return error('Invalid category');
  if (body.slug && !/^[a-z0-9-]{2,80}$/.test(body.slug)) return error('Invalid slug');

  const allowed = ['category','slug','title','excerpt','content','cover_image_url','tags','faq_json','status','author'];
  const fields = allowed.filter(k => k in body);
  if (!fields.length) return error('No fields');
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => {
    const v = body[f];
    if ((f === 'tags' || f === 'faq_json') && v && typeof v !== 'string') return JSON.stringify(v);
    return v;
  });

  await env.DB.prepare(
    `UPDATE ic_seo_posts SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values, params.id).run();
  return json({ ok: true });
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_seo_posts WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});
