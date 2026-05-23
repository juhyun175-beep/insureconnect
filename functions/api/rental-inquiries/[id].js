import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const row = await env.DB.prepare(
    `SELECT * FROM ic_rental_inquiries WHERE id = ?`
  ).bind(params.id).first();
  if (!row) return error('Not found', 404);
  return json(row);
});

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const allowed = ['status','memo'];
  const fields = allowed.filter(k => k in body);
  if (!fields.length) return error('No fields to update');
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => body[f] == null ? null : String(body[f]).slice(0, 1000));
  await env.DB.prepare(
    `UPDATE ic_rental_inquiries SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values, params.id).run();
  return json({ ok: true });
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_rental_inquiries WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});
