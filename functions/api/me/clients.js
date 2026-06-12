/**
 * v2.43.0: 내 고객 메모 (미니 CRM) — 회원 "본인에게만" 보이는 비공개 고객/만기 기록.
 *   GET    /api/me/clients          → 내 고객 목록(만기일 임박순)
 *   POST   /api/me/clients          → 추가 { name, phone?, insurer?, product?, premium?, renew_date?, memo? }
 *   PATCH  /api/me/clients          → 수정 { id, ...fields }
 *   DELETE /api/me/clients?id=123   → 삭제
 *
 * 인증: 카카오 로그인 세션(getUserFromRequest). 모든 쿼리에 member_id 일치 강제 → 타 회원 데이터 접근 불가.
 * 개인정보: 설계사 "본인의 업무 메모"(고객 갱신/만기 관리용). 주민번호 등 민감식별정보는 받지 않음.
 *           설계사가 InsureConnect를 매일·여러 번 열게 만드는 lock-in(자기 데이터가 여기 쌓임).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const MAX_CLIENTS = 1000;

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_client_notes (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       member_id  INTEGER NOT NULL,
       name       TEXT NOT NULL,
       phone      TEXT,
       insurer    TEXT,
       product    TEXT,
       premium    INTEGER,
       renew_date TEXT,
       memo       TEXT,
       created_at TEXT DEFAULT (datetime('now')),
       updated_at TEXT DEFAULT (datetime('now'))
     )`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_client_notes_member ON ic_client_notes(member_id)`
  ).run();
}

const S = (v, n) => (v == null ? null : (String(v).trim().slice(0, n) || null));
const dateOk = (v) => (v == null || v === '' ? null : (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null));
const numOrNull = (v) => {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  await ensureTable(env);
  const rs = await env.DB.prepare(
    `SELECT id, name, phone, insurer, product, premium, renew_date, memo, created_at, updated_at
     FROM ic_client_notes WHERE member_id = ?
     ORDER BY (renew_date IS NULL) ASC, renew_date ASC, id DESC LIMIT ?`
  ).bind(user.id, MAX_CLIENTS).all();
  return json({ ok: true, clients: rs.results || [] });
});

export const onRequestPost = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  await ensureTable(env);
  const cnt = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM ic_client_notes WHERE member_id = ?`
  ).bind(user.id).first();
  if ((cnt?.c || 0) >= MAX_CLIENTS) return error('저장 한도를 초과했습니다.', 400);
  const b = await request.json().catch(() => ({}));
  const name = S(b.name, 60);
  if (!name) return error('고객명(또는 별칭)을 입력해주세요.', 400);
  const r = await env.DB.prepare(
    `INSERT INTO ic_client_notes (member_id, name, phone, insurer, product, premium, renew_date, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, name, S(b.phone, 40), S(b.insurer, 40), S(b.product, 80),
         numOrNull(b.premium), dateOk(b.renew_date), S(b.memo, 500)).run();
  return json({ ok: true, id: r.meta?.last_row_id });
});

export const onRequestPatch = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  await ensureTable(env);
  const b = await request.json().catch(() => ({}));
  const id = parseInt(b.id, 10);
  if (!id) return error('id가 필요합니다.', 400);
  const name = S(b.name, 60);
  if (!name) return error('고객명(또는 별칭)을 입력해주세요.', 400);
  const r = await env.DB.prepare(
    `UPDATE ic_client_notes
       SET name=?, phone=?, insurer=?, product=?, premium=?, renew_date=?, memo=?, updated_at=datetime('now')
     WHERE id=? AND member_id=?`
  ).bind(name, S(b.phone, 40), S(b.insurer, 40), S(b.product, 80),
         numOrNull(b.premium), dateOk(b.renew_date), S(b.memo, 500), id, user.id).run();
  if (!r.meta?.changes) return error('대상을 찾을 수 없습니다.', 404);
  return json({ ok: true });
});

export const onRequestDelete = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  await ensureTable(env);
  const id = parseInt(new URL(request.url).searchParams.get('id'), 10);
  if (!id) return error('id가 필요합니다.', 400);
  const r = await env.DB.prepare(
    `DELETE FROM ic_client_notes WHERE id=? AND member_id=?`
  ).bind(id, user.id).run();
  if (!r.meta?.changes) return error('대상을 찾을 수 없습니다.', 404);
  return json({ ok: true });
});
