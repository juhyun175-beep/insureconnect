/**
 * v2.5.0: 카카오톡 "나에게 보내기"(memo) — 공고 알림 발송
 *   - 회원의 refresh_token으로 access_token 자동 갱신 후 발송
 *   - 토큰은 서버(D1)에만 저장, 클라이언트 노출 없음
 */
const SITE = 'https://insureconnect-hub.pages.dev';

async function refreshToken(env, member) {
  if (!member.kakao_refresh_token || !env.KAKAO_REST_KEY) return null;
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.KAKAO_REST_KEY,
    refresh_token: member.kakao_refresh_token,
  });
  if (env.KAKAO_CLIENT_SECRET) form.set('client_secret', env.KAKAO_CLIENT_SECRET);
  let t;
  try {
    const res = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form,
    });
    if (!res.ok) return null;
    t = await res.json();
  } catch (_) { return null; }
  if (!t.access_token) return null;
  const expires = t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null;
  try {
    if (t.refresh_token) {
      await env.DB.prepare(`UPDATE ic_members SET kakao_access_token=?, kakao_token_expires=?, kakao_refresh_token=? WHERE id=?`)
        .bind(t.access_token, expires, t.refresh_token, member.id).run();
    } else {
      await env.DB.prepare(`UPDATE ic_members SET kakao_access_token=?, kakao_token_expires=? WHERE id=?`)
        .bind(t.access_token, expires, member.id).run();
    }
  } catch (_) {}
  return t.access_token;
}

async function validToken(env, member) {
  const exp = member.kakao_token_expires ? new Date(member.kakao_token_expires).getTime() : 0;
  if (member.kakao_access_token && exp > Date.now() + 60000) return member.kakao_access_token;
  return await refreshToken(env, member);
}

/** 회원에게 카카오톡 메모 발송 → {ok, error?, revoked?} */
export async function sendMemoToMember(env, member, { title, description, url, image }) {
  const token = await validToken(env, member);
  if (!token) return { ok: false, error: 'no_token', revoked: true };
  const link = { web_url: url || SITE, mobile_web_url: url || SITE };
  const templateObject = {
    object_type: 'feed',
    content: {
      title: String(title || '').slice(0, 200),
      description: String(description || '').slice(0, 400),
      image_url: image || `${SITE}/logo-full.png`,
      link,
    },
    buttons: [{ title: '자세히 보기', link }],
  };
  try {
    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `send_${res.status}`, revoked: res.status === 401 || res.status === 403 };
  } catch (_) {
    return { ok: false, error: 'fetch_fail' };
  }
}
