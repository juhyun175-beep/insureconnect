/**
 * v2.17.6: 가이드 투어 1회 시청 기록(계정당) — POST /api/me/tour-seen (로그인 필수)
 *   자동 네비게이션 가이드는 계정당 1회만. 이후엔 ❓ 사용법 버튼으로 수동 재시청.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  try { await env.DB.prepare(`UPDATE ic_members SET tour_seen = 1 WHERE id = ?`).bind(user.id).run(); } catch (_) {}
  return json({ ok: true });
});
