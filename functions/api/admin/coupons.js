/**
 * v2.60.0: 관리자 — 할인권 수동 지급/회수. /api/admin/coupons (admin)
 *   GET    : 최근 발급 쿠폰 목록(회수 대상 선택용) + 카탈로그. ?member_id= / ?status= 필터.
 *   POST   : 지급(grant) { member_id, coupon_type } — 무상 발급(point_cost 0), +TTL일. 포인트 미차감.
 *   PATCH  : 회수(revoke) { coupon_id } — active 만 status='revoked' (소프트, 감사 보존).
 *   가격/할인율/타입은 코드 카탈로그(COUPON_CATALOG)에서만 해석 — 클라 입력 신뢰 금지.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { COUPON_CATALOG, AD_LABEL, COUPON_TTL_DAYS, ensureCouponTables } from '../../_lib/coupons.js';

export const onRequestOptions = () => corsPreflight();

const catalogList = () => Object.entries(COUPON_CATALOG).map(([key, v]) => ({
  key, ad_type: v.ad_type, rate: v.rate, cost: v.cost, label: `${AD_LABEL[v.ad_type] || v.ad_type} ${v.rate}% 할인권`,
}));

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureCouponTables(env);
  const url = new URL(request.url);
  const memberId = parseInt(url.searchParams.get('member_id') || '', 10);
  const status = url.searchParams.get('status');
  const where = [], binds = [];
  if (memberId) { where.push('uc.member_id = ?'); binds.push(memberId); }
  if (status) { where.push('uc.status = ?'); binds.push(status); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rs = await env.DB.prepare(
    `SELECT uc.id, uc.member_id, uc.coupon_type, uc.ad_type, uc.discount_rate, uc.point_cost,
            uc.status, uc.expires_at, uc.created_at, uc.used_at, uc.used_ad_type, uc.used_ad_id,
            m.nickname AS member_nickname
       FROM user_coupons uc LEFT JOIN ic_members m ON m.id = uc.member_id
       ${whereSql}
      ORDER BY uc.created_at DESC LIMIT 100`
  ).bind(...binds).all().catch(() => ({ results: [] }));
  return json({ ok: true, coupons: rs.results || [], catalog: catalogList() });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureCouponTables(env);
  const body = await request.json().catch(() => ({}));
  const memberId = parseInt(body.member_id, 10);
  const key = String(body.coupon_type || '');
  if (!memberId) return error('member_id required');
  const cat = COUPON_CATALOG[key];
  if (!cat) return error('invalid coupon_type');
  const m = await env.DB.prepare(`SELECT id, nickname FROM ic_members WHERE id = ?`).bind(memberId).first();
  if (!m) return error('member not found', 404);

  const r = await env.DB.prepare(
    `INSERT INTO user_coupons (member_id, coupon_type, ad_type, discount_rate, point_cost, status, expires_at)
     VALUES (?, ?, ?, ?, 0, 'active', datetime('now', '+' || ? || ' days')) RETURNING id`
  ).bind(memberId, key, cat.ad_type, cat.rate, COUPON_TTL_DAYS).first();
  try {
    await env.DB.prepare(
      `INSERT INTO coupon_logs (member_id, coupon_id, coupon_type, ad_type, discount_rate, point_cost, action, status)
       VALUES (?, ?, ?, ?, ?, 0, 'admin_grant', 'active')`
    ).bind(memberId, r.id, key, cat.ad_type, cat.rate).run();
  } catch (_) {}
  return json({ ok: true, id: r.id, member_id: memberId, member: m.nickname || null, coupon_type: key, ad_type: cat.ad_type, rate: cat.rate });
});

export const onRequestPatch = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureCouponTables(env);
  const body = await request.json().catch(() => ({}));
  const id = parseInt(body.coupon_id, 10);
  if (!id) return error('coupon_id required');
  const cur = await env.DB.prepare(
    `SELECT id, member_id, coupon_type, ad_type, discount_rate, status FROM user_coupons WHERE id = ?`
  ).bind(id).first();
  if (!cur) return error('coupon not found', 404);
  if (cur.status !== 'active') return error('active(보유) 상태의 할인권만 회수할 수 있습니다. 현재: ' + cur.status);
  await env.DB.prepare(`UPDATE user_coupons SET status='revoked' WHERE id = ? AND status='active'`).bind(id).run();
  try {
    await env.DB.prepare(
      `INSERT INTO coupon_logs (member_id, coupon_id, coupon_type, ad_type, discount_rate, action, status)
       VALUES (?, ?, ?, ?, ?, 'admin_revoke', 'revoked')`
    ).bind(cur.member_id, id, cur.coupon_type, cur.ad_type, cur.discount_rate).run();
  } catch (_) {}
  return json({ ok: true, id, status: 'revoked' });
});
