import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** 채용공고 목록 — order, limit 지원 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
  const order = url.searchParams.get('order') === 'created_at.asc' ? 'ASC' : 'DESC';
  const rs = await env.DB.prepare(
    `SELECT id, title, company_name, description, file_url, file_type, created_at
     FROM ic_recruitments ORDER BY created_at ${order} LIMIT ?`
  ).bind(limit).all();
  return json(rs.results || []);
});

/** 신규 등록 (관리자) */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const r = await env.DB.prepare(
    `INSERT INTO ic_recruitments (title, company_name, description, file_url, file_type)
     VALUES (?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.title || '',
    body.company_name || null,
    body.description || null,
    body.file_url || null,
    body.file_type || null
  ).first();
  return json({ id: r.id });
});
