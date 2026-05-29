/**
 * v2.1.0: Stripe Webhook 핸들러
 *
 *   POST /api/webhooks/stripe
 *   Stripe Dashboard 에 endpoint 등록 후 STRIPE_WEBHOOK_SECRET 받아 등록.
 *
 *   처리 이벤트:
 *   - checkout.session.completed   → 결제 확정 + download_token 발급
 *   - payment_intent.payment_failed → status: failed
 *   - charge.refunded               → status: refunded
 */
import { verifyWebhookSignature, randomToken } from '../../_lib/stripe.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequestPost = async ({ request, env }) => {
  let event;
  try {
    const rawBody = await request.text();
    const sig = request.headers.get('Stripe-Signature');
    event = await verifyWebhookSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return json({ error: 'signature invalid: ' + e.message }, 400);
  }

  try {
    const type = event.type;
    if (type === 'checkout.session.completed') {
      const session = event.data.object;
      const purchaseId = parseInt(session.metadata?.purchase_id, 10);
      if (!purchaseId) return json({ ok: true, skip: 'no purchase_id' });

      const downloadToken = randomToken(32);
      const downloadExpires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
      const paymentIntent = session.payment_intent || null;

      await env.DB.prepare(
        `UPDATE ic_purchases
         SET status = 'paid',
             stripe_payment_intent = ?,
             download_token = ?,
             download_expires_at = ?,
             paid_at = datetime('now')
         WHERE id = ? AND status != 'paid'`
      ).bind(paymentIntent, downloadToken, downloadExpires, purchaseId).run();

      // TODO: 이메일로 다운로드 링크 발송 (Resend 사용 — Sprint 다음 단계)

    } else if (type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const reason = pi.last_payment_error?.message || pi.last_payment_error?.code || 'unknown';
      await env.DB.prepare(
        `UPDATE ic_purchases SET status = 'failed', failed_reason = ? WHERE stripe_payment_intent = ? AND status = 'pending'`
      ).bind(String(reason).slice(0, 300), pi.id).run().catch(() => {});

    } else if (type === 'charge.refunded') {
      const charge = event.data.object;
      const pi = charge.payment_intent;
      if (pi) {
        await env.DB.prepare(
          `UPDATE ic_purchases SET status = 'refunded' WHERE stripe_payment_intent = ?`
        ).bind(pi).run().catch(() => {});
      }
    }
    return json({ ok: true, type });
  } catch (e) {
    console.error('webhook handler error:', e);
    return json({ error: e.message }, 500);
  }
};

// Stripe 가 OPTIONS preflight 보내지 않음 — 응답 없음
