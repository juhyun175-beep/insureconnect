/**
 * v2.1.43: Push 알림 발송 (관리자 전용)
 *
 *   POST /api/push/send
 *   header: x-admin-secret: ...
 *   body: { title, body, url?, image?, tag?, type? }
 *
 * 모든 active 구독자에게 발송. 410/404 응답은 자동 비활성화.
 *
 * Wrangler secret 등록 필요:
 *   npx wrangler pages secret put VAPID_PUBLIC_KEY  --project-name=insureconnect-hub
 *   npx wrangler pages secret put VAPID_PRIVATE_KEY --project-name=insureconnect-hub
 *   npx wrangler pages secret put VAPID_SUBJECT     --project-name=insureconnect-hub
 *     (예: mailto:admin@insureconnect.co.kr)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { sendWebPush } from '../../_lib/webpush.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  const vapid = {
    publicKey:  env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject:    env.VAPID_SUBJECT || 'mailto:admin@insureconnect.co.kr',
  };
  if (!vapid.publicKey || !vapid.privateKey) {
    return error('VAPID 키 미설정 — `wrangler pages secret put VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY` 등록 필요', 500);
  }

  let body;
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  if (!body?.title || !body?.body) return error('title and body required');

  const payload = {
    title: String(body.title).slice(0, 80),
    body:  String(body.body).slice(0, 240),
    url:   body.url   ? String(body.url).slice(0, 500)  : '/',
    image: body.image ? String(body.image).slice(0, 500) : undefined,
    tag:   body.tag   ? String(body.tag).slice(0, 60)   : 'ic-broadcast',
    type:  body.type  || 'general',
    id:    body.id    || null,
    icon:  '/logo.png',
    badge: '/logo.png',
  };

  // active 구독자 조회
  const rs = await env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM ic_push_subscriptions WHERE active = 1`
  ).all();
  const subs = rs.results || [];

  let sent = 0, removed = 0, failed = 0;
  const now = new Date().toISOString();

  // 직렬로 발송 (CF Workers concurrent fetch 제한 회피 — 50건 이상이면 batched 권장)
  for (const s of subs) {
    try {
      const r = await sendWebPush({
        subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload, vapid,
      });
      if (r.removed) {
        await env.DB.prepare(`UPDATE ic_push_subscriptions SET active = 0 WHERE id = ?`).bind(s.id).run();
        removed++;
      } else if (r.ok) {
        await env.DB.prepare(`UPDATE ic_push_subscriptions SET last_sent_at = ? WHERE id = ?`).bind(now, s.id).run();
        sent++;
      } else {
        failed++;
      }
    } catch (_) { failed++; }
  }

  return json({ ok: true, total: subs.length, sent, removed, failed });
});
