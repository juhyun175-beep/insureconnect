/**
 * v2.137.0: 제휴 파트너 광고 카드 수정/삭제 (관리자)
 *   PATCH  /api/partners/{id}
 *   DELETE /api/partners/{id}
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const isHttp = (u) => /^https?:\/\//i.test(String(u || '').trim());

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_partner_cards WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const allowed = ['name', 'tagline', 'category', 'href', 'img', 'sort_order', 'is_active'];
  const fields = allowed.filter((key) => key in body);
  if (!fields.length) return json({ error: 'No fields' }, 400);
  if ('name' in body && !String(body.name || '').trim()) {
    return json({ error: '파트너명은 필수입니다.' }, 400);
  }
  if ('href' in body && !isHttp(body.href)) {
    return json({ error: '링크는 http(s) URL이어야 합니다.' }, 400);
  }
  if ('img' in body && body.img && !isHttp(body.img)) {
    return json({ error: '이미지는 http(s) URL이어야 합니다.' }, 400);
  }
  const sets = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => {
    if (field === 'is_active') return body[field] ? 1 : 0;
    if (field === 'sort_order') return Number.isFinite(body[field]) ? body[field] : 0;
    if (field === 'name' || field === 'tagline' || field === 'category' || field === 'href' || field === 'img') {
      return String(body[field] || '').trim() || null;
    }
    return body[field];
  });
  await env.DB.prepare(`UPDATE ic_partner_cards SET ${sets} WHERE id = ?`).bind(...values, params.id).run();
  return json({ ok: true });
});

