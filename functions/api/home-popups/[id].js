import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_home_popups WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const fields = ['title','content','file_url','file_type','is_active','starts_at','ends_at']
    .filter(k => k in body);
  if (!fields.length) return json({ error: 'No fields' }, 400);
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => f === 'is_active' ? (body[f] ? 1 : 0) : body[f]);
  await env.DB.prepare(
    `UPDATE ic_home_popups SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values, params.id).run();
  return json({ ok: true });
});
