import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** GET 전체 슬라이드 — sort_order 정렬 (set_id별 그룹핑은 클라가)
 *  v2.1.49: ?set_id= 필터 지원 (관리자 세트 삭제 플로우에서 사용)
 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);
  const setId = url.searchParams.get('set_id');

  if (setId) {
    const rs = await env.DB.prepare(
      `SELECT id, set_id, title, file_url, file_type, sort_order, created_at
       FROM ic_card_news WHERE set_id = ? ORDER BY sort_order ASC`
    ).bind(setId).all();
    return json(rs.results || []);
  }

  const rs = await env.DB.prepare(
    `SELECT id, set_id, title, file_url, file_type, sort_order, created_at
     FROM ic_card_news ORDER BY created_at DESC, sort_order ASC LIMIT ?`
  ).bind(limit).all();
  return json(rs.results || []);
});

/** POST 새 슬라이드 (관리자) */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  // 배열로 여러 슬라이드 한 번에
  const items = Array.isArray(body) ? body : [body];
  const ids = [];
  for (const it of items) {
    const r = await env.DB.prepare(
      `INSERT INTO ic_card_news (set_id, title, file_url, file_type, sort_order)
       VALUES (?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      it.set_id || crypto.randomUUID(),
      it.title || null,
      it.file_url || null,
      it.file_type || null,
      it.sort_order || 0
    ).first();
    ids.push(r.id);
  }
  return json({ ids });
});

/** v2.1.49: DELETE — collection 레벨에서도 ?set_id= 쿼리로 일괄 삭제 가능.
 *  이전: 클라이언트가 DELETE /api/card-news?set_id= 호출했으나 핸들러 없어 405 → DB 안 지워짐.
 *  set_id 필수 — 무차별 대량 삭제 방지.
 */
export const onRequestDelete = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const setId = url.searchParams.get('set_id');
  if (!setId) return error('set_id required for collection-level delete', 400);

  // 기본 UUID 형식 검증 (재앙 방지)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(setId)) {
    return error('Invalid set_id format', 400);
  }

  const result = await env.DB.prepare(
    `DELETE FROM ic_card_news WHERE set_id = ?`
  ).bind(setId).run();
  return json({ ok: true, deleted: result.meta?.changes || 0, set_id: setId });
});
