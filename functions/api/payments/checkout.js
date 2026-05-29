/**
 * v2.1.0: Stripe Checkout 세션 생성
 *
 *   POST /api/payments/checkout
 *   body: { product_id, email }
 *
 *   - 활성 상품 조회
 *   - pending purchase row 생성
 *   - Stripe Checkout Session 생성 (metadata 에 purchase_id 박음)
 *   - 응답: { url: "https://checkout.stripe.com/..." }
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { createCheckoutSession } from '../../_lib/stripe.js';

export const onRequestOptions = () => corsPreflight();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (isBot(request)) return error('forbidden', 403);
  if (!env.STRIPE_SECRET_KEY) return error('STRIPE_SECRET_KEY 미설정 — wrangler secret 등록 필요', 500);

  const body = await request.json().catch(() => ({}));
  const productId = parseInt(body?.product_id, 10);
  const email = String(body?.email || '').trim().toLowerCase();
  if (!Number.isFinite(productId)) return error('product_id required');
  if (!EMAIL_RE.test(email) || email.length > 200) return error('Invalid email');

  // 상품 조회
  const product = await env.DB.prepare(
    `SELECT * FROM ic_products WHERE id = ? AND active = 1`
  ).bind(productId).first();
  if (!product) return error('Product not found', 404);
  if (!product.price_krw || product.price_krw < 100) return error('Invalid product price', 500);

  // pending purchase 생성 (Stripe metadata 에 ID 박음)
  const ins = await env.DB.prepare(
    `INSERT INTO ic_purchases (product_id, email, amount_krw, status)
     VALUES (?, ?, ?, 'pending') RETURNING id`
  ).bind(productId, email, product.price_krw).first();
  const purchaseId = ins.id;

  const origin = new URL(request.url).origin;
  let stripeSession;
  try {
    stripeSession = await createCheckoutSession({
      amount_krw: product.price_krw,
      productName: product.name,
      productImage: null, // 향후 cover 이미지 연결
      successUrl: `${origin}/?purchase=success&purchase_id=${purchaseId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${origin}/?purchase=cancelled&purchase_id=${purchaseId}`,
      customerEmail: email,
      metadata: {
        purchase_id: String(purchaseId),
        product_id: String(productId),
        product_slug: product.slug,
        email,
      },
      env,
    });
  } catch (e) {
    // 실패 시 pending row 정리
    await env.DB.prepare(
      `UPDATE ic_purchases SET status = 'failed', failed_reason = ? WHERE id = ?`
    ).bind(e.message.slice(0, 300), purchaseId).run().catch(() => {});
    return error('Stripe 세션 생성 실패: ' + e.message, 500);
  }

  // session_id 기록 (webhook 대조용)
  await env.DB.prepare(
    `UPDATE ic_purchases SET stripe_session_id = ? WHERE id = ?`
  ).bind(stripeSession.id, purchaseId).run();

  return json({
    ok: true,
    url: stripeSession.url,
    purchase_id: purchaseId,
    session_id: stripeSession.id,
  });
});
