/**
 * v2.56.0: 관리자 — 공고 할인권/수익화 통계. GET /api/admin/coupon-stats (admin)
 *   쿠폰 발급/사용/만료/보유 · 포인트 소모 · 공고 등록 매출(최종가) · 만료 임박 · 최근 사용내역.
 *   추가형(읽기 전용 집계). 기존 무수정.
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ensureCouponTables, ensurePostingCouponCols } from '../../_lib/coupons.js';
import { ensureMeetingsTable } from '../../_lib/meetings.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureCouponTables(env);
  await ensureMeetingsTable(env);
  await ensurePostingCouponCols(env);
  const first = (sql) => env.DB.prepare(sql).first().catch(() => null);
  const all = (sql) => env.DB.prepare(sql).all().then((r) => r.results || []).catch(() => []);

  const byStatus = await all(`SELECT status, COUNT(*) AS n, COALESCE(SUM(point_cost),0) AS pts FROM user_coupons GROUP BY status`);
  const byType = await all(`SELECT coupon_type, ad_type, discount_rate, COUNT(*) AS issued, COALESCE(SUM(CASE WHEN status='used' THEN 1 ELSE 0 END),0) AS used FROM user_coupons GROUP BY coupon_type ORDER BY issued DESC`);
  const ptsSpent = (await first(`SELECT COALESCE(SUM(-delta),0) AS p FROM ic_point_log WHERE reason LIKE 'shop_coupon_%'`))?.p || 0;
  const revRecruit = await first(`SELECT COALESCE(SUM(price),0) AS s, COUNT(*) AS n, COALESCE(SUM(CASE WHEN coupon_id IS NOT NULL THEN 1 ELSE 0 END),0) AS c FROM ic_recruitments WHERE price IS NOT NULL`);
  const revLecture = await first(`SELECT COALESCE(SUM(price),0) AS s, COUNT(*) AS n, COALESCE(SUM(CASE WHEN coupon_id IS NOT NULL THEN 1 ELSE 0 END),0) AS c FROM ic_lectures WHERE price IS NOT NULL`);
  const revMeetup = await first(`SELECT COALESCE(SUM(price),0) AS s, COUNT(*) AS n, COALESCE(SUM(CASE WHEN coupon_id IS NOT NULL THEN 1 ELSE 0 END),0) AS c FROM ic_meetings WHERE price IS NOT NULL`);
  const expiringSoon = (await first(`SELECT COUNT(*) AS n FROM user_coupons WHERE status='active' AND expires_at BETWEEN datetime('now') AND datetime('now','+3 days')`))?.n || 0;
  const recentUsed = await all(`SELECT coupon_type, ad_type, discount_rate, used_ad_type, used_ad_id, used_at FROM user_coupons WHERE status='used' ORDER BY used_at DESC LIMIT 20`);

  return json({
    ok: true,
    byStatus,
    byType,
    points_spent: ptsSpent,
    revenue: { recruit: revRecruit || { s: 0, n: 0, c: 0 }, lecture: revLecture || { s: 0, n: 0, c: 0 }, meetup: revMeetup || { s: 0, n: 0, c: 0 } },
    expiring_soon: expiringSoon,
    recent_used: recentUsed,
  });
});
