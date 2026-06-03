/**
 * v2.9.1: 카톡/단톡 TXT → 개인정보 마스킹 → AI 사례 추출 → 검수 대기 적재 (#3+#4)
 *   POST /api/cases/analyze (관리자) body: { text }
 *   - 마스킹 후 GPT 1회 호출로 보험 사례만 구조화 추출 → ic_insurance_cases(pending, source=kakao_txt)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { callLLM, aiProvider } from '../../_lib/ai.js';
import { maskPII } from '../../_lib/mask.js';

const MAX_TEXT = 30000;
const CATS = ['underwrite', 'disclosure', 'claim'];

const SYSTEM = `너는 보험 사례 추출기다. 채팅/커뮤니티 텍스트에서 보험 인수심사·고지·보상 관련 정보를 폭넓게 추출한다.
- 결과(가입/부담보/할증/거절/지급/삭감 등)가 명확하면 그 결과를 기록. 결과가 불명확해도 질병·보험사·상황 등 사례성 정보가 있으면 추출하고 summary에 '상담/문의'로 표기.
- 카테고리: underwrite(질병·이력으로 인한 가입 가능성·조건), disclosure(고지·알릴의무·부담보·할증), claim(보상·청구·지급·삭감·거절).
- 한 대화에 여러 사례가 섞여 있으면 모두 각각 추출. 같은 질병이라도 보험사·조건이 다르면 별도 항목. 짧은 한 줄 경험담도 정보가 있으면 포함.
- 순수 잡담·인사·이모티콘·홍보만 있는 내용만 제외. 개인정보는 이미 마스킹됨([이름] 등).
- 반드시 아래 JSON만 출력(설명·코드펜스 금지):
{"cases":[{"category":"underwrite|disclosure|claim","disease":"","insurer":"","gender":"M|F|","age":null,"elapsed_period":"","join_condition":"","result":"","summary":"","special_notes":""}]}
- 사례가 없으면 {"cases":[]} 만. summary는 한국어로 핵심(질병/보험사/결과 또는 문의)을 한두 줄.`;

function parseCases(text) {
  if (!text) return [];
  let s = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try {
    const obj = JSON.parse(s);
    return Array.isArray(obj?.cases) ? obj.cases : [];
  } catch (_) { return []; }
}

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  if (!aiProvider(env)) return json({ error: 'AI 키가 설정되지 않았습니다.', code: 'no_key' }, 503);

  const body = await request.json();
  const raw = String(body?.text || '').trim();
  if (raw.length < 20) return error('분석할 텍스트가 너무 짧습니다.');

  // 1) 개인정보 마스킹
  const { text: masked, masked: maskStats } = maskPII(raw.slice(0, MAX_TEXT));

  // 2) AI 추출 (1회)
  const r = await callLLM(env, SYSTEM, masked, { maxTokens: 4000 });
  if (!r.ok) return json({ error: 'AI 분석 실패', code: r.error }, 502);
  const cases = parseCases(r.text).slice(0, 80);

  // 3) pending 적재
  const clip = (v, n) => (v == null || v === '') ? null : String(v).slice(0, n);
  let inserted = 0;
  for (const c of cases) {
    const category = CATS.includes(c.category) ? c.category : 'underwrite';
    const summary = clip(c.summary, 500), disease = clip(c.disease, 80);
    if (!summary && !disease) continue;
    const age = Number.isFinite(+c.age) && +c.age > 0 ? Math.min(120, +c.age) : null;
    try {
      await env.DB.prepare(
        `INSERT INTO ic_insurance_cases
           (category, disease, insurer, gender, age, elapsed_period, join_condition,
            result, summary, special_notes, reliability, source, verify_status, submitter_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 40, 'kakao_txt', 'pending', NULL)`
      ).bind(
        category, disease, clip(c.insurer, 60),
        (c.gender === 'M' || c.gender === 'F') ? c.gender : null, age,
        clip(c.elapsed_period, 60), clip(c.join_condition, 80), clip(c.result, 80),
        summary, clip(c.special_notes, 500)
      ).run();
      inserted++;
    } catch (_) {}
  }

  return json({ ok: true, extracted: inserted, found: cases.length, masked: maskStats, raw: inserted === 0 ? String(r.text || '').slice(0, 300) : undefined });
});
