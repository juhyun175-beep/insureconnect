/**
 * v2.2.1: 카카오 로그인 콜백 — GET /api/auth/kakao/callback
 *   code→token 교환 → 사용자 정보 → ic_users upsert → 세션 생성 → 쿠키 + 홈 리다이렉트
 */
import { SITE, parseCookies, cookie, createSession } from '../../../_lib/auth.js';
import { resolveReferrer, recordReferralAndMaybeUpgrade } from '../../../_lib/referral.js';

const home = (reason) => new Response(null, { status: 302, headers: { 'Location': `${SITE}/?login=${reason}` } });

// v2.80.0: 관리자 문의 오픈채팅(사이트 연락처와 동일). 차단 안내 페이지에서 사용.
const ADMIN_KAKAO = 'https://open.kakao.com/o/sAZWQ7pi';
const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 차단된 회원 로그인 시도 시 보여줄 안내 페이지(자기완결 HTML). */
function bannedHtml(nick) {
  const n = escHtml(nick || '회원');
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>로그인 제한 안내 · 인슈어커넥트</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#0f172a,#1e1b4b 55%,#3b0764)}
  .card{background:#fff;border-radius:22px;max-width:420px;width:100%;padding:38px 30px 28px;box-shadow:0 24px 70px rgba(0,0,0,.42);text-align:center}
  .ico{width:74px;height:74px;border-radius:50%;background:linear-gradient(135deg,#fef2f2,#fee2e2);display:flex;align-items:center;justify-content:center;font-size:38px;margin:0 auto 18px}
  h1{font-size:21px;font-weight:900;letter-spacing:-.4px;margin-bottom:11px;color:#dc2626}
  p{font-size:14px;line-height:1.65;color:#475569}
  p .nick{font-weight:800;color:#1a3de8}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:13px;padding:14px 15px;margin:18px 0 22px;font-size:13px;color:#64748b;line-height:1.62}
  .kbtn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:15px;border-radius:13px;background:#fee500;color:#191600;font-size:15.5px;font-weight:800;text-decoration:none;box-shadow:0 7px 20px rgba(254,229,0,.5)}
  .kbtn:active{transform:translateY(1px)}
  .home{display:inline-block;margin-top:15px;font-size:13px;color:#94a3b8;text-decoration:none;font-weight:700}
  .brand{margin-top:20px;font-size:11px;color:#cbd5e1;letter-spacing:.05em}
</style></head>
<body>
  <div class="card">
    <div class="ico">🚫</div>
    <h1>로그인이 제한되었습니다</h1>
    <p><span class="nick">${n}</span>님, 회원님 계정은 운영 정책에 따라<br>현재 <b>이용이 제한</b>되어 있습니다.</p>
    <div class="box">제한 사유 확인 또는 <b>해제 문의</b>는 아래 관리자 문의방으로 연락해 주세요. 확인 후 신속히 안내드리겠습니다.</div>
    <a class="kbtn" href="${ADMIN_KAKAO}" target="_blank" rel="noopener noreferrer">💬 관리자에게 문의하기</a>
    <a class="home" href="${SITE}/">홈으로 돌아가기</a>
    <div class="brand">InsureConnect · 인슈어커넥트</div>
  </div>
</body></html>`;
}

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
    // 카톡 메시지(공고 알림)용 토큰 + 동의 여부
    const refreshToken = tok.refresh_token || null;
    const tokenExpires = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null;
    const optin = String(tok.scope || '').includes('talk_message') ? 1 : 0;

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

    // v2.8.0: 신규 가입 여부 (추천 귀속은 신규에만)
    const existing = await env.DB.prepare(`SELECT id FROM ic_members WHERE kakao_id = ?`).bind(kakaoId).first();
    const isNew = !existing;

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ic_members (kakao_id, nickname, profile_image, email, created_at, last_login, kakao_access_token, kakao_refresh_token, kakao_token_expires, alert_optin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kakao_id) DO UPDATE SET
         nickname=excluded.nickname, profile_image=excluded.profile_image, last_login=excluded.last_login,
         kakao_access_token=excluded.kakao_access_token,
         kakao_refresh_token=COALESCE(excluded.kakao_refresh_token, ic_members.kakao_refresh_token),
         kakao_token_expires=excluded.kakao_token_expires,
         alert_optin=excluded.alert_optin`
    ).bind(kakaoId, nickname, profileImage, email, now, now, accessToken, refreshToken, tokenExpires, optin).run();
    const row = await env.DB.prepare(`SELECT id FROM ic_members WHERE kakao_id = ?`).bind(kakaoId).first();

    // v2.80.0: 관리자가 차단한 회원은 로그인 거부 — 세션 미생성 + 안내 페이지(관리자 문의 카톡방) 노출
    const isBannedRow = await env.DB.prepare(`SELECT member_id FROM ic_banned_members WHERE member_id = ?`).bind(row.id).first().catch(() => null);
    if (isBannedRow) {
      const bh = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      bh.append('Set-Cookie', cookie('ic_oauth_state', '', { clear: true }));
      return new Response(bannedHtml(nickname), { status: 403, headers: bh });
    }

    // v2.8.0: 신규 회원이면 추천 귀속 + 임계값 도달 시 추천인 자동 등급업
    const cookies = parseCookies(request);
    if (isNew && cookies['ic_ref']) {
      const referrerId = await resolveReferrer(env, cookies['ic_ref']);
      if (referrerId) await recordReferralAndMaybeUpgrade(env, referrerId, row.id);
    }

    const { token, maxAge } = await createSession(env, row.id, request.headers.get('User-Agent'));
    const headers = new Headers();
    headers.append('Set-Cookie', cookie('ic_sess', token, { maxAge }));
    headers.append('Set-Cookie', cookie('ic_oauth_state', '', { clear: true }));
    headers.append('Set-Cookie', cookie('ic_ref', '', { clear: true }));
    // v2.16.5: 신규 가입자는 welcome=1 → 홈 온보딩 모달(활성화·추천 유도)
    headers.set('Location', `${SITE}/?login=success${isNew ? '&welcome=1' : ''}`);
    return new Response(null, { status: 302, headers });
  } catch (_) {
    return home('error');
  }
};
