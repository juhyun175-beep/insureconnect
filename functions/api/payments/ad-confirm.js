/**
 * v2.106.0: 공고 등록비(ad_orders) 토스페이먼츠 결제 승인 확정 — GROWTH_PLAN Phase 1-1
 *
 *   POST /api/payments/ad-confirm
 *   body: { paymentKey, orderId, amount }   (토스 successUrl 쿼리 그대로)
 *
 *   - ad_orders 를 toss_order_id 로 역조회 → 금액 일치 검증(변조 방지) → 토스 confirm
 *   - 성공 시 status='paid' + paid_at + 결제수단/영수증 기록
 *   - 이미 paid 면 멱등 응답. confirm 실패 시 주문은 pending_payment 유지(무통장 백업 살아있음).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { confirmPayment } from '../../_lib/tosspayments.js';
import { ensureOrderTables, ensureOrderTossCols } from '../../_lib/orders.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const body = await request.json().catch(() => ({}));
  const paymentKey = String(body?.paymentKey || '').trim();
  const orderId = String(body?.orderId || '').trim();
  const amount = parseInt(body?.amount, 10);
  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return error('paymentKey, orderId, amount 필수');
  }

  await ensureOrderTables(env);
  await ensureOrderTossCols(env);

  const order = await env.DB.prepare(
    `SELECT * FROM ad_orders WHERE toss_order_id = ? LIMIT 1`
  ).bind(orderId).first();
  if (!order) return error('주문을 찾을 수 없습니다.', 404);

  // 멱등성 — 중복 호출(새로고침 등) 안전
  if (order.status === 'paid') {
    return json({ ok: true, order_id: order.id, already_paid: true, receipt_url: order.toss_receipt_url, method: order.toss_method });
  }
  if (order.status !== 'pending_payment') {
    return error('결제할 수 없는 주문 상태입니다: ' + order.status, 400);
  }
  if ((order.final_price || 0) !== amount) {
    return error(`금액 불일치 (서버: ${order.final_price}, 클라: ${amount})`, 400);
  }

  let tossResult;
  try {
    tossResult = await confirmPayment({ paymentKey, orderId, amount, env });
  } catch (e) {
    // 승인 실패 — 주문은 입금대기 그대로 (무통장 백업 유지)
    return error('결제 승인 실패: ' + e.message, e.status || 500);
  }

  const method = tossResult.method || tossResult.easyPay?.provider || null;
  const receiptUrl = tossResult.receipt?.url || null;
  await env.DB.prepare(
    `UPDATE ad_orders
     SET status='paid', toss_payment_key=?, toss_method=?, toss_receipt_url=?, paid_at=datetime('now')
     WHERE id=?`
  ).bind(paymentKey, method, receiptUrl, order.id).run();

  return json({ ok: true, order_id: order.id, method, receipt_url: receiptUrl });
});
