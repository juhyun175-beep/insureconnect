/**
 * v2.8.0: 내 추천 현황 — GET /api/me/referral (로그인 필수)
 *   { code, link, count, role, next, thresholds }
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest, SITE } from '../../_lib/auth.js';
import { referralStats } from '../../_lib/referral.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  const s = await referralStats(env, user.id);
  return json({ ok: true, link: `${SITE}/?ref=${s.code}`, ...s });
});
