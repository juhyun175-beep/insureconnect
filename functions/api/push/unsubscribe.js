/**
 * v2.1.43: PWA Web Push 구독 해제
 *
 *   POST /api/push/unsubscribe
 *   body: { endpoint }
 *
 * 행 삭제 대신 active=0 (재구독 시 빠른 복귀).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  let body;
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const endpoint = body?.endpoint;
  if (!endpoint || typeof endpoint !== 'string') return error('Missing endpoint');

  await env.DB.prepare(
    `UPDATE ic_push_subscriptions SET active = 0 WHERE endpoint = ?`
  ).bind(endpoint).run();

  return json({ ok: true });
});
