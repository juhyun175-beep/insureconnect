import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** 강의공고 목록
 *   기본: status='approved'
 *   ?status=pending/all : 관리자 전용
 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
  const statusParam = url.searchParams.get('status') || 'approved';

  if (statusParam !== 'approved') {
    if (!verifyAdmin(request, env)) return unauthorized();
  }

  const where = statusParam === 'all' ? '1=1' : 'status = ?';
  const params = statusParam === 'all' ? [] : [statusParam];
  const rs = await env.DB.prepare(
    `SELECT id, title, instructor, description, file_url, file_type, created_at,
            status, submitter_name, submitter_contact, reject_reason, approved_at
     FROM ic_lectures WHERE ${where} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params, limit).all();
  return json(rs.results || []);
});

/** 신규 등록 (관리자=approved / 사용자=pending) */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  const body = await request.json();
  const isAdmin = verifyAdmin(request, env);

  if (!body.title || !body.title.trim()) return error('title is required');

  let status, submitterName = null, submitterContact = null, approvedAt = null;
  if (isAdmin) {
    status = body.status || 'approved';
    approvedAt = new Date().toISOString();
  } else {
    if (!body.submitter_name || !body.submitter_name.trim()) return error('submitter_name is required');
    if (!body.submitter_contact || !body.submitter_contact.trim()) return error('submitter_contact is required');
    status = 'pending';
    submitterName = body.submitter_name.trim().slice(0, 60);
    submitterContact = body.submitter_contact.trim().slice(0, 100);
  }

  const r = await env.DB.prepare(
    `INSERT INTO ic_lectures
       (title, instructor, description, file_url, file_type, status,
        submitter_name, submitter_contact, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.title.trim().slice(0, 200),
    body.instructor ? String(body.instructor).slice(0, 80) : null,
    body.description ? String(body.description).slice(0, 5000) : null,
    body.file_url || null,
    body.file_type || null,
    status,
    submitterName,
    submitterContact,
    approvedAt
  ).first();
  return json({ id: r.id, status });
});
