/**
 * v2.0.0 Sprint 2: 인증 미들웨어 헬퍼
 *
 *   const user = await getCurrentUser({ request, env });
 *   if (!user) return unauthorizedJson();
 */
import { parseCookie, verifyJwt } from './jwt.js';

/** 요청에서 현재 로그인 사용자 반환 — 없으면 null */
export async function getCurrentUser({ request, env }) {
  const token = parseCookie(request, 'ic_session');
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload?.sub) return null;

  // jti 가 revoked 됐는지 + 사용자 active 여부 확인
  try {
    const row = await env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, u.role, u.cert_status, u.active
       FROM ic_users u
       JOIN ic_sessions s ON s.user_id = u.id
       WHERE u.id = ? AND s.jti = ? AND s.revoked = 0 AND u.active = 1
       LIMIT 1`
    ).bind(payload.sub, payload.jti).first();
    if (!row) return null;
    return row;
  } catch (_) { return null; }
}

/** 권한 등급 비교 — admin > premium > certified > member > guest */
const ROLE_RANK = { guest: 0, member: 1, certified: 2, premium: 3, admin: 9 };
export function hasRole(user, minRole) {
  return (ROLE_RANK[user?.role] || 0) >= (ROLE_RANK[minRole] || 0);
}

export function unauthorizedJson() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function forbiddenJson() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
