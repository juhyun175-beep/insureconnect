/**
 * v2.0.0 Sprint 2: HMAC-SHA256 JWT 헬퍼
 * 외부 npm 의존성 0 — Web Crypto API 만 사용
 *
 * 사용:
 *   const token = await signJwt({ sub: userId, role }, env.JWT_SECRET, 7 * 86400);
 *   const payload = await verifyJwt(token, env.JWT_SECRET);
 */

const b64uEncode = (bytes) => {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64uDecode = (str) => {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const raw = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};
const utf8 = (s) => new TextEncoder().encode(s);
const utf8d = (b) => new TextDecoder().decode(b);

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

/** JWT 생성 — payload 에 jti/iat/exp 자동 주입 */
export async function signJwt(payload, secret, expSec = 7 * 86400) {
  if (!secret) throw new Error('JWT secret missing');
  const header  = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID().replace(/-/g, '');
  const body = { ...payload, iat: now, exp: now + expSec, jti };

  const hB = b64uEncode(utf8(JSON.stringify(header)));
  const pB = b64uEncode(utf8(JSON.stringify(body)));
  const signingInput = `${hB}.${pB}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, utf8(signingInput));
  const sB = b64uEncode(new Uint8Array(sig));
  return { token: `${signingInput}.${sB}`, jti, exp: body.exp };
}

/** JWT 검증 — 만료/서명 모두 체크. 실패 시 null 반환 */
export async function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const [hB, pB, sB] = parts;
    const key = await importHmacKey(secret);
    const ok = await crypto.subtle.verify(
      'HMAC', key,
      b64uDecode(sB), utf8(`${hB}.${pB}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(utf8d(b64uDecode(pB)));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    return payload;
  } catch (_) { return null; }
}

/** Cookie 파서 — 'ic_session' 쿠키에서 JWT 추출 */
export function parseCookie(request, name = 'ic_session') {
  const h = request.headers.get('Cookie') || '';
  for (const c of h.split(';')) {
    const [k, ...v] = c.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** httpOnly 세션 쿠키 생성 */
export function sessionCookie(token, expSec) {
  const opts = [
    `ic_session=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${expSec}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  return opts.join('; ');
}

/** 로그아웃용 — Max-Age=0 */
export function clearSessionCookie() {
  return 'ic_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
}
