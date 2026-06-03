/**
 * v2.10.1: 내 포인트 내역 — GET /api/points/history (로그인)
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);

  const me = await env.DB.prepare(`SELECT points, role FROM ic_members WHERE id = ?`).bind(user.id).first();
  let log = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT delta, reason, created_at FROM ic_point_log WHERE member_id = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(user.id).all();
    log = rs.results || [];
  } catch (_) {}

  return json({ points: me?.points || 0, role: me?.role || 'member', log });
});
