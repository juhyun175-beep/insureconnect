/**
 * v2.99.0: 채팅·문의 신규 알림 경량 폴링 엔드포인트 (앱 창이 떠 있을 때 큰 소리/토스트용).
 *   GET /api/chat/notify (로그인) → 내게 온 마지막 '수신' 1:1 문의 + 마지막 라운지 메시지의 id/요약.
 *   클라는 id 증가를 감지해 알림음 재생. (읽음 추적·스키마 변경 없음 — 가장 가벼운 신호)
 *   백그라운드(창 내림/종료)는 웹푸시가 담당, 본 엔드포인트는 포그라운드 보조.
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);

  // 내게 온 마지막 수신 1:1 문의 (내가 참여자이고, 내가 보낸 게 아닌 가장 최근 메시지)
  const dm = await env.DB.prepare(
    `SELECT id, room_id, sender_id, sender_nick, ad_title, body
       FROM ic_dm_messages
      WHERE (inquirer_id = ? OR owner_id = ?) AND sender_id != ?
      ORDER BY id DESC LIMIT 1`
  ).bind(user.id, user.id, user.id).first().catch(() => null);

  // 마지막 라운지 메시지
  const lounge = await env.DB.prepare(
    `SELECT id, member_id, nickname, body FROM ic_chat_messages ORDER BY id DESC LIMIT 1`
  ).first().catch(() => null);

  return json({
    ok: true,
    me: user.id,
    dm: dm ? {
      id: dm.id, room_id: dm.room_id, sender_id: dm.sender_id,
      sender_nick: dm.sender_nick, ad_title: dm.ad_title, body: String(dm.body || '').slice(0, 80),
    } : null,
    lounge: lounge ? {
      id: lounge.id, member_id: lounge.member_id,
      nickname: lounge.nickname, body: String(lounge.body || '').slice(0, 80),
    } : null,
  });
});
