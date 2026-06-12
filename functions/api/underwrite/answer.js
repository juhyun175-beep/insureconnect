/**
 * v2.46.0: 현장 인수 Q&A — 답변
 *   GET  /api/underwrite/answer?question_id=N  → 해당 질문의 답변 목록 (공개)
 *   POST /api/underwrite/answer                → 답변 등록 { question_id, verdict, note? } (로그인)
 *     verdict ∈ possible(가능) | conditional(조건부) | impossible(불가)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const VERDICTS = ['possible', 'conditional', 'impossible'];
const S = (v, n) => (v == null ? null : (String(v).trim().slice(0, n) || null));

async function ensureTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_uw_answers (
       id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL, member_id INTEGER,
       verdict TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now')))`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_uw_ans_q ON ic_uw_answers(question_id)`).run();
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  await ensureTables(env);
  const qid = parseInt(new URL(request.url).searchParams.get('question_id'), 10);
  if (!qid) return error('question_id가 필요합니다.', 400);
  const rs = await env.DB.prepare(
    `SELECT a.id, a.verdict, a.note, a.created_at, m.nickname AS nickname, m.role AS role
     FROM ic_uw_answers a LEFT JOIN ic_members m ON m.id = a.member_id
     WHERE a.question_id = ? ORDER BY a.created_at DESC LIMIT 50`
  ).bind(qid).all().catch(() => ({ results: [] }));
  return json({ ok: true, answers: rs.results || [] });
});

export const onRequestPost = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  await ensureTables(env);
  const b = await request.json().catch(() => ({}));
  const qid = parseInt(b.question_id, 10);
  if (!qid) return error('question_id가 필요합니다.', 400);
  const verdict = VERDICTS.includes(b.verdict) ? b.verdict : null;
  if (!verdict) return error('가능/조건부/불가 중 선택해주세요.', 400);
  const q = await env.DB.prepare(`SELECT id FROM ic_uw_questions WHERE id=?`).bind(qid).first().catch(() => null);
  if (!q) return error('질문을 찾을 수 없습니다.', 404);
  await env.DB.prepare(
    `INSERT INTO ic_uw_answers (question_id, member_id, verdict, note) VALUES (?, ?, ?, ?)`
  ).bind(qid, user.id, verdict, S(b.note, 500)).run();
  return json({ ok: true });
});
