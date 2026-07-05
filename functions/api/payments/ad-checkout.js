/**
 * v2.106.0: 공고 등록비(ad_orders) 토스페이먼츠 결제 준비 — GROWTH_PLAN Phase 1-1
 *
 *   POST /api/payments/ad-checkout
 *   body: { order_id }   (ad_orders.id — 공고 등록 응답의 order_id)
 *
 *   - 주문 조회(status='pending_payment' 만) → 토스 orderId 발급·저장
 *   - 응답: { ok, clientKey, orderId, amount, orderName, successUrl, failUrl }
 *   - 프론트는 이 정보로 토스 SDK requestPayment 호출. 무통장 입금은 백업으로 유지.
 *
 * 보안: 금액은 서버 final_price 만 사용(클라 전달값 무시). 개인정보(신청자명 등)는 응답에 넣지 않음.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { makeOrderId } from '../../_lib/tosspayments.js';
import { ensureOrderTables, ensureOrderTossCols } from '../../_lib/orders.js';

export const onRequestOptions = () => corsPreflight();

const AD_NAMES = { recruit: '채용 공고 등록비', lecture: '강의 공고 등록비', meetup: '모임 공고 등록비' };

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (isBot(request)) return error('forbidden', 403);
  if (!env.TOSS_CLIENT_KEY) return error('온라인 결제가 아직 활성화되지 않았습니다.', 503);

  const body = await request.json().catch(() => ({}));
  const orderId = parseInt(body?.order_id, 10);
  if (!Number.isFinite(orderId)) return error('order_id required');

  await ensureOrderTables(env);
  await ensureOrderTossCols(env);

  const order = await env.DB.prepare(`SELECT * FROM ad_orders WHERE id = ?`).bind(orderId).first();
  if (!order) return error('주문을 찾을 수 없습니다.', 404);
  if (order.status === 'paid') return error('이미 결제가 완료된 주문입니다.', 400);
  if (order.status !== 'pending_payment') return error('결제할 수 없는 주문 상태입니다: ' + order.status, 400);
  const amount = order.final_price || 0;
  if (amount < 100) return error('결제 금액이 없습니다. (전액 할인 등)', 400);

  // 토스 orderId — 결제 시도마다 새로 발급(재시도 충돌 방지). confirm 은 toss_order_id 로 역조회.
  const tossOrderId = makeOrderId('icad');
  await env.DB.prepare(`UPDATE ad_orders SET toss_order_id = ? WHERE id = ?`).bind(tossOrderId, order.id).run();

  const origin = new URL(request.url).origin;
  return json({
    ok: true,
    clientKey: env.TOSS_CLIENT_KEY,      // 공개 키 (프론트 SDK 초기화용)
    orderId: tossOrderId,
    amount,
    orderName: (AD_NAMES[order.ad_type] || '인슈어커넥트 공고 등록비') + ((order.options_price || 0) > 0 ? ' + 추가옵션' : ''),   // v2.107.0
    successUrl: `${origin}/?adpay=success`,   // 토스가 paymentKey·orderId·amount 쿼리 자동 부착
    failUrl: `${origin}/?adpay=fail`,
  });
});
