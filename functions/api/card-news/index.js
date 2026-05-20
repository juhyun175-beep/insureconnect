import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** GET 전체 슬라이드 — sort_order 정렬 (set_id별 그룹핑은 클라가) */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);
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
