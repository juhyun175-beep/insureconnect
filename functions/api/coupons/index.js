/**
 * v2.51.0: 공고 할인권 상점 — 포인트로 쿠폰 교환 + 내 보유 쿠폰 조회.
 *   GET  /api/coupons  → { ok, points, catalog[], coupons[] } (로그인)
 *   POST /api/coupons  → 쿠폰 구매 { item: <catalogKey> } (로그인)
 *
 *   구매 = 포인트 차감(ic_members.points) + user_coupons 발급 + ic_point_log(reason 'shop_coupon_*')
 *   기존 포인트 상점(redeem.js)과 동일한 차감 패턴. 새 포인트 생성 없음. 직접 포인트 결제 없음(쿠폰 경유).
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';
import { COUPON_CATALOG, AD_BASE, AD_LABEL, AD_MAX_RATE, COUPON_TTL_DAYS, finalPrice, ensureCouponTables, expireStale } from '../../_lib/coupons.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  await ensureCouponTables(env);
  await expireStale(env, user.id);

  const me = await env.DB.prepare(`SELECT points FROM ic_members WHERE id = ?`).bind(user.id).first();
  const points = me?.points || 0;

  const rs = await env.DB.prepare(
    `SELECT id, coupon_type, ad_type, discount_rate, point_cost, status, expires_at, created_at, used_at, used_ad_type, used_ad_id
     FROM user_coupons WHERE member_id = ?
     ORDER BY (status='active') DESC, created_at DESC LIMIT 200`
  ).bind(user.id).all().catch(() => ({ results: [] }));

  const catalog = Object.entries(COUPON_CATALOG).map(([key, v]) => ({
    key, ad_type: v.ad_type, ad_label: AD_LABEL[v.ad_type], rate: v.rate, cost: v.cost,
    base: AD_BASE[v.ad_type], final: finalPrice(v.ad_type, v.rate), affordable: points >= v.cost,
  }));

  return json({ ok: true, points, ttlDays: COUPON_TTL_DAYS, adBase: AD_BASE, adLabel: AD_LABEL, adMaxRate: AD_MAX_RATE, catalog, coupons: rs.results || [] });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  await ensureCouponTables(env);

  const body = await request.json().catch(() => ({}));
  const key = String(body?.item || '');
  const cat = COUPON_CATALOG[key];
  if (!cat) return error('잘못된 상품입니다.');

  const me = await env.DB.prepare(`SELECT points FROM ic_members WHERE id = ?`).bind(user.id).first();
  const pts = me?.points || 0;
  if (pts < cat.cost) return json({ error: '포인트가 부족합니다.', code: 'insufficient_points', need: cat.cost, points: pts }, 402);

  // 포인트 차감(권위 = ic_members.points) — redeem.js와 동일 2-write 패턴
  await env.DB.prepare(`UPDATE ic_members SET points = points - ? WHERE id = ?`).bind(cat.cost, user.id).run();

  const ins = await env.DB.prepare(
    `INSERT INTO user_coupons (member_id, coupon_type, ad_type, discount_rate, point_cost, status, expires_at)
     VALUES (?, ?, ?, ?, ?, 'active', datetime('now', '+${COUPON_TTL_DAYS} days'))`
  ).bind(user.id, key, cat.ad_type, cat.rate, cat.cost).run();
  const couponId = ins.meta?.last_row_id;

  try { await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, ?, ?)`).bind(user.id, -cat.cost, 'shop_coupon_' + key).run(); } catch (_) {}
  try {
    await env.DB.prepare(
      `INSERT INTO coupon_logs (member_id, coupon_id, coupon_type, ad_type, discount_rate, point_cost, action) VALUES (?, ?, ?, ?, ?, ?, 'issue')`
    ).bind(user.id, couponId, key, cat.ad_type, cat.rate, cat.cost).run();
  } catch (_) {}

  const row = await env.DB.prepare(`SELECT id, ad_type, discount_rate, point_cost, expires_at FROM user_coupons WHERE id = ?`).bind(couponId).first().catch(() => null);
  const after = await env.DB.prepare(`SELECT points FROM ic_members WHERE id = ?`).bind(user.id).first();

  return json({
    ok: true, item: key, cost: cat.cost, remaining: after?.points || 0,
    coupon: row ? { id: row.id, ad_type: row.ad_type, ad_label: AD_LABEL[row.ad_type], rate: row.discount_rate, expires_at: row.expires_at } : null,
  });
});
