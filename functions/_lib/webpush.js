/**
 * v2.1.43: Cloudflare Workers 호환 Web Push 발송 헬퍼
 *
 *   - VAPID JWT 서명 (ES256 / ECDSA P-256)
 *   - 메시지 암호화 (aes128gcm, RFC 8291)
 *   - 푸시 서비스 POST (FCM, Mozilla, Apple Web Push 등)
 *
 * 외부 npm 의존성 0 — 모두 Web Crypto API 만 사용.
 *
 * 사용:
 *   import { sendWebPush } from '../_lib/webpush.js';
 *   await sendWebPush({
 *     subscription: { endpoint, keys: { p256dh, auth } },
 *     payload: { title, body, url },
 *     vapid: { publicKey, privateKey, subject: 'mailto:admin@example.com' }
 *   });
 */

// ── base64url helpers ─────────────────────────────────────────
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
const concat = (...arrs) => {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
};
const utf8 = (s) => new TextEncoder().encode(s);

// ── ECDSA P-256 JWK 변환 ──────────────────────────────────────
function rawPublicKeyToJwk(rawBytes) {
  // 65 bytes: 0x04 || X(32) || Y(32)
  if (rawBytes.length !== 65 || rawBytes[0] !== 0x04) {
    throw new Error('Invalid uncompressed P-256 public key');
  }
  return {
    kty: 'EC', crv: 'P-256',
    x: b64uEncode(rawBytes.slice(1, 33)),
    y: b64uEncode(rawBytes.slice(33, 65)),
    ext: true,
  };
}
function rawPrivateKeyToJwk(rawPrivBytes, rawPubBytes) {
  const jwk = rawPublicKeyToJwk(rawPubBytes);
  jwk.d = b64uEncode(rawPrivBytes);
  return jwk;
}

// ── VAPID JWT (ES256) 서명 ─────────────────────────────────────
async function signVapidJwt({ audience, subject, publicKeyB64u, privateKeyB64u }) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12시간
    sub: subject,
  };
  const headerB64  = b64uEncode(utf8(JSON.stringify(header)));
  const payloadB64 = b64uEncode(utf8(JSON.stringify(payload)));
  const signingInput = utf8(`${headerB64}.${payloadB64}`);

  const pubRaw = b64uDecode(publicKeyB64u);
  const privRaw = b64uDecode(privateKeyB64u);

  const key = await crypto.subtle.importKey(
    'jwk', rawPrivateKeyToJwk(privRaw, pubRaw),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput);
  const sigBytes = new Uint8Array(sig);
  // crypto.subtle ECDSA returns raw R||S 64 bytes — exactly what JOSE expects
  const sigB64 = b64uEncode(sigBytes);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// ── HKDF (RFC 5869) ───────────────────────────────────────────
async function hkdf(salt, ikm, info, length) {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey, length * 8
  );
  return new Uint8Array(bits);
}

// ── ECDH P-256 공유 비밀 ──────────────────────────────────────
async function deriveEcdhSecret(localPrivateKey, peerPublicRaw) {
  const peer = await crypto.subtle.importKey(
    'jwk', rawPublicKeyToJwk(peerPublicRaw),
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, localPrivateKey, 256);
  return new Uint8Array(bits);
}

// ── aes128gcm payload 암호화 (RFC 8291) ───────────────────────
async function encryptPayload(payloadBytes, recipientPubRaw, recipientAuth) {
  // 1) 임시 ECDH 키쌍 생성
  const ephKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const ephPubJwk = await crypto.subtle.exportKey('jwk', ephKeyPair.publicKey);
  const ephPubRaw = concat(
    new Uint8Array([0x04]),
    b64uDecode(ephPubJwk.x),
    b64uDecode(ephPubJwk.y)
  );

  // 2) ECDH 공유 비밀
  const ecdhSecret = await deriveEcdhSecret(ephKeyPair.privateKey, recipientPubRaw);

  // 3) IKM = HKDF(auth_secret, ecdhSecret, info="WebPush: info\0|ua_public|as_public", 32)
  const authInfo = concat(
    utf8('WebPush: info\0'),
    recipientPubRaw,
    ephPubRaw
  );
  const ikm = await hkdf(recipientAuth, ecdhSecret, authInfo, 32);

  // 4) salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5) CEK (aes128gcm key, 16 bytes) + Nonce (12 bytes)
  const cek   = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'),     12);

  // 6) 플레인텍스트 패딩: payload || 0x02 || padding(...) — recordsize 한도 내
  // 간단화: 1개 record 만 사용 (4096-103 bytes 까지 가능)
  const plaintext = concat(payloadBytes, new Uint8Array([0x02])); // 마지막 record 표시
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, cekKey, plaintext
  ));

  // 7) 헤더 = salt(16) | rs(4 BE) | idlen(1) | keyid(idlen) — aes128gcm format
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concat(salt, rs, new Uint8Array([ephPubRaw.length]), ephPubRaw);

  return concat(header, ciphertext);
}

/**
 * Web Push 전송
 * @returns {Promise<{ok:boolean, status:number, statusText?:string, removed?:boolean}>}
 */
export async function sendWebPush({ subscription, payload, vapid, ttl = 86400 }) {
  if (!subscription?.endpoint) throw new Error('Missing endpoint');
  if (!subscription?.keys?.p256dh || !subscription?.keys?.auth) throw new Error('Missing keys');
  if (!vapid?.publicKey || !vapid?.privateKey || !vapid?.subject) throw new Error('Missing VAPID config');

  const endpoint = subscription.endpoint;
  const aud = new URL(endpoint).origin;

  const jwt = await signVapidJwt({
    audience: aud, subject: vapid.subject,
    publicKeyB64u: vapid.publicKey, privateKeyB64u: vapid.privateKey,
  });

  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const payloadBytes = utf8(payloadStr);
  const recipientPubRaw = b64uDecode(subscription.keys.p256dh);
  const recipientAuth   = b64uDecode(subscription.keys.auth);
  const encrypted = await encryptPayload(payloadBytes, recipientPubRaw, recipientAuth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'TTL': String(ttl),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Authorization': `vapid t=${jwt}, k=${vapid.publicKey}`,
      'Urgency': 'normal',
    },
    body: encrypted,
  });

  // 404/410: 만료된 구독 → 정리 신호
  const removed = res.status === 404 || res.status === 410;
  return { ok: res.ok, status: res.status, statusText: res.statusText, removed };
}
