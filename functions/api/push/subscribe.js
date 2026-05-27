/**
 * v2.1.43: PWA Web Push 구독 등록
 *
 *   POST /api/push/subscribe
 *   body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * 동일 endpoint 재구독 시 active=1로 재활성화 (upsert).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  let body;
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }

  const endpoint = body?.endpoint;
  const p256dh   = body?.keys?.p256dh;
  const auth     = body?.keys?.auth;
  const ua       = (body?.userAgent || request.headers.get('User-Agent') || '').slice(0, 300);

  if (!endpoint || !p256dh || !auth) return error('Missing subscription fields');
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return error('Invalid endpoint');
  if (typeof p256dh !== 'string' || p256dh.length > 256) return error('Invalid p256dh');
  if (typeof auth !== 'string'   || auth.length   > 64)  return error('Invalid auth');

  // upsert: 동일 endpoint 가 있으면 keys + active 갱신
  await env.DB.prepare(
    `INSERT INTO ic_push_subscriptions (endpoint, p256dh, auth, user_agent, active)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = excluded.p256dh,
       auth   = excluded.auth,
       user_agent = excluded.user_agent,
       active = 1`
  ).bind(endpoint, p256dh, auth, ua).run();

  return json({ ok: true });
});
