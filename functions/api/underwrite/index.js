/**
 * v2.46.0: 현장 인수 Q&A (크라우드 빠른질의) — "이 보험사, 이 병력/조건 인수 될까요?"
 *   GET  /api/underwrite[?q=검색]  → 최근 질문 + 가능/조건부/불가 집계 (공개 읽기)
 *   POST /api/underwrite           → 질문 등록 { insurer?, topic, body? } (로그인 필요)
 *
 *   설계사들의 실제 인수 경험을 모으는 집단지성 → 삼따AI 보완 + 매일 들를 이유(데이터 해자).
 *   읽기는 공개(가치·검색노출), 작성은 카카오 로그인. UGC는 로그인 게이트로 남용 완화.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const S = (v, n) => (v == null ? null : (String(v).trim().slice(0, n) || null));

async function ensureTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_uw_questions (
       id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER,
       insurer TEXT, topic TEXT NOT NULL, body TEXT,
       created_at TEXT DEFAULT (datetime('now')))`
  ).run();
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
  const q = S(new URL(request.url).searchParams.get('q'), 60);
  const like = q ? `%${q}%` : null;
  const rs = await env.DB.prepare(
    `SELECT qq.id, qq.insurer, qq.topic, qq.body, qq.created_at,
       (SELECT COUNT(*) FROM ic_uw_answers a WHERE a.question_id=qq.id AND a.verdict='possible')    AS n_possible,
       (SELECT COUNT(*) FROM ic_uw_answers a WHERE a.question_id=qq.id AND a.verdict='conditional') AS n_conditional,
       (SELECT COUNT(*) FROM ic_uw_answers a WHERE a.question_id=qq.id AND a.verdict='impossible')  AS n_impossible,
       (SELECT COUNT(*) FROM ic_uw_answers a WHERE a.question_id=qq.id) AS n_total
     FROM ic_uw_questions qq
     WHERE (? IS NULL OR qq.insurer LIKE ? OR qq.topic LIKE ? OR qq.body LIKE ?)
     ORDER BY qq.created_at DESC LIMIT 50`
  ).bind(like, like, like, like).all().catch(() => ({ results: [] }));
  return json({ ok: true, questions: rs.results || [] });
});

export const onRequestPost = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  await ensureTables(env);
  // 남용 완화: 회원당 최근 1시간 10건 제한
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_uw_questions WHERE member_id=? AND created_at >= datetime('now','-1 hour')`
  ).bind(user.id).first().catch(() => null);
  if ((recent?.n || 0) >= 10) return error('잠시 후 다시 등록해주세요.', 429);
  const b = await request.json().catch(() => ({}));
  const topic = S(b.topic, 120);
  if (!topic) return error('질문(병력·조건)을 입력해주세요.', 400);
  const r = await env.DB.prepare(
    `INSERT INTO ic_uw_questions (member_id, insurer, topic, body) VALUES (?, ?, ?, ?)`
  ).bind(user.id, S(b.insurer, 40), topic, S(b.body, 800)).run();
  return json({ ok: true, id: r.meta?.last_row_id });
});
