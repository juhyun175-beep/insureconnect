/**
 * v2.1.1 (master): 토스페이먼츠 API 헬퍼 — 외부 npm 의존성 0
 *
 *   confirmPayment({ paymentKey, orderId, amount, env })
 *      → POST /v1/payments/confirm
 *   cancelPayment({ paymentKey, cancelReason, env })
 *      → POST /v1/payments/{paymentKey}/cancel
 *   verifyWebhookSignature(rawBody, header, secret)
 *      → HMAC-SHA256 검증 (Stripe 패턴과 동일)
 *   randomToken / makeOrderId 유틸
 */

const TOSS_API = 'https://api.tosspayments.com';

/** Basic auth — 토스는 `${secretKey}:` (콜론 포함) 을 base64 인코딩 */
function basicAuthHeader(secretKey) {
  return 'Basic ' + btoa(`${secretKey}:`);
}

async function tossFetch(path, env, { method = 'POST', body } = {}) {
  if (!env.TOSS_SECRET_KEY) throw new Error('TOSS_SECRET_KEY 미설정');
  const res = await fetch(`${TOSS_API}${path}`, {
    method,
    headers: {
      Authorization: basicAuthHeader(env.TOSS_SECRET_KEY),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.message || json?.code || `Toss ${res.status}`;
    const e = new Error(msg);
    e.toss = json;
    e.status = res.status;
    throw e;
  }
  return json;
}

/** 결제 승인 — successUrl 에서 호출
 *  주의: amount 가 결제 요청 시와 정확히 일치해야 함 (변조 방지) */
export async function confirmPayment({ paymentKey, orderId, amount, env }) {
  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    throw new Error('paymentKey, orderId, amount 필수');
  }
  return tossFetch('/v1/payments/confirm', env, {
    body: { paymentKey, orderId, amount },
  });
}

/** 결제 취소 (관리자 환불용) — cancelAmount 지정 시 부분취소 (v2.106.0) */
export async function cancelPayment({ paymentKey, cancelReason, cancelAmount, env }) {
  if (!paymentKey) throw new Error('paymentKey 필수');
  const body = { cancelReason: cancelReason || '사용자 요청 환불' };
  if (Number.isFinite(cancelAmount) && cancelAmount > 0) body.cancelAmount = cancelAmount;
  return tossFetch(`/v1/payments/${paymentKey}/cancel`, env, { body });
}

/** 결제 조회 */
export async function retrievePayment(paymentKey, env) {
  return tossFetch(`/v1/payments/${paymentKey}`, env, { method: 'GET' });
}

/* ──────────────── Webhook signature 검증 ──────────────── */
function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}
function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * 토스 Webhook 서명 검증 (HMAC-SHA256)
 *  토스 webhook 시그니처는 등록 시 받은 시크릿으로 HMAC-SHA256 한 본문 해시.
 *  헤더 형식 변동에 대비해 t=... / v=... / hex / base64 모두 처리.
 *
 *  @param rawBody    raw body string
 *  @param sigHeader  request.headers.get('TossPayments-Webhook-Signature')
 *  @param secret     TOSS_WEBHOOK_SECRET
 *  @returns parsed event (object) — 검증 실패 시 throw
 */
export async function verifyWebhookSignature(rawBody, sigHeader, secret) {
  if (!secret) throw new Error('TOSS_WEBHOOK_SECRET 미설정');
  if (!sigHeader) throw new Error('Toss webhook signature 헤더 없음');

  // 헤더 파싱: "t=12345,v=abcdef..." 또는 단순 "abcdef..." (hex/base64)
  let timestamp = null;
  const sigs = [];
  for (const part of String(sigHeader).split(',')) {
    const tr = part.trim();
    if (tr.startsWith('t=')) timestamp = tr.slice(2);
    else if (tr.startsWith('v=') || tr.startsWith('v1=')) sigs.push(tr.split('=').slice(1).join('='));
    else sigs.push(tr);
  }
  if (sigs.length === 0) throw new Error('서명 값 파싱 실패');

  const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  );

  // hex 비교 + base64 비교
  const sigHex = Array.from(sigBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const sigB64 = btoa(String.fromCharCode(...sigBytes));

  const valid = sigs.some(s => {
    const cleaned = s.replace(/\s+/g, '');
    if (cleaned.toLowerCase() === sigHex.toLowerCase()) return true;
    if (cleaned === sigB64) return true;
    // hex 길이 (64 char) 면 바이트 비교
    if (/^[0-9a-f]+$/i.test(cleaned) && cleaned.length === 64) {
      try { return timingSafeEqualBytes(sigBytes, hexToBytes(cleaned)); } catch { return false; }
    }
    return false;
  });
  if (!valid) throw new Error('Webhook signature mismatch');

  try { return JSON.parse(rawBody); }
  catch (_) { throw new Error('Invalid JSON body'); }
}

/* ──────────────── 유틸 ──────────────── */
/** orderId 생성 — 토스 요구 최소 6자, 최대 64자 (영숫자/언더스코어/하이픈) */
export function makeOrderId(prefix = 'ic') {
  const ts = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(36)).join('').slice(0, 12);
  return `${prefix}_${ts}_${rand}`;
}

/** URL-safe random token (다운로드 토큰용) */
export function randomToken(byteLen = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(byteLen));
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
