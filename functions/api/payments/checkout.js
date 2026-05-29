/**
 * v2.1.1 (master): 토스페이먼츠 결제 준비
 *
 *   POST /api/payments/checkout
 *   body: { product_id, email }
 *
 *   - 상품 조회 + pending purchase 생성 + orderId 발급
 *   - 응답: { orderId, amount, orderName, customerEmail, clientKey, successUrl, failUrl }
 *   - 프론트는 이 정보로 토스 SDK 호출 (requestPayment)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { makeOrderId } from '../../_lib/tosspayments.js';

export const onRequestOptions = () => corsPreflight();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (isBot(request)) return error('forbidden', 403);
  if (!env.TOSS_CLIENT_KEY) return error('TOSS_CLIENT_KEY 미설정 — wrangler secret 등록 필요', 500);

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

  // orderId 생성 (토스 고유 식별자)
  const orderId = makeOrderId('ic');

  // pending purchase 생성
  const ins = await env.DB.prepare(
    `INSERT INTO ic_purchases (product_id, email, amount_krw, status, toss_order_id)
     VALUES (?, ?, ?, 'pending', ?) RETURNING id`
  ).bind(productId, email, product.price_krw, orderId).first();
  const purchaseId = ins.id;

  const origin = new URL(request.url).origin;
  return json({
    ok: true,
    clientKey: env.TOSS_CLIENT_KEY,         // 프론트 SDK 초기화용 (공개 OK)
    orderId,
    amount: product.price_krw,
    orderName: product.name,
    customerEmail: email,
    purchaseId,
    successUrl: `${origin}/?purchase=success&purchase_id=${purchaseId}`,
    failUrl:    `${origin}/?purchase=fail&purchase_id=${purchaseId}`,
  });
});
