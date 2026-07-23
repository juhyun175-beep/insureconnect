/**
 * v2.137.0: 제휴 파트너 광고 카드 — 수정/삭제 (관리자)
 *   PATCH  /api/partners/{id}   → 허용 필드 부분 수정 · updated_at 갱신
 *   DELETE /api/partners/{id}   → 소프트 삭제(is_active=0, deleted_at) · 물리 삭제 금지
 *
 *   id는 클릭·노출 집계에서 쓰는 영구 식별자이므로 레코드를 물리적으로 삭제하지 않는다.
 *   id·created_at·updated_at·deleted_at 은 요청으로 변경할 수 없다(허용 필드 화이트리스트).
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { buildPartnerWrite } from '../../_lib/partners.js';

export const onRequestOptions = () => corsPreflight();

function parseId(params) {
  const id = parseInt(params && params.id, 10);
  return Number.isInteger(id) && String(id) === String(params.id).trim() ? id : null;
}

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const id = parseId(params);
  if (id === null) return json({ error: '잘못된 ID입니다.' }, 400);
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }
  // 허용 필드만 부분 수정(빈 요청·허용 필드 없음은 400).
  const built = buildPartnerWrite(body, { partial: true });
  if (built.error) return json({ error: built.error }, 400);
  // 존재하지 않거나 이미 삭제된 ID는 404.
  const existing = await env.DB.prepare(
    `SELECT id FROM ic_partner_cards WHERE id = ? AND deleted_at IS NULL`
  ).bind(id).first();
  if (!existing) return json({ error: 'Not found' }, 404);
  const sets = built.columns.map((c) => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE ic_partner_cards SET ${sets}, updated_at = datetime('now')
      WHERE id = ? AND deleted_at IS NULL`
  ).bind(...built.values, id).run();
  return json({ ok: true });
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const id = parseId(params);
  if (id === null) return json({ error: '잘못된 ID입니다.' }, 400);
  const r = await env.DB.prepare(
    `UPDATE ic_partner_cards
        SET is_active = 0, deleted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND deleted_at IS NULL`
  ).bind(id).run();
  const changes = r && r.meta ? r.meta.changes : (r ? r.changes : 0);
  // 존재하지 않거나 이미 삭제된 ID는 404.
  if (!changes) return json({ error: 'Not found' }, 404);
  return json({ ok: true });
});
