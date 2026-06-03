/**
 * 담보 스펙 단건 — PATCH/DELETE /api/coverages/{id} (관리자)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const FIELDS = { insurer: 60, product_name: 120, coverage_name: 100, join_amount: 60, premium: 60, join_age: 60, payment_period: 60, maturity_period: 60, gender: 20, notes: 300 };

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const sets = [];
  const binds = [];
  for (const f in FIELDS) {
    if (f in body) { sets.push(`${f} = ?`); binds.push(body[f] == null || body[f] === '' ? null : String(body[f]).slice(0, FIELDS[f])); }
  }
  if ('verify_status' in body && ['pending', 'approved', 'rejected'].includes(body.verify_status)) {
    sets.push('verify_status = ?'); binds.push(body.verify_status);
    if (body.verify_status === 'approved') { sets.push('approved_at = ?'); binds.push(new Date().toISOString().slice(0, 19).replace('T', ' ')); }
  }
  if (!sets.length) return error('No fields to update');
  await env.DB.prepare(`UPDATE ic_product_coverages SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...binds, params.id).run();
  return json({ ok: true });
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_product_coverages WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});
