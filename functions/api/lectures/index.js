import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
  const rs = await env.DB.prepare(
    `SELECT id, title, instructor, description, file_url, file_type, created_at
     FROM ic_lectures ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const r = await env.DB.prepare(
    `INSERT INTO ic_lectures (title, instructor, description, file_url, file_type)
     VALUES (?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.title || '',
    body.instructor || null,
    body.description || null,
    body.file_url || null,
    body.file_type || null
  ).first();
  return json({ id: r.id });
});
