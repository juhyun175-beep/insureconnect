/**
 * v2.68.0: 모임 참여(RSVP) — /api/meeting-participants
 *   GET  ?meeting_id=  (공개)  → { count, participants:[{nickname,created_at}], mine }
 *   POST { meeting_id }  (로그인) → 참여(멱등, UNIQUE)
 *   DELETE ?meeting_id=  (로그인) → 참여 취소
 *   누가/몇 명 참여했는지 제3자도 볼 수 있게 공개 GET. 참여/취소는 로그인 필요.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';
import { ensureMeetingsTable, ensureParticipantsTable } from '../../_lib/meetings.js';

export const onRequestOptions = () => corsPreflight();

async function countAndList(env, meetingId, userId) {
  const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_meeting_participants WHERE meeting_id = ?`).bind(meetingId).first().catch(() => null);
  const rs = await env.DB.prepare(
    `SELECT nickname, member_id, created_at FROM ic_meeting_participants WHERE meeting_id = ? ORDER BY id ASC LIMIT 300`
  ).bind(meetingId).all().catch(() => ({ results: [] }));
  const list = rs.results || [];
  const mine = userId ? list.some((p) => p.member_id === userId) : false;
  return { count: c?.n || 0, participants: list.map((p) => ({ nickname: p.nickname || '회원', created_at: p.created_at })), mine };
}

export const onRequestGet = async ({ request, env }) => handle(async () => {
  await ensureParticipantsTable(env);
  const url = new URL(request.url);
  const meetingId = parseInt(url.searchParams.get('meeting_id') || '', 10);
  if (!meetingId) return error('meeting_id required');
  const user = await getUserFromRequest(env, request);
  const r = await countAndList(env, meetingId, user ? user.id : null);
  return json({ ok: true, ...r });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 참여할 수 있습니다.', code: 'login_required' }, 401);
  await ensureMeetingsTable(env);
  await ensureParticipantsTable(env);
  const b = await request.json().catch(() => ({}));
  const meetingId = parseInt(b.meeting_id, 10);
  if (!meetingId) return error('meeting_id required');
  const m = await env.DB.prepare(`SELECT id FROM ic_meetings WHERE id = ?`).bind(meetingId).first().catch(() => null);
  if (!m) return error('모임을 찾을 수 없습니다.', 404);
  const nick = user.nickname || (await env.DB.prepare(`SELECT nickname FROM ic_members WHERE id = ?`).bind(user.id).first().catch(() => null))?.nickname || '회원';
  await env.DB.prepare(`INSERT OR IGNORE INTO ic_meeting_participants (meeting_id, member_id, nickname) VALUES (?, ?, ?)`).bind(meetingId, user.id, String(nick).slice(0, 40)).run();
  const r = await countAndList(env, meetingId, user.id);
  return json({ ok: true, joined: true, ...r });
});

export const onRequestDelete = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인이 필요합니다.', code: 'login_required' }, 401);
  await ensureParticipantsTable(env);
  const url = new URL(request.url);
  const meetingId = parseInt(url.searchParams.get('meeting_id') || '', 10);
  if (!meetingId) return error('meeting_id required');
  await env.DB.prepare(`DELETE FROM ic_meeting_participants WHERE meeting_id = ? AND member_id = ?`).bind(meetingId, user.id).run();
  const r = await countAndList(env, meetingId, user.id);
  return json({ ok: true, joined: false, ...r });
});
