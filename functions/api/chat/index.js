/**
 * v2.55.0: 실시간 채팅 MVP (전체 라운지) — 폴링 기반(신규 인프라 0, 현 Pages+D1 스택).
 *   GET  /api/chat?since=<id>  → since 이후 메시지(폴링). since 없으면 최근 40개. (로그인)
 *   POST /api/chat             → 메시지 전송 { body } (로그인 · rate-limit 2초 · 500자)
 *
 *   추가형 — 기존 기능 무수정. 모더레이션(차단/신고)·1:1 방 라우팅은 후속 확장.
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_chat_messages (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       member_id INTEGER NOT NULL,
       nickname TEXT,
       body TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_chat_id ON ic_chat_messages(id)`).run();
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  await ensureTable(env);
  const since = parseInt(new URL(request.url).searchParams.get('since') || '0', 10) || 0;
  let results;
  if (since > 0) {
    const rs = await env.DB.prepare(
      `SELECT id, member_id, nickname, body, created_at FROM ic_chat_messages WHERE id > ? ORDER BY id ASC LIMIT 100`
    ).bind(since).all().catch(() => ({ results: [] }));
    results = rs.results || [];
  } else {
    const rs = await env.DB.prepare(
      `SELECT id, member_id, nickname, body, created_at FROM ic_chat_messages ORDER BY id DESC LIMIT 40`
    ).all().catch(() => ({ results: [] }));
    results = (rs.results || []).reverse();
  }
  return json({ ok: true, me: user.id, messages: results, lastId: results.length ? results[results.length - 1].id : since });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  await ensureTable(env);
  const b = await request.json().catch(() => ({}));
  const body = String(b.body || '').replace(/\s+$/,'').trim().slice(0, 500);
  if (!body) return error('메시지를 입력해주세요.');
  // rate-limit: 최근 2초 내 본인 메시지 있으면 거절(도배 방지)
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_chat_messages WHERE member_id = ? AND created_at > datetime('now','-2 seconds')`
  ).bind(user.id).first().catch(() => null);
  if ((recent?.n || 0) >= 1) return json({ error: '잠시 후 다시 보내주세요.', code: 'rate_limited' }, 429);
  const nick = (await env.DB.prepare(`SELECT nickname FROM ic_members WHERE id = ?`).bind(user.id).first().catch(() => null))?.nickname || '회원';
  const r = await env.DB.prepare(`INSERT INTO ic_chat_messages (member_id, nickname, body) VALUES (?, ?, ?)`).bind(user.id, String(nick).slice(0, 40), body).run();
  return json({ ok: true, id: r.meta?.last_row_id });
});
