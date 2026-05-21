import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** GET — ?active=1 이면 현재 시각 기준 활성 1건. 그 외에는 전체 목록 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  if (url.searchParams.get('active') === '1') {
    const rs = await env.DB.prepare(
      `SELECT id, title, content, file_url, file_type, starts_at, ends_at, created_at, updated_at
       FROM ic_home_popups
       WHERE is_active = 1
         AND (starts_at IS NULL OR starts_at <= datetime('now'))
         AND (ends_at   IS NULL OR ends_at   >= datetime('now'))
       ORDER BY created_at DESC LIMIT 1`
    ).all();
    return json(rs.results || []);
  }
  const rs = await env.DB.prepare(
    `SELECT * FROM ic_home_popups ORDER BY is_active DESC, created_at DESC LIMIT 50`
  ).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const r = await env.DB.prepare(
    `INSERT INTO ic_home_popups (title, content, file_url, file_type, is_active, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.title || '',
    body.content || '',
    body.file_url || null,
    body.file_type || null,
    body.is_active === false ? 0 : 1,
    body.starts_at || null,
    body.ends_at || null
  ).first();
  return json({ id: r.id });
});
