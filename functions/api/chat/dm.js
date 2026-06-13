/**
 * v2.61.0: 1:1 공고 문의 채팅방 — 폴링 기반(전체 라운지와 동일 스택, 신규 인프라 0).
 *   방(room) = 결정적 키 `${ad_type}:${ad_id}:${inquirer_id}`. 참여자 = 문의자(inquirer) + 공고주인(owner = 공고 submitter_id).
 *   접근통제(핵심): 메시지 읽기/쓰기는 user.id ∈ {inquirer_id, owner_id} 인 경우만 허용.
 *     owner 는 항상 공고 테이블에서 서버가 도출(클라 신뢰 금지). 문의자로 행세하려면 본인 id 여야(room_id 3번째 == user.id).
 *
 *   GET  ?rooms=1                                 → 내 문의방 목록(문의자 or 주인) + 마지막 메시지
 *   GET  ?room_id=  | ?ad_type=&ad_id=  (+?since=) → 방 메시지(참여자만)
 *   POST { room_id | ad_type, ad_id, body }        → 전송(참여자만 · rate-limit 2초 · 500자)
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const POST_TABLES = { recruit: 'ic_recruitments', lecture: 'ic_lectures', meetup: 'ic_meetings' };

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_dm_messages (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       room_id TEXT NOT NULL,
       ad_type TEXT NOT NULL,
       ad_id INTEGER NOT NULL,
       inquirer_id INTEGER NOT NULL,
       owner_id INTEGER NOT NULL,
       sender_id INTEGER NOT NULL,
       sender_nick TEXT,
       ad_title TEXT,
       body TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_dm_room ON ic_dm_messages(room_id, id)`).run().catch(() => {});
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_dm_parties ON ic_dm_messages(inquirer_id, owner_id)`).run().catch(() => {});
}

async function postingOf(env, adType, adId) {
  const t = POST_TABLES[adType];
  if (!t || !adId) return null;
  return await env.DB.prepare(`SELECT submitter_id, title FROM ${t} WHERE id = ?`).bind(adId).first().catch(() => null);
}

/** 요청에서 방을 해석하고 참여자 검증. 성공 시 {room_id, ad_type, ad_id, inquirer_id, owner_id, title}, 실패 시 {error, status}. */
async function resolveRoom(env, user, { room_id, ad_type, ad_id }) {
  let adType, adId, inquirerId;
  if (room_id) {
    const parts = String(room_id).split(':');
    if (parts.length !== 3) return { error: '잘못된 방입니다.', status: 400 };
    adType = parts[0]; adId = parseInt(parts[1], 10); inquirerId = parseInt(parts[2], 10);
  } else {
    adType = String(ad_type || ''); adId = parseInt(ad_id, 10); inquirerId = user.id; // 문의자 = 나
  }
  if (!POST_TABLES[adType] || !adId || !inquirerId) return { error: '잘못된 공고입니다.', status: 400 };
  const post = await postingOf(env, adType, adId);
  if (!post) return { error: '공고를 찾을 수 없습니다.', status: 404 };
  const ownerId = post.submitter_id;
  if (!ownerId) return { error: '이 공고는 등록자가 연결되어 있지 않아 문의 채팅을 사용할 수 없습니다.', status: 400 };
  if (ownerId === inquirerId) return { error: '본인이 등록한 공고입니다. (문의 대상이 아닙니다)', status: 400 };
  if (user.id !== inquirerId && user.id !== ownerId) return { error: '이 문의방에 접근 권한이 없습니다.', status: 403 };
  return { room_id: `${adType}:${adId}:${inquirerId}`, ad_type: adType, ad_id: adId, inquirer_id: inquirerId, owner_id: ownerId, title: post.title || '' };
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  await ensureTable(env);
  const url = new URL(request.url);

  // 내 문의방 목록
  if (url.searchParams.get('rooms')) {
    const rs = await env.DB.prepare(
      `SELECT d.room_id, d.ad_type, d.ad_id, d.inquirer_id, d.owner_id, d.ad_title,
              d.body AS last_body, d.sender_id AS last_sender, d.created_at AS last_at, d.id AS last_id,
              iq.nickname AS inquirer_nick, ow.nickname AS owner_nick
         FROM ic_dm_messages d
         LEFT JOIN ic_members iq ON iq.id = d.inquirer_id
         LEFT JOIN ic_members ow ON ow.id = d.owner_id
        WHERE d.id IN (SELECT MAX(id) FROM ic_dm_messages WHERE inquirer_id = ? OR owner_id = ? GROUP BY room_id)
        ORDER BY d.id DESC LIMIT 100`
    ).bind(user.id, user.id).all().catch(() => ({ results: [] }));
    const rooms = (rs.results || []).map((r) => {
      const iAmOwner = user.id === r.owner_id;
      return {
        room_id: r.room_id, ad_type: r.ad_type, ad_id: r.ad_id, title: r.ad_title || '',
        role: iAmOwner ? 'owner' : 'inquirer',
        other_nick: iAmOwner ? (r.inquirer_nick || '문의자') : (r.owner_nick || '등록자'),
        last_body: r.last_body, last_mine: r.last_sender === user.id, last_at: r.last_at, last_id: r.last_id,
      };
    });
    return json({ ok: true, me: user.id, rooms });
  }

  // 방 메시지
  const r = await resolveRoom(env, user, {
    room_id: url.searchParams.get('room_id'),
    ad_type: url.searchParams.get('ad_type'),
    ad_id: url.searchParams.get('ad_id'),
  });
  if (r.error) return json({ error: r.error }, r.status || 400);
  const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
  const rs = await env.DB.prepare(
    `SELECT id, sender_id, sender_nick, body, created_at FROM ic_dm_messages WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT 100`
  ).bind(r.room_id, since).all().catch(() => ({ results: [] }));
  const messages = rs.results || [];
  return json({
    ok: true, me: user.id, room_id: r.room_id, ad_type: r.ad_type, ad_id: r.ad_id, title: r.title,
    role: user.id === r.owner_id ? 'owner' : 'inquirer',
    messages, lastId: messages.length ? messages[messages.length - 1].id : since,
  });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  await ensureTable(env);
  const b = await request.json().catch(() => ({}));
  const body = String(b.body || '').replace(/\s+$/, '').trim().slice(0, 500);
  if (!body) return error('메시지를 입력해주세요.');
  const r = await resolveRoom(env, user, { room_id: b.room_id, ad_type: b.ad_type, ad_id: b.ad_id });
  if (r.error) return json({ error: r.error }, r.status || 400);
  // rate-limit 2초 (도배 방지)
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_dm_messages WHERE sender_id = ? AND created_at > datetime('now','-2 seconds')`
  ).bind(user.id).first().catch(() => null);
  if ((recent?.n || 0) >= 1) return json({ error: '잠시 후 다시 보내주세요.', code: 'rate_limited' }, 429);
  const nick = (await env.DB.prepare(`SELECT nickname FROM ic_members WHERE id = ?`).bind(user.id).first().catch(() => null))?.nickname || '회원';
  const ins = await env.DB.prepare(
    `INSERT INTO ic_dm_messages (room_id, ad_type, ad_id, inquirer_id, owner_id, sender_id, sender_nick, ad_title, body)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(r.room_id, r.ad_type, r.ad_id, r.inquirer_id, r.owner_id, user.id, String(nick).slice(0, 40), String(r.title).slice(0, 120), body).run();
  return json({ ok: true, id: ins.meta?.last_row_id, room_id: r.room_id });
});
