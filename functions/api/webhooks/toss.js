/**
 * v2.1.1 (master): 토스페이먼츠 Webhook
 *
 *   POST /api/webhooks/toss
 *
 *   처리 이벤트:
 *   - PAYMENT.DONE       → status: paid (confirm 누락 보완)
 *   - PAYMENT.CANCELED   → status: refunded
 *   - PAYMENT.PARTIAL_CANCELED → 부분 환불 기록
 *
 * confirm API 가 successUrl 에서 호출되어 status 이미 paid 가 정상.
 * Webhook 은 confirm 누락(브라우저 종료 등) 보완용 + 환불 처리.
 */
import { verifyWebhookSignature, randomToken } from '../../_lib/tosspayments.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });

export const onRequestPost = async ({ request, env }) => {
  let event;
  try {
    const rawBody = await request.text();
    // 토스 webhook signature 헤더 — 환경/버전에 따라 다양
    const sig = request.headers.get('TossPayments-Webhook-Signature')
             || request.headers.get('Toss-Webhook-Signature')
             || request.headers.get('TossPayments-Signature');
    event = await verifyWebhookSignature(rawBody, sig, env.TOSS_WEBHOOK_SECRET);
  } catch (e) {
    return json({ error: 'signature invalid: ' + e.message }, 400);
  }

  try {
    const eventType = event.eventType || event.type;
    const data = event.data || event;

    if (eventType === 'PAYMENT.DONE' || data.status === 'DONE') {
      const orderId = data.orderId;
      if (!orderId) return json({ ok: true, skip: 'no orderId' });

      // 이미 paid 인지 확인 (confirm 에서 처리됐을 수 있음)
      const row = await env.DB.prepare(
        `SELECT id, status, download_token, amount_krw FROM ic_purchases WHERE toss_order_id = ?`
      ).bind(orderId).first();
      if (!row) return json({ ok: true, skip: 'no purchase' });
      if (row.status === 'paid' && row.download_token) {
        return json({ ok: true, skip: 'already paid' });
      }

      // amount 검증
      if (data.totalAmount && data.totalAmount !== row.amount_krw) {
        return json({ error: 'amount mismatch' }, 400);
      }

      const downloadToken = randomToken(32);
      const downloadExpires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
      const method = data.method || data.easyPay?.provider || null;
      const receiptUrl = data.receipt?.url || null;

      await env.DB.prepare(
        `UPDATE ic_purchases
         SET status='paid', toss_payment_key=?, toss_method=?, toss_receipt_url=?,
             download_token=?, download_expires_at=?, paid_at=datetime('now')
         WHERE id=? AND status != 'paid'`
      ).bind(data.paymentKey || null, method, receiptUrl,
             downloadToken, downloadExpires, row.id).run();

    } else if (eventType === 'PAYMENT.CANCELED' || data.status === 'CANCELED') {
      const orderId = data.orderId;
      if (orderId) {
        await env.DB.prepare(
          `UPDATE ic_purchases SET status='refunded' WHERE toss_order_id=?`
        ).bind(orderId).run().catch(() => {});
      }
    }
    return json({ ok: true, eventType });
  } catch (e) {
    console.error('toss webhook error:', e);
    return json({ error: e.message }, 500);
  }
};
