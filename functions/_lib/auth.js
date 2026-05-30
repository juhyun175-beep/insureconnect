/**
 * v2.2.1: 회원 세션 — 카카오 로그인용 (opaque 토큰 + DB 저장, 토큰은 해시로 저장)
 *   쿠키: ic_sess (httpOnly, Secure, SameSite=Lax)
 */
export const SITE = 'https://insureconnect-hub.pages.dev';
const SESSION_DAYS = 30;

export function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function parseCookies(request) {
  const h = request.headers.get('Cookie') || '';
  const out = {};
  h.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
export function cookie(name, value, { maxAge, clear = false } = {}) {
  const parts = [`${name}=${clear ? '' : encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (clear) parts.push('Max-Age=0');
  else if (maxAge) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export async function createSession(env, userId, ua) {
  const token = randomToken();
  const hash = await sha256hex(token);
  const now = Date.now();
  const expires = new Date(now + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare(
    `INSERT INTO ic_sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)`
  ).bind(hash, userId, new Date(now).toISOString(), expires, String(ua || '').slice(0, 200)).run();
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export async function getUserFromRequest(env, request) {
  try {
    const token = parseCookies(request)['ic_sess'];
    if (!token) return null;
    const hash = await sha256hex(token);
    const row = await env.DB.prepare(
      `SELECT u.id, u.nickname, u.profile_image, u.kakao_id, s.expires_at
       FROM ic_sessions s JOIN ic_users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    ).bind(hash).first();
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await env.DB.prepare(`DELETE FROM ic_sessions WHERE token_hash = ?`).bind(hash).run().catch(() => {});
      return null;
    }
    return { id: row.id, nickname: row.nickname, profile_image: row.profile_image };
  } catch (_) { return null; }
}

export async function deleteSession(env, request) {
  try {
    const token = parseCookies(request)['ic_sess'];
    if (!token) return;
    const hash = await sha256hex(token);
    await env.DB.prepare(`DELETE FROM ic_sessions WHERE token_hash = ?`).bind(hash).run();
  } catch (_) {}
}
