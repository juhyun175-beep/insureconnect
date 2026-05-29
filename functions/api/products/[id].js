/**
 * v2.1.0: 상품 단건 수정·삭제
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ params, env }) => handle(async () => {
  const row = await env.DB.prepare(`SELECT * FROM ic_products WHERE id = ?`).bind(params.id).first();
  if (!row) return error('Not found', 404);
  return json(row);
});

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const allowed = ['slug','name','description','type','target_id','price_krw','download_file_url','download_filename','active'];
  const fields = allowed.filter(k => k in body);
  if (!fields.length) return error('No fields');
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => {
    if (f === 'active') return body[f] ? 1 : 0;
    if (f === 'price_krw') return Math.floor(body[f]);
    return body[f];
  });
  await env.DB.prepare(
    `UPDATE ic_products SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values, params.id).run();
  return json({ ok: true });
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  // soft delete — active=0 (구매 이력 보존)
  await env.DB.prepare(`UPDATE ic_products SET active = 0, updated_at = datetime('now') WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});
