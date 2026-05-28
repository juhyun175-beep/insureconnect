/**
 * v2.0.0 Sprint 2: 현재 로그인 사용자 조회
 *   GET /api/auth/me  →  { user: {...} } or 401
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { getCurrentUser, unauthorizedJson } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async (ctx) => handle(async () => {
  const user = await getCurrentUser(ctx);
  if (!user) return unauthorizedJson();
  return json({
    user: {
      id: user.id, email: user.email, display_name: user.display_name,
      role: user.role, cert_status: user.cert_status,
    }
  });
});
