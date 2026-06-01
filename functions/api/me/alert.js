/**
 * v2.7.4: 내 알림 동의 on/off — POST /api/me/alert (로그인 필수)
 *   body: { optin: boolean }
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const optin = body?.optin ? 1 : 0;

  await env.DB.prepare(`UPDATE ic_members SET alert_optin = ? WHERE id = ?`).bind(optin, user.id).run();
  return json({ ok: true, optin });
});
