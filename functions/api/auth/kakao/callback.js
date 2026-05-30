/**
 * v2.2.1: 카카오 로그인 콜백 — GET /api/auth/kakao/callback
 *   code→token 교환 → 사용자 정보 → ic_users upsert → 세션 생성 → 쿠키 + 홈 리다이렉트
 */
import { SITE, parseCookies, cookie, createSession } from '../../../_lib/auth.js';

const home = (reason) => new Response(null, { status: 302, headers: { 'Location': `${SITE}/?login=${reason}` } });

export const onRequestGet = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const savedState = parseCookies(request)['ic_oauth_state'];
    if (!code || !state || !savedState || state !== savedState) return home('csrf');
    if (!env.KAKAO_REST_KEY) return home('unconfigured');

    const redirectUri = `${SITE}/api/auth/kakao/callback`;
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.KAKAO_REST_KEY,
      redirect_uri: redirectUri,
      code,
    });
    if (env.KAKAO_CLIENT_SECRET) form.set('client_secret', env.KAKAO_CLIENT_SECRET);

    const tokRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: form,
    });
    if (!tokRes.ok) return home('token_fail');
    const tok = await tokRes.json();
    const accessToken = tok.access_token;
    if (!accessToken) return home('token_fail');

    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!meRes.ok) return home('me_fail');
    const me = await meRes.json();
    const kakaoId = String(me.id);
    const profile = (me.kakao_account && me.kakao_account.profile) || {};
    const nickname = String(profile.nickname || '회원').slice(0, 40);
    const profileImage = profile.thumbnail_image_url || profile.profile_image_url || null;
    const email = (me.kakao_account && me.kakao_account.email) || null;

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ic_members (kakao_id, nickname, profile_image, email, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(kakao_id) DO UPDATE SET nickname=excluded.nickname, profile_image=excluded.profile_image, last_login=excluded.last_login`
    ).bind(kakaoId, nickname, profileImage, email, now, now).run();
    const row = await env.DB.prepare(`SELECT id FROM ic_members WHERE kakao_id = ?`).bind(kakaoId).first();

    const { token, maxAge } = await createSession(env, row.id, request.headers.get('User-Agent'));
    const headers = new Headers();
    headers.append('Set-Cookie', cookie('ic_sess', token, { maxAge }));
    headers.append('Set-Cookie', cookie('ic_oauth_state', '', { clear: true }));
    headers.set('Location', `${SITE}/?login=success`);
    return new Response(null, { status: 302, headers });
  } catch (_) {
    return home('error');
  }
};
