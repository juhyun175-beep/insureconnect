/**
 * v2.9.7: 사례 기반 AI 답변 (RAG) — POST /api/cases/ask  body: { question }
 *   질문 → 사례DB·담보DB 검색(키워드) → 유사사례 컨텍스트 → GPT(마지막 단계) → 답변 + 근거(사례 수·보험사·승인/거절)
 *   #8(근거 제시) + #11(GPT는 마지막에만, DB 우선)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { callLLM, aiProvider } from '../../_lib/ai.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const TIER_LIMIT = { member: 5, certified: 20, premium: 100, admin: 9999 };
const MAX_Q = 500;
const STOP = new Set(['보험', '가입', '경우', '관련', '어떻게', '얼마', '정도', '문의', '질문', '알려', '주세요', '있나요', '되나요', '될까요', '가능', '어떤', '무슨', '그리고', '하면', '인데', '한데', '대해', '대한']);

function kstDateKey() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }

function extractTerms(q) {
  const words = String(q).replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let w of words) {
    w = w.replace(/(은|는|이|가|을|를|에|의|도|와|과|로|으로|에서|에게|까지|부터|만|요|인가요|될까요|되나요|있나요|나요|까요|입니다|예요|이에요|한|할|하는|했는데|인데|한데)$/g, '');
    if (w.length >= 2 && !STOP.has(w)) out.push(w);
  }
  return [...new Set(out)].sort((a, b) => b.length - a.length).slice(0, 6);
}

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ env, request }) => handle(async () => {
  if (isBot(request)) return error('not allowed', 403);
  const body = await request.json().catch(() => ({}));
  const question = String(body?.question || '').trim();
  if (!question) return error('질문을 입력해주세요.');
  if (question.length > MAX_Q) return error(`질문이 너무 깁니다 (최대 ${MAX_Q}자).`);

  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  if (!aiProvider(env)) return json({ error: 'AI 키가 설정되지 않았습니다.', code: 'no_key' }, 503);

  // 일일 한도(어시스턴트와 공유)
  const date = kstDateKey();
  const limit = TIER_LIMIT[user.role] || TIER_LIMIT.member;
  let count = 1;
  try {
    const r = await env.DB.prepare(
      `INSERT INTO ic_ai_usage (date, ip_hash, count) VALUES (?, ?, 1)
       ON CONFLICT (date, ip_hash) DO UPDATE SET count = count + 1 RETURNING count`
    ).bind(date, `m${user.id}`).first();
    count = r?.count || 1;
  } catch (_) {}
  // 무료 한도 초과 → 포인트(5P)로 추가 질문 (#10 포인트 사용처)
  const EXTRA_COST = 5;
  let usedPoints = 0;
  if (count > limit) {
    const m = await env.DB.prepare(`SELECT points FROM ic_members WHERE id = ?`).bind(user.id).first();
    const pts = m?.points || 0;
    if (pts >= EXTRA_COST) {
      try {
        await env.DB.prepare(`UPDATE ic_members SET points = points - ? WHERE id = ?`).bind(EXTRA_COST, user.id).run();
        await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, ?, 'ai_extra')`).bind(user.id, -EXTRA_COST).run();
      } catch (_) {}
      usedPoints = EXTRA_COST;
    } else {
      return json({ error: `오늘 무료 한도(${limit}회)를 다 썼어요. 포인트 ${EXTRA_COST}P로 추가 질문할 수 있어요(보유 ${pts}P). 사례를 공유하면 포인트가 쌓입니다.`, code: 'rate_limit' }, 429);
    }
  }

  // 1) 사례 검색 (키워드 LIKE, 신뢰도순)
  const terms = extractTerms(question);
  let cases = [];
  if (terms.length) {
    const conds = terms.map(() => '(disease LIKE ? OR summary LIKE ? OR insurer LIKE ? OR result LIKE ?)').join(' OR ');
    const binds = [];
    for (const t of terms) { const p = `%${t}%`; binds.push(p, p, p, p); }
    const rs = await env.DB.prepare(
      `SELECT category, disease, insurer, gender, age, elapsed_period, join_condition, result, summary, reliability
       FROM ic_insurance_cases WHERE verify_status='approved' AND (${conds})
       ORDER BY reliability DESC, created_at DESC LIMIT 12`
    ).bind(...binds).all();
    cases = rs.results || [];
  }
  // 2) 담보 스펙 검색
  let coverages = [];
  if (terms.length) {
    const conds = terms.map(() => '(coverage_name LIKE ? OR insurer LIKE ? OR product_name LIKE ?)').join(' OR ');
    const binds = [];
    for (const t of terms) { const p = `%${t}%`; binds.push(p, p, p); }
    const rs = await env.DB.prepare(
      `SELECT insurer, product_name, coverage_name, join_amount, premium, join_age
       FROM ic_product_coverages WHERE verify_status='approved' AND (${conds}) LIMIT 10`
    ).bind(...binds).all();
    coverages = rs.results || [];
  }

  // 3) 근거 통계
  const insurers = [...new Set(cases.map(c => c.insurer).filter(Boolean))];
  let approve = 0, reject = 0;
  for (const c of cases) {
    const t = `${c.result || ''} ${c.summary || ''}`;
    if (/거절|부결|삭감|불가|거부|면책/.test(t)) reject++;
    else if (/가입|승인|지급|정상|가능|부담보|할증/.test(t)) approve++;
  }

  // 4) 컨텍스트 + GPT (마지막 단계)
  const caseCtx = cases.map((c, i) =>
    `[사례${i + 1}|신뢰도${c.reliability}] ${c.insurer || '보험사?'} / ${c.disease || ''}${c.age ? ` / ${c.age}세` : ''}${c.elapsed_period ? ` / ${c.elapsed_period}` : ''} / 결과: ${c.result || c.summary || ''}`
  ).join('\n');
  const covCtx = coverages.map(c => `- ${c.insurer || ''} ${c.product_name || ''} / ${c.coverage_name || ''} / 가입금액 ${c.join_amount || '?'} / 보험료 ${c.premium || '?'}`).join('\n');

  const SYSTEM = `너는 보험설계사를 돕는 '삼따AI'다. 아래 [실제 사례·담보 데이터]를 최우선 근거로 질문에 답한다.
- 사례 근거가 있으면 보험사·결과 경향을 구체적으로 인용해 자신감 있게 답하라. 사례가 없거나 적어도 그 사실을 절대 언급하지 말고, 보험 전문가로서 실무적이고 확신 있게 답하라. ('사례가 적다/부족하다/데이터가 없다' 같은 표현 금지)
- 최종 판단은 보험사 심사·약관 기준이라는 점은 마지막에 짧게 한 번만. 한국어로 핵심부터 명확하게.
- 근거 요약(사례 수·보험사·승인/거절)은 시스템이 별도 표시하니 본문에서 반복하지 마라.

[실제 사례 데이터 ${cases.length}건]
${caseCtx || '(관련 사례 없음)'}

[관련 담보 스펙]
${covCtx || '(관련 담보 없음)'}`;

  // v2.12.5(A): 멀티턴 — 이전 대화(최근 3턴)를 컨텍스트로 포함 (사례 검색은 현재 질문 기준)
  const history = Array.isArray(body?.history) ? body.history.slice(-3) : [];
  let userMsg = question;
  if (history.length) {
    const hist = history.map((h) => 'Q: ' + String((h && h.q) || '').slice(0, 300) + '\nA: ' + String((h && h.a) || '').slice(0, 500)).join('\n\n');
    userMsg = '[이전 대화]\n' + hist + '\n\n[현재 질문]\n' + question;
  }
  const r = await callLLM(env, SYSTEM, userMsg, { maxTokens: 900 });
  if (!r.ok) return json({ error: 'AI 응답 생성 실패', code: r.error }, 502);

  // v2.12.4: 답변 근거가 된 실제 사례(상위 5건)도 반환 → 프론트에서 '근거 사례 카드'로 노출(투명성·신뢰·데이터 과시)
  //   PII는 수집 단계(mask.js)에서 마스킹된 승인 공개 사례만 — 안전
  const sources = cases.slice(0, 5).map((c) => ({
    category: c.category, disease: c.disease, insurer: c.insurer,
    age: c.age, elapsed_period: c.elapsed_period, result: c.result,
    summary: c.summary, reliability: c.reliability,
  }));

  return json({
    answer: r.text,
    evidence: { case_count: cases.length, coverage_count: coverages.length, insurers, approve, reject },
    sources,
    remaining: Math.max(0, limit - count),
    points_used: usedPoints,
  });
});
