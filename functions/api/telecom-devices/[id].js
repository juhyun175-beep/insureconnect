/**
 * 통신 단말기 단건 — PATCH/DELETE (관리자)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const allowed = ['name', 'options', 'promo_text', 'image_url', 'carrier', 'plan_text', 'monthly_text', 'sort_order', 'is_active'];
  const fields = allowed.filter(k => k in body);
  if (!fields.length) return error('No fields to update');
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => {
    if (f === 'sort_order') return Number.isFinite(+body[f]) ? +body[f] : 100;
    if (f === 'is_active') return (body[f] === 0 || body[f] === false) ? 0 : 1;
    return body[f] == null ? null : String(body[f]).slice(0, 500);
  });
  await env.DB.prepare(
    `UPDATE ic_telecom_devices SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values, params.id).run();
  return json({ ok: true });
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_telecom_devices WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});
