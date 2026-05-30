/**
 * v2.4.0: 회원 관리 — GET/POST /api/admin/members (admin)
 *   GET: 회원 목록  /  POST: 등급 변경 { member_id, role }
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ROLES } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const per = 50;
  const rs = await env.DB.prepare(
    `SELECT id, nickname, role, created_at, last_login FROM ic_members ORDER BY id DESC LIMIT ? OFFSET ?`
  ).bind(per, (page - 1) * per).all();
  const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_members`).first();
  return json({ members: rs.results || [], total: c?.n || 0, page });
});

export const onRequestPost = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const memberId = parseInt(body?.member_id, 10);
  const role = String(body?.role || '');
  if (!memberId) return error('member_id required');
  if (!ROLES.includes(role)) return error('invalid role');
  const r = await env.DB.prepare(`UPDATE ic_members SET role = ? WHERE id = ?`).bind(role, memberId).run();
  return json({ ok: true, changes: r?.meta?.changes ?? 0 });
});
