/**
 * v2.8.2: 관리자 — 추천자 랭킹 GET /api/admin/referrals (admin)
 *   { total, top: [{id, nickname, role, n}] }
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ensureReferralTables } from '../../_lib/referral.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureReferralTables(env);

  let total = 0;
  try { const t = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_referrals`).first(); total = t?.n || 0; } catch (_) {}

  let top = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT r.referrer_id AS id, COUNT(*) AS n, m.nickname AS nickname, m.role AS role
       FROM ic_referrals r LEFT JOIN ic_members m ON m.id = r.referrer_id
       GROUP BY r.referrer_id ORDER BY n DESC, r.referrer_id ASC LIMIT 20`
    ).all();
    top = rs.results || [];
  } catch (_) {}

  return json({ total, top });
});
