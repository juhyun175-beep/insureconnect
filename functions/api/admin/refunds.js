/**
 * v2.67.0: 관리자 — 공고 주문/환불. /api/admin/refunds (admin)
 *   GET           : 주문 목록(+공고 현재상태·회원·환불여부·동의기록) + 환불 로그 요약
 *   POST          : 환불 승인/거절
 *     { order_id, action:'approve', refund_type:'full'|'partial90'|'operator_full', reason, restore_coupon }
 *     { order_id, action:'reject', reason }
 *   결제는 수기 입금이므로 '환불 승인'은 (a) refund_logs 기록 (b) 주문상태 refunded (c) 선택 시 쿠폰 원복.
 *   실제 입금 반환은 운영자가 수기 처리(여기엔 의사결정·금액·사유만 기록).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ensureOrderTables, ensureOrderTossCols } from '../../_lib/orders.js';
import { ensureOrderOptionCols } from '../../_lib/options.js';
import { cancelPayment } from '../../_lib/tosspayments.js';

export const onRequestOptions = () => corsPreflight();

const POSTING_TABLE = { recruit: 'ic_recruitments', lecture: 'ic_lectures', meetup: 'ic_meetings' };

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureOrderTables(env);
  await ensureOrderTossCols(env);
  await ensureOrderOptionCols(env);   // v2.107.0: 옵션 컬럼 (SELECT 에 포함되므로 보장 필요)
  const all = (sql) => env.DB.prepare(sql).all().then((r) => r.results || []).catch(() => []);
  const first = (sql) => env.DB.prepare(sql).first().catch(() => null);

  const orders = await all(
    `SELECT o.id, o.ad_type, o.ad_id, o.member_id, o.submitter_name, o.submitter_contact,
            o.base_price, o.coupon_id, o.coupon_rate, o.final_price, o.status,
            o.options_json, o.options_price,
            o.toss_method, o.toss_receipt_url, o.paid_at,
            o.consent_refund, o.consent_points, o.consent_fail, o.created_at, o.refunded_at,
            (CASE o.ad_type
               WHEN 'recruit' THEN (SELECT status FROM ic_recruitments WHERE id = o.ad_id)
               WHEN 'lecture' THEN (SELECT status FROM ic_lectures WHERE id = o.ad_id)
               WHEN 'meetup'  THEN (SELECT status FROM ic_meetings   WHERE id = o.ad_id)
             END) AS posting_status,
            (CASE o.ad_type
               WHEN 'recruit' THEN (SELECT title FROM ic_recruitments WHERE id = o.ad_id)
               WHEN 'lecture' THEN (SELECT title FROM ic_lectures WHERE id = o.ad_id)
               WHEN 'meetup'  THEN (SELECT title FROM ic_meetings   WHERE id = o.ad_id)
             END) AS title,
            m.nickname AS member_nick,
            (SELECT COUNT(*) FROM refund_logs rl WHERE rl.order_id = o.id AND rl.status = 'approved') AS refunded
       FROM ad_orders o
       LEFT JOIN ic_members m ON m.id = o.member_id
      ORDER BY o.id DESC LIMIT 200`
  );
  const logs = await all(
    `SELECT id, order_id, ad_type, ad_id, refund_type, amount, coupon_restored, reason, decided_by, status, created_at
       FROM refund_logs ORDER BY id DESC LIMIT 100`
  );
  const sum = await first(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS amt FROM refund_logs WHERE status='approved'`
  );
  return json({ ok: true, orders, logs, refund_count: sum?.n || 0, refund_amount: sum?.amt || 0 });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureOrderTables(env);
  const b = await request.json().catch(() => ({}));
  const orderId = parseInt(b.order_id, 10);
  const action = String(b.action || '');
  if (!orderId) return error('order_id required');

  await ensureOrderTossCols(env);
  const o = await env.DB.prepare(`SELECT * FROM ad_orders WHERE id = ?`).bind(orderId).first().catch(() => null);
  if (!o) return error('주문을 찾을 수 없습니다.', 404);
  const reason = String(b.reason || '').slice(0, 300);

  if (action === 'reject') {
    await env.DB.prepare(
      `INSERT INTO refund_logs (order_id, ad_type, ad_id, member_id, refund_type, amount, reason, decided_by, status)
       VALUES (?, ?, ?, ?, 'denied', 0, ?, 'admin', 'rejected')`
    ).bind(o.id, o.ad_type, o.ad_id, o.member_id, reason).run();
    return json({ ok: true, action: 'reject', order_id: o.id });
  }

  if (action === 'approve') {
    const type = String(b.refund_type || 'full');
    let amount = 0;
    if (type === 'partial90') amount = Math.round((o.final_price || 0) * 0.9);
    else amount = o.final_price || 0; // full / operator_full
    // v2.106.0: 토스 온라인 결제 건이면 카드 취소 자동 실행 — 실패 시 환불 기록 없이 중단(돈-기록 불일치 방지)
    let tossCanceled = 0;
    if (o.status === 'paid' && o.toss_payment_key && amount > 0) {
      try {
        await cancelPayment({
          paymentKey: o.toss_payment_key,
          cancelReason: (type === 'partial90' ? '운영자 재량 부분환불(90%)' : '공고 등록비 환불') + (reason ? ' — ' + reason : ''),
          cancelAmount: amount < (o.final_price || 0) ? amount : undefined,
          env,
        });
        tossCanceled = 1;
      } catch (e) {
        return error('토스 결제취소 실패 — 환불이 처리되지 않았습니다: ' + e.message, 502);
      }
    }
    const restoreCoupon = (b.restore_coupon === true || type === 'full' || type === 'operator_full') && o.coupon_id;
    let couponRestored = 0;
    if (restoreCoupon) {
      const rr = await env.DB.prepare(
        `UPDATE user_coupons SET status='active', used_at=NULL, used_ad_type=NULL, used_ad_id=NULL WHERE id=? AND status='used'`
      ).bind(o.coupon_id).run().catch(() => null);
      couponRestored = (rr?.meta?.changes || 0) > 0 ? 1 : 0;
      if (couponRestored) {
        try { await env.DB.prepare(`INSERT INTO coupon_logs (member_id, coupon_id, action, status) VALUES (?,?, 'refund_restore', 'active')`).bind(o.member_id, o.coupon_id).run(); } catch (_) {}
      }
    }
    await env.DB.prepare(
      `INSERT INTO refund_logs (order_id, ad_type, ad_id, member_id, refund_type, amount, coupon_restored, reason, decided_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', 'approved')`
    ).bind(o.id, o.ad_type, o.ad_id, o.member_id, type, amount, couponRestored, reason).run();
    await env.DB.prepare(`UPDATE ad_orders SET status='refunded', refunded_at=datetime('now') WHERE id=?`).bind(o.id).run();
    return json({ ok: true, action: 'approve', order_id: o.id, refund_type: type, amount, coupon_restored: couponRestored, toss_canceled: tossCanceled });
  }

  return error('action must be approve or reject');
});
