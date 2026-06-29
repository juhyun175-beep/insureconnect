/**
 * v2.14.8: 특정 회원에게 웹푸시 발송 (공고주 맞춤 알림 등)
 *   ic_push_subscriptions(member_id 연결)에서 해당 회원의 active 구독을 찾아 발송.
 *   410/404 응답은 자동 비활성화. VAPID 미설정/회원 미연결 시 조용히 통과(no-op).
 */
import { sendWebPush } from './webpush.js';

function vapidOf(env) {
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || 'mailto:admin@insureconnect.co.kr',
  };
}

export async function sendPushToMember(env, memberId, payload) {
  const vapid = vapidOf(env);
  if (!memberId || !vapid.publicKey || !vapid.privateKey) return { sent: 0, skipped: true };

  let subs = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, endpoint, p256dh, auth FROM ic_push_subscriptions WHERE member_id = ? AND active = 1`
    ).bind(memberId).all();
    subs = rs.results || [];
  } catch (_) { return { sent: 0 }; }
  if (!subs.length) return { sent: 0 };

  const full = {
    icon: '/logo.png', badge: '/logo.png',
    ...payload,
    title: String(payload.title || 'InsureConnect').slice(0, 80),
    body: String(payload.body || '').slice(0, 240),
    url: payload.url ? String(payload.url).slice(0, 500) : '/',
    tag: payload.tag ? String(payload.tag).slice(0, 60) : 'ic-member',
  };

  let sent = 0;
  for (const s of subs) {
    try {
      const r = await sendWebPush({ subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload: full, vapid });
      if (r.removed) {
        await env.DB.prepare(`UPDATE ic_push_subscriptions SET active = 0 WHERE id = ?`).bind(s.id).run();
      } else if (r.ok) {
        sent++;
        try { await env.DB.prepare(`UPDATE ic_push_subscriptions SET last_sent_at = ? WHERE id = ?`).bind(new Date().toISOString(), s.id).run(); } catch (_) {}
      }
    } catch (_) {}
  }
  return { sent };
}

/**
 * v2.99.0: 활성 구독자 전원에게 웹푸시 (실시간 채팅 라운지 '대화 시작' 알림 등).
 *   opts.excludeMemberId 가 있으면 그 회원의 구독은 제외(보낸 사람 본인 제외).
 *   VAPID 미설정 시 조용히 통과(no-op).
 */
export async function sendPushToAllMembers(env, payload, opts = {}) {
  const vapid = vapidOf(env);
  if (!vapid.publicKey || !vapid.privateKey) return { sent: 0, skipped: true };

  let subs = [];
  try {
    const ex = opts.excludeMemberId;
    const rs = ex
      ? await env.DB.prepare(
          `SELECT id, endpoint, p256dh, auth FROM ic_push_subscriptions WHERE active = 1 AND (member_id IS NULL OR member_id != ?)`
        ).bind(ex).all()
      : await env.DB.prepare(
          `SELECT id, endpoint, p256dh, auth FROM ic_push_subscriptions WHERE active = 1`
        ).all();
    subs = rs.results || [];
  } catch (_) { return { sent: 0 }; }
  if (!subs.length) return { sent: 0 };

  const full = {
    icon: '/logo.png', badge: '/logo.png',
    ...payload,
    title: String(payload.title || 'InsureConnect').slice(0, 80),
    body: String(payload.body || '').slice(0, 240),
    url: payload.url ? String(payload.url).slice(0, 500) : '/',
    tag: payload.tag ? String(payload.tag).slice(0, 60) : 'ic-broadcast',
  };

  let sent = 0;
  const now = new Date().toISOString();
  for (const s of subs) {
    try {
      const r = await sendWebPush({ subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload: full, vapid });
      if (r.removed) {
        await env.DB.prepare(`UPDATE ic_push_subscriptions SET active = 0 WHERE id = ?`).bind(s.id).run();
      } else if (r.ok) {
        sent++;
        try { await env.DB.prepare(`UPDATE ic_push_subscriptions SET last_sent_at = ? WHERE id = ?`).bind(now, s.id).run(); } catch (_) {}
      }
    } catch (_) {}
  }
  return { sent };
}
