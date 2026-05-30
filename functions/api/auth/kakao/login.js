/**
 * v2.2.1: 카카오 로그인 시작 — GET /api/auth/kakao/login
 *   state(CSRF) 쿠키 설정 후 카카오 인증 페이지로 리다이렉트
 */
import { SITE, cookie, randomToken } from '../../../_lib/auth.js';

export const onRequestGet = async ({ env }) => {
  if (!env.KAKAO_REST_KEY) {
    return new Response(null, { status: 302, headers: { 'Location': `${SITE}/?login=unconfigured` } });
  }
  const state = randomToken().slice(0, 24);
  const redirectUri = `${SITE}/api/auth/kakao/callback`;
  const authUrl = 'https://kauth.kakao.com/oauth/authorize'
    + `?response_type=code&client_id=${encodeURIComponent(env.KAKAO_REST_KEY)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
    + `&scope=${encodeURIComponent('profile_nickname,profile_image')}`;
  return new Response(null, {
    status: 302,
    headers: { 'Location': authUrl, 'Set-Cookie': cookie('ic_oauth_state', state, { maxAge: 600 }) },
  });
};
