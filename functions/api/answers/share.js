/**
 * v2.14.1: 삼따AI 답변 공유 — POST /api/answers/share (로그인) body:{question, answer, case_count}
 *   사용자가 받은 답변 1개를 공개 카드(/a/{id})로 만들어 카톡방·카페에 공유 → 비회원 유입(PLG)
 *   저장 텍스트는 SSR에서 escape. 길이 캡·로그인·일일 한도로 남용 차단. DB 전체 아닌 단건만 공개(해자 안전).
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외
const DAILY_LIMIT = 30;
function genId() { const r = crypto.getRandomValues(new Uint8Array(8)); return [...r].map((x) => ALPH[x % ALPH.length]).join(''); }

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);

  const body = await request.json().catch(() => ({}));
  const question = String(body?.question || '').trim().slice(0, 300);
  const answer = String(body?.answer || '').trim().slice(0, 2000);
  const caseCount = Math.max(0, Math.min(999, parseInt(body?.case_count, 10) || 0));
  if (!question || !answer) return error('공유할 질문/답변이 없습니다.');

  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ic_shared_answers (id TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, case_count INTEGER DEFAULT 0, submitter_id INTEGER, views INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`
    ).run();
  } catch (_) {}

  // 일일 한도(남용 차단)
  try {
    const c = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM ic_shared_answers WHERE submitter_id = ? AND created_at >= datetime('now','-1 day')`
    ).bind(user.id).first();
    if ((c?.n || 0) >= DAILY_LIMIT) return json({ error: '오늘 공유 한도를 초과했어요. 내일 다시 시도해주세요.', code: 'rate_limit' }, 429);
  } catch (_) {}

  let id = '';
  for (let i = 0; i < 5; i++) {
    const cand = genId();
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO ic_shared_answers (id, question, answer, case_count, submitter_id) VALUES (?, ?, ?, ?, ?)`
    ).bind(cand, question, answer, caseCount, user.id).run();
    if (r?.meta?.changes > 0) { id = cand; break; }
  }
  if (!id) return error('공유 링크 생성에 실패했어요. 잠시 후 다시 시도해주세요.', 500);

  return json({ ok: true, id, url: `${SITE}/a/${id}` });
});
