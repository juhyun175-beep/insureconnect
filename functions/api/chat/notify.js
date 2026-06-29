/**
 * v2.99.1: 채팅·문의 신규 알림 경량 폴링 엔드포인트 (앱 창이 떠 있을 때 큰 소리/토스트용).
 *   GET /api/chat/notify → 마지막 라운지 메시지(공개) + (로그인 시) 내게 온 마지막 '수신' 1:1 문의.
 *   라운지는 "전산창을 열고 있는 모두"에게 알림(홍보·유입) → 비로그인 방문자도 신호 수신.
 *   1:1 문의는 사적 정보 → 로그인 사용자에게 본인 수신분만.
 *   클라는 id 증가를 감지해 알림음 재생. (읽음 추적·스키마 변경 없음 — 가장 가벼운 신호)
 *   백그라운드(창 내림/종료)는 웹푸시(구독자)가 담당, 본 엔드포인트는 포그라운드 보조.
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  // 비로그인도 허용 — 라운지 알림은 전체 방문자 대상(홍보). 로그인 여부만 확인.
  const user = await getUserFromRequest(env, request).catch(() => null);

  // 마지막 라운지 메시지 (공개)
  const lounge = await env.DB.prepare(
    `SELECT id, member_id, nickname, body, created_at FROM ic_chat_messages ORDER BY id DESC LIMIT 1`
  ).first().catch(() => null);

  // 내게 온 마지막 수신 1:1 문의 (로그인 사용자 본인 수신분만)
  let dm = null;
  if (user) {
    dm = await env.DB.prepare(
      `SELECT id, room_id, sender_id, sender_nick, ad_title, body
         FROM ic_dm_messages
        WHERE (inquirer_id = ? OR owner_id = ?) AND sender_id != ?
        ORDER BY id DESC LIMIT 1`
    ).bind(user.id, user.id, user.id).first().catch(() => null);
  }

  return json({
    ok: true,
    me: user ? user.id : null,
    dm: dm ? {
      id: dm.id, room_id: dm.room_id, sender_id: dm.sender_id,
      sender_nick: dm.sender_nick, ad_title: dm.ad_title, body: String(dm.body || '').slice(0, 80),
    } : null,
    lounge: lounge ? {
      id: lounge.id, member_id: lounge.member_id,
      nickname: lounge.nickname, body: String(lounge.body || '').slice(0, 80),
      created_at: lounge.created_at,
    } : null,
  });
});
