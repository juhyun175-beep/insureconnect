/**
 * v2.63.0: 관리자 — 1:1 공고 문의 채팅 모니터링(읽기 전용). /api/admin/dm (admin)
 *   GET ?rooms=1       → 전체 문의방 목록(방별 마지막 메시지·양측 닉·메시지 수)
 *   GET ?room_id=<id>  → 방 전체 메시지(관리자 열람)
 *   운영 감독용 — 관리자는 모든 방을 읽을 수 있음(전송은 불가).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const all = (sql, binds = []) => env.DB.prepare(sql).bind(...binds).all().then((r) => r.results || []).catch(() => []);

  if (url.searchParams.get('rooms')) {
    const rooms = await all(
      `SELECT d.room_id, d.ad_type, d.ad_id, d.inquirer_id, d.owner_id, d.ad_title,
              d.body AS last_body, d.created_at AS last_at, d.id AS last_id,
              iq.nickname AS inquirer_nick, ow.nickname AS owner_nick,
              (SELECT COUNT(*) FROM ic_dm_messages x WHERE x.room_id = d.room_id) AS msg_count
         FROM ic_dm_messages d
         LEFT JOIN ic_members iq ON iq.id = d.inquirer_id
         LEFT JOIN ic_members ow ON ow.id = d.owner_id
        WHERE d.id IN (SELECT MAX(id) FROM ic_dm_messages GROUP BY room_id)
        ORDER BY d.id DESC LIMIT 200`
    );
    return json({ ok: true, rooms });
  }

  const roomId = url.searchParams.get('room_id');
  if (!roomId) return error('room_id or rooms=1 required');
  const messages = await all(
    `SELECT id, sender_id, sender_nick, body, created_at FROM ic_dm_messages WHERE room_id = ? ORDER BY id ASC LIMIT 500`,
    [roomId]
  );
  return json({ ok: true, room_id: roomId, messages });
});
