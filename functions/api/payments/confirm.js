/**
 * v2.1.1 (master): 토스페이먼츠 결제 승인 확정
 *
 *   POST /api/payments/confirm
 *   body: { paymentKey, orderId, amount }
 *
 *   - DB 의 pending purchase 조회 (orderId 매칭)
 *   - amount 일치 검증 (변조 방지)
 *   - 토스 confirm API 호출
 *   - status=paid + download_token 발급 + paid_at 기록
 *   - 응답: { ok, purchase_id, download_token, download_url }
 *
 * 보안: 클라이언트가 보낸 amount 가 DB 의 amount_krw 와 일치하지 않으면 거부.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { confirmPayment, randomToken } from '../../_lib/tosspayments.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const body = await request.json().catch(() => ({}));
  const paymentKey = String(body?.paymentKey || '').trim();
  const orderId = String(body?.orderId || '').trim();
  const amount = parseInt(body?.amount, 10);
  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return error('paymentKey, orderId, amount 필수');
  }

  // 1) DB 의 purchase 조회 — orderId 매칭
  const row = await env.DB.prepare(
    `SELECT p.*, pr.name AS product_name, pr.download_filename
     FROM ic_purchases p
     JOIN ic_products pr ON pr.id = p.product_id
     WHERE p.toss_order_id = ? LIMIT 1`
  ).bind(orderId).first();
  if (!row) return error('주문을 찾을 수 없습니다', 404);

  // 이미 paid 된 경우 — 멱등성 (중복 호출 안전)
  if (row.status === 'paid' && row.download_token) {
    return json({
      ok: true,
      purchase_id: row.id,
      download_token: row.download_token,
      download_url: `/api/downloads/${row.download_token}`,
      product_name: row.product_name,
      download_filename: row.download_filename,
      already_paid: true,
    });
  }

  // 2) amount 변조 방지
  if (row.amount_krw !== amount) {
    return error(`금액 불일치 (서버: ${row.amount_krw}, 클라: ${amount})`, 400);
  }

  // 3) 토스 confirm API 호출
  let tossResult;
  try {
    tossResult = await confirmPayment({ paymentKey, orderId, amount, env });
  } catch (e) {
    await env.DB.prepare(
      `UPDATE ic_purchases SET status='failed', failed_reason=? WHERE id=?`
    ).bind(String(e.message).slice(0, 300), row.id).run().catch(() => {});
    return error('결제 승인 실패: ' + e.message, e.status || 500);
  }

  // 4) status=paid + download_token 발급
  const downloadToken = randomToken(32);
  const downloadExpires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  const method = tossResult.method || tossResult.easyPay?.provider || null;
  const receiptUrl = tossResult.receipt?.url || null;

  await env.DB.prepare(
    `UPDATE ic_purchases
     SET status='paid',
         toss_payment_key=?, toss_method=?, toss_receipt_url=?,
         download_token=?, download_expires_at=?, paid_at=datetime('now')
     WHERE id=?`
  ).bind(paymentKey, method, receiptUrl, downloadToken, downloadExpires, row.id).run();

  return json({
    ok: true,
    purchase_id: row.id,
    download_token: downloadToken,
    download_url: `/api/downloads/${downloadToken}`,
    product_name: row.product_name,
    download_filename: row.download_filename,
    receipt_url: receiptUrl,
    method,
  });
});
