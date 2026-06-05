/**
 * v2.13.0: 회원용 카톡 TXT 사례 자동수집 — POST /api/cases/extract (로그인)
 *   회원이 카톡/상담 대화 붙여넣기 → PII 마스킹 → AI 추출 → ic_insurance_cases(pending, submitter_id=회원)
 *   - 일일 한도(LLM 비용 보호, ask 와 분리 카운터) · 1건 이상 추출 시 +10P · 검수 승인 시 건당 +20P(기존 흐름)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest, maybePromoteByPoints } from '../../_lib/auth.js';
import { callLLM, aiProvider } from '../../_lib/ai.js';
import { maskPII } from '../../_lib/mask.js';

const MAX_TEXT = 12000;        // 회원은 비용 보호 위해 관리자(30000)보다 낮게
const AWARD = 10;
const CATS = ['underwrite', 'disclosure', 'claim'];
const DAILY = { member: 3, certified: 10, premium: 30, admin: 999 };
const kstDateKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const SYSTEM = `너는 보험 인수심사·고지·보상 사례 추출 전문가다. 채팅/커뮤니티/상담 텍스트에서 사례 정보를 최대한 상세하고 빠짐없이, 많이 추출한다.
- 결과(가입/부담보/할증/거절/지급/삭감 등)가 명확하면 기록. 불명확해도 질병·보험사·상황 등 사례성 정보가 있으면 추출하고 summary에 '상담/문의'로 표기.
- 카테고리: underwrite(질병·이력 → 가입 가능성·조건), disclosure(고지·알릴의무·부담보·할증), claim(보상·청구·지급·삭감·거절).
- 한 대화에 여러 사례가 섞이면 모두 각각 추출. 같은 질병이라도 보험사·상품·조건이 다르면 별도 항목. 한 줄 경험담도 정보가 있으면 포함.
- 각 필드를 가능한 한 구체적으로 채워라:
  · disease: 구체 진단명(병기·부위·수치 포함, 예 "갑상선 유두암 1기", "혈압 140/90")
  · elapsed_period: 진단/완치 후 경과기간 · join_condition: 가입 조건 구체적으로(부담보 부위·기간, 할증률, 면책, 한도)
  · result: 최종 결과 구체적으로(예 "5년 부담보 가입", "할증 50% 가입", "거절")
  · summary: 핵심 1~2줄(질병·보험사·결과)
  · special_notes: 위 필드에 안 담긴 추가 정보를 최대한 풍부하게 — 보험종류(생명/손해/실손/암/간병 등)·담보/특약명·가입금액·보험료·치료/수술/투약 내용·재발 여부·가족력·직업·심사 근거·청구금액·지급/삭감 사유 등.
- 순수 잡담·인사·이모티콘·홍보만 제외. 개인정보는 이미 마스킹됨([이름] 등).
- 반드시 아래 JSON만 출력(설명·코드펜스 금지):
{"cases":[{"category":"underwrite|disclosure|claim","disease":"","insurer":"","gender":"M|F|","age":null,"elapsed_period":"","join_condition":"","result":"","summary":"","special_notes":""}]}
- 사례가 없으면 {"cases":[]} 만.`;

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
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);
  if (!aiProvider(env)) return json({ error: 'AI 키가 설정되지 않았습니다.', code: 'no_key' }, 503);

  const body = await request.json().catch(() => ({}));
  const raw = String(body?.text || '').trim();
  if (raw.length < 20) return error('분석할 대화 내용이 너무 짧습니다. (최소 20자)');

  // 일일 한도 (LLM 비용 보호) — ask 카운터(m{id})와 분리된 x{id}
  const date = kstDateKey();
  const limit = DAILY[user.role] || DAILY.member;
  let count = 1;
  try {
    const r = await env.DB.prepare(
      `INSERT INTO ic_ai_usage (date, ip_hash, count) VALUES (?, ?, 1)
       ON CONFLICT (date, ip_hash) DO UPDATE SET count = count + 1 RETURNING count`
    ).bind(date, `x${user.id}`).first();
    count = r?.count || 1;
  } catch (_) {}
  if (count > limit) {
    return json({ error: `오늘 자동추출 한도(${limit}회)를 다 썼어요. 내일 다시 이용해주세요.`, code: 'rate_limit' }, 429);
  }

  // 1) 개인정보 마스킹 → 2) AI 추출
  const { text: masked, masked: maskStats } = maskPII(raw.slice(0, MAX_TEXT));
  const r = await callLLM(env, SYSTEM, masked, { maxTokens: 4500 });
  if (!r.ok) return json({ error: 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.', code: r.error }, 502);
  const cases = parseCases(r.text).slice(0, 40);

  // 3) pending 적재 (submitter_id = 회원 → 승인 시 +20P 가 본인에게)
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 40, 'kakao_txt', 'pending', ?)`
      ).bind(
        category, disease, clip(c.insurer, 60),
        (c.gender === 'M' || c.gender === 'F') ? c.gender : null, age,
        clip(c.elapsed_period, 60), clip(c.join_condition, 80), clip(c.result, 80),
        summary, clip(c.special_notes, 500), user.id
      ).run();
      inserted++;
    } catch (_) {}
  }

  // 기여 보상: 1건 이상 추출 시 +10P (등급 자동승급 연동)
  let pointsAwarded = 0;
  if (inserted > 0) {
    try {
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + ? WHERE id = ?`).bind(AWARD, user.id).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, ?, 'case_extract')`).bind(user.id, AWARD).run();
      await maybePromoteByPoints(env, user.id);
      pointsAwarded = AWARD;
    } catch (_) {}
  }

  return json({ ok: true, extracted: inserted, found: cases.length, masked: maskStats, points_awarded: pointsAwarded, remaining: Math.max(0, limit - count) });
});
