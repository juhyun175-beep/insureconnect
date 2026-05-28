/**
 * v2.0.0 Sprint 2: 로그아웃
 *   POST /api/auth/logout
 *   세션 revoked=1 처리 + 쿠키 만료
 */
import { handle, corsPreflight } from '../../_lib/http.js';
import { parseCookie, verifyJwt, clearSessionCookie } from '../../_lib/jwt.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const token = parseCookie(request, 'ic_session');
  if (token) {
    const payload = await verifyJwt(token, env.JWT_SECRET).catch(() => null);
    if (payload?.jti) {
      await env.DB.prepare(`UPDATE ic_sessions SET revoked = 1 WHERE jti = ?`)
        .bind(payload.jti).run().catch(() => {});
    }
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    }
  });
});
