/**
 * v2.1.0 (master): Stripe API 헬퍼 — 외부 npm 의존성 0
 *
 *   createCheckoutSession({ amount_krw, productName, productImage,
 *                            successUrl, cancelUrl, metadata, customerEmail, env })
 *   verifyWebhookSignature(rawBody, signatureHeader, secret)
 *   retrieveSession(sessionId, env)
 */

const STRIPE_API = 'https://api.stripe.com/v1';

/** form-urlencoded 직렬화 — Stripe API 는 nested object 를 brackets 표기로 받음 */
function encodeForm(obj, prefix) {
  const parts = [];
  for (const k in obj) {
    if (obj[k] === undefined || obj[k] === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    const v = obj[k];
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') parts.push(encodeForm(item, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === 'object') {
      parts.push(encodeForm(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join('&');
}

async function stripeFetch(path, env, { method = 'POST', body } = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY 미설정');
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20',
    },
    body: body || undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Stripe ${res.status}`;
    const e = new Error(msg);
    e.stripe = json?.error;
    throw e;
  }
  return json;
}

/** Stripe Checkout Session 생성 */
export async function createCheckoutSession({
  amount_krw, productName, productImage, successUrl, cancelUrl,
  metadata, customerEmail, env,
}) {
  const params = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'krw',
        unit_amount: amount_krw,        // KRW 는 정수 (₩100 = 100)
        product_data: {
          name: productName,
          ...(productImage ? { images: [productImage] } : {}),
        },
      },
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    ...(metadata ? { metadata } : {}),
    locale: 'ko',
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
  };
  const body = encodeForm(params);
  return stripeFetch('/checkout/sessions', env, { body });
}

/** 결제 세션 조회 */
export async function retrieveSession(sessionId, env) {
  return stripeFetch(`/checkout/sessions/${sessionId}`, env, { method: 'GET' });
}

/* ──────────────── Webhook signature 검증 ──────────────── */
/** Stripe 헤더: t=timestamp,v1=hex,v1=hex,... */
function parseStripeSig(header) {
  const out = { t: null, v1: [] };
  for (const part of String(header || '').split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 't') out.t = v;
    else if (k === 'v1') out.v1.push(v);
  }
  return out;
}

/** hex string → Uint8Array */
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
 * Stripe webhook signature 검증 (HMAC-SHA256)
 *   @param rawBody  Stripe 가 보낸 본문 string (수정 없이 받아야 함)
 *   @param sigHeader  request.headers.get('Stripe-Signature')
 *   @param secret   STRIPE_WEBHOOK_SECRET (whsec_...)
 *   @param tolSec   timestamp tolerance (기본 5분)
 *   @returns parsed event payload 또는 throw
 */
export async function verifyWebhookSignature(rawBody, sigHeader, secret, tolSec = 300) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET 미설정');
  if (!sigHeader) throw new Error('Stripe-Signature 헤더 없음');
  const { t, v1 } = parseStripeSig(sigHeader);
  if (!t || v1.length === 0) throw new Error('Stripe-Signature 파싱 실패');

  // replay 방지 — 5분 이내만 허용
  const tsec = parseInt(t, 10);
  if (!Number.isFinite(tsec)) throw new Error('Invalid timestamp');
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsec) > tolSec) throw new Error('Timestamp out of tolerance');

  // signedPayload = "{t}.{rawBody}"
  const signedPayload = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  );

  const valid = v1.some(hex => {
    try { return timingSafeEqualBytes(sigBytes, hexToBytes(hex)); }
    catch { return false; }
  });
  if (!valid) throw new Error('Signature mismatch');

  try { return JSON.parse(rawBody); }
  catch (_) { throw new Error('Invalid JSON body'); }
}

/** URL-safe random token (다운로드 토큰용) */
export function randomToken(byteLen = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(byteLen));
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
