/**
 * v2.13.9: 포인트 상점 현황 — GET /api/points/shop-stats (관리자)
 *   상점 교환(reason LIKE 'shop_%') 집계: 상품별 횟수·소진 포인트 + 미사용 보유분(부채) + 최근 교환
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  // 상품별 교환 횟수 · 소진 포인트
  let byItem = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT reason, COUNT(*) AS cnt, COALESCE(SUM(-delta),0) AS points_spent
         FROM ic_point_log WHERE reason LIKE 'shop_%'
        GROUP BY reason ORDER BY cnt DESC`
    ).all();
    byItem = rs.results || [];
  } catch (_) {}
  const total_redemptions = byItem.reduce((s, r) => s + (r.cnt || 0), 0);
  const points_spent = byItem.reduce((s, r) => s + (r.points_spent || 0), 0);

  // 미사용 보유분(부채) — 적립됐지만 아직 안 쓴 질문권·상단노출권 합
  let outstanding = { ai_bonus: 0, feature_credit: 0 };
  try {
    const o = await env.DB.prepare(
      `SELECT COALESCE(SUM(ai_bonus),0) AS ai_bonus, COALESCE(SUM(feature_credit),0) AS feature_credit FROM ic_members`
    ).first();
    outstanding = { ai_bonus: o?.ai_bonus || 0, feature_credit: o?.feature_credit || 0 };
  } catch (_) {}

  // 최근 교환 20건
  let recent = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT l.reason, l.delta, l.created_at, m.nickname
         FROM ic_point_log l LEFT JOIN ic_members m ON m.id = l.member_id
        WHERE l.reason LIKE 'shop_%' ORDER BY l.created_at DESC LIMIT 20`
    ).all();
    recent = rs.results || [];
  } catch (_) {}

  return json({ ok: true, total_redemptions, points_spent, by_item: byItem, outstanding, recent });
});
