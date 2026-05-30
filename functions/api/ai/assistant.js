/**
 * v2.2.0: AI 보험비서 엔드포인트
 *   POST /api/ai/assistant  body: { mode, input }
 *   보안: 서버 키만 사용 / IP 일일 레이트리밋 / 입력 길이 제한 / 안전 프롬프트
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { AI_MODES, callLLM, aiProvider } from '../../_lib/ai.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

// 등급별 1일 AI 사용 한도 (서버 강제 = 실제 권한부여)
const TIER_LIMIT = { member: 5, certified: 20, premium: 100, admin: 9999 };
const MAX_INPUT = 2000;

function kstDateKey() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const onRequestPost = async ({ env, request }) => handle(async () => {
  if (isBot(request)) return error('not allowed', 403);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }

  const mode = String(body?.mode || '');
  const input = String(body?.input || '').trim();
  const conf = AI_MODES[mode];
  if (!conf) return error('Invalid mode');
  if (!input) return error('입력을 작성해주세요.');
  if (input.length > MAX_INPUT) return error(`입력이 너무 깁니다 (최대 ${MAX_INPUT}자).`);

  // 로그인 필수 (회원 등급제 — 실제 권한부여)
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return json({ error: 'AI 보험비서는 로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  }
  const limit = TIER_LIMIT[user.role] || TIER_LIMIT.member;

  // 키 미설정 → 안내 (503)
  if (!aiProvider(env)) {
    return json({ error: 'AI 키가 아직 설정되지 않았습니다. 관리자에게 문의해주세요.', code: 'no_key' }, 503);
  }

  // 등급별 1일 한도 (회원 id 기준, 증가 후 검사 → LLM 호출 전 차단)
  const date = kstDateKey();
  const usageKey = `m${user.id}`;
  let count = 1;
  try {
    const r = await env.DB.prepare(
      `INSERT INTO ic_ai_usage (date, ip_hash, count) VALUES (?, ?, 1)
       ON CONFLICT (date, ip_hash) DO UPDATE SET count = count + 1 RETURNING count`
    ).bind(date, usageKey).first();
    count = r?.count || 1;
  } catch (_) {}
  if (count > limit) {
    return json({ error: `오늘 이용 한도(${user.role === 'member' ? '일반회원 ' : ''}${limit}회)를 초과했습니다. 등급을 올리면 더 많이 이용할 수 있어요.`, code: 'rate_limit' }, 429);
  }

  const r = await callLLM(env, conf.system, input.slice(0, MAX_INPUT), { maxTokens: 900 });
  if (!r.ok) {
    const msg = r.error === 'no_key' ? 'AI 키 미설정' : 'AI 응답을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.';
    return json({ error: msg, code: r.error }, 502);
  }

  // 사용 로그(개인정보 미저장 — 길이/모드만)
  try {
    await env.DB.prepare(`INSERT INTO ic_ai_logs (ts, date, mode, in_len, out_len) VALUES (?, ?, ?, ?, ?)`)
      .bind(new Date().toISOString(), date, mode, input.length, r.text.length).run();
  } catch (_) {}

  return json({ text: r.text, remaining: Math.max(0, limit - count), role: user.role });
});
