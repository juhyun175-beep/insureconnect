/**
 * v2.2.1: 현재 로그인 회원 — GET /api/auth/me  →  { user: {id,nickname,profile_image} | null }
 */
import { json, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestGet = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  // login_enabled=false 면 프론트에서 로그인 버튼 숨김 (미설정 기능 노출 방지)
  return json({ user: user || null, login_enabled: !!env.KAKAO_REST_KEY });
};
