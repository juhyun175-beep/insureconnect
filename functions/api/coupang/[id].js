/**
 * v2.95.0: 쿠팡 파트너스 추천 아이템 — 수정/삭제 (관리자)
 *   PATCH  /api/coupang/{id}   body: 부분 필드 (label/sub/href/img/sort_order/is_active)
 *   DELETE /api/coupang/{id}
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_coupang_items WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const allowed = ['label', 'sub', 'href', 'img', 'sort_order', 'is_active'];
  const fields = allowed.filter((k) => k in body);
  if (!fields.length) return json({ error: 'No fields' }, 400);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => {
    if (f === 'is_active') return body[f] ? 1 : 0;
    if (f === 'sort_order') return Number.isFinite(body[f]) ? body[f] : 0;
    return body[f];
  });
  await env.DB.prepare(`UPDATE ic_coupang_items SET ${sets} WHERE id = ?`).bind(...values, params.id).run();
  return json({ ok: true });
});
