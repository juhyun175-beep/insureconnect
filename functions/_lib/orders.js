/**
 * v2.67.0: 공고 주문(ad_orders) + 환불 로그(refund_logs) — 공고 수익화 환불 정책.
 *   기존 쿠폰(coupon_templates/user_coupons/coupon_logs)·가격(finalPrice) 시스템 위에 '주문 + 환불' 레이어만 추가.
 *   결제는 수기 무통장입금이므로 ad_orders 는 등록 주문/동의/상태 기록 + 환불 감사용. 새 포인트·결제수단 없음.
 *
 *   환불 정책(게시 기준, 관리자가 type 선택):
 *     - 게시 전(pending/입금대기)   → full         : 전액 환불 + 사용쿠폰 원복
 *     - 게시 후(published)          → 환불 불가(원칙). 운영자 재량 부분환불 시 partial90(90%)
 *     - 운영자 귀책                  → operator_full: 전액 환불 + 쿠폰 원복
 */

export async function ensureOrderTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ad_orders (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       ad_type TEXT NOT NULL,
       ad_id INTEGER,
       member_id INTEGER,
       submitter_name TEXT,
       submitter_contact TEXT,
       base_price INTEGER NOT NULL DEFAULT 0,
       coupon_id INTEGER,
       coupon_rate INTEGER NOT NULL DEFAULT 0,
       final_price INTEGER NOT NULL DEFAULT 0,
       status TEXT NOT NULL DEFAULT 'pending_payment',
       consent_refund INTEGER NOT NULL DEFAULT 0,
       consent_points INTEGER NOT NULL DEFAULT 0,
       consent_fail INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       refunded_at TEXT
     )`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ad_orders_ad ON ad_orders(ad_type, ad_id)`).run().catch(() => {});
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS refund_logs (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       order_id INTEGER,
       ad_type TEXT,
       ad_id INTEGER,
       member_id INTEGER,
       refund_type TEXT,
       amount INTEGER NOT NULL DEFAULT 0,
       coupon_restored INTEGER NOT NULL DEFAULT 0,
       reason TEXT,
       decided_by TEXT,
       status TEXT NOT NULL DEFAULT 'approved',
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
}

/** 공고 등록 시 주문 1건 생성(+동의 기록). 실패해도 공고 생성은 막지 않음(best-effort). */
export async function createAdOrder(env, o) {
  try {
    await ensureOrderTables(env);
    const r = await env.DB.prepare(
      `INSERT INTO ad_orders
         (ad_type, ad_id, member_id, submitter_name, submitter_contact, base_price, coupon_id, coupon_rate, final_price, consent_refund, consent_points, consent_fail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      String(o.ad_type || ''), o.ad_id || null, o.member_id || null,
      (o.submitter_name || '').slice(0, 60), (o.submitter_contact || '').slice(0, 100),
      o.base_price || 0, o.coupon_id || null, o.coupon_rate || 0, o.final_price || 0,
      o.consent_refund ? 1 : 0, o.consent_points ? 1 : 0, o.consent_fail ? 1 : 0
    ).first();
    return r?.id || null;
  } catch (_) { return null; }
}
