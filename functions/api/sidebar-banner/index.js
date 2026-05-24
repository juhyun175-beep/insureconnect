import { json, handle, error, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** v2.1.10: 세트 전체 삭제
 *   DELETE /api/sidebar-banner?set_id=xxx
 *   (path id 없이 query-string 으로만 호출되는 케이스 처리)
 */
export const onRequestDelete = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const setId = url.searchParams.get('set_id');
  if (!setId) return error('set_id query param required', 400);
  await env.DB.prepare(`DELETE FROM ic_sidebar_banner WHERE set_id = ?`).bind(setId).run();
  return json({ ok: true, scope: 'set' });
});

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);
  const rs = await env.DB.prepare(
    `SELECT id, set_id, title, file_url, file_type, sort_order, created_at
     FROM ic_sidebar_banner ORDER BY created_at DESC, sort_order ASC LIMIT ?`
  ).bind(limit).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const items = Array.isArray(body) ? body : [body];
  const ids = [];
  for (const it of items) {
    const r = await env.DB.prepare(
      `INSERT INTO ic_sidebar_banner (set_id, title, file_url, file_type, sort_order)
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
