/**
 * v2.9.2: 보험 상품 PDF(텍스트) → AI 담보 스펙 추출 → 검수 대기 적재 (관리자)
 *   POST /api/coverages/analyze  body: { text, source_file }
 *   PDF 텍스트는 브라우저(pdf.js)에서 추출해 전송. GPT 1회 호출(비용 절감).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { callLLM, aiProvider } from '../../_lib/ai.js';

const MAX_TEXT = 15000;

const SYSTEM = `너는 보험 상품자료(상품요약서·가입설계서·제안서) 분석기다. 입력 텍스트에서 담보별 스펙을 추출한다.
- 각 담보를 한 행으로. 같은 상품의 여러 담보는 각각 분리.
- 필드: insurer(보험사), product_name(상품명), coverage_name(담보명), join_amount(가입금액), premium(보험료), join_age(가입나이), payment_period(납입기간), maturity_period(만기), gender(남|여|공통), notes(조건/비고)
- 표·수치 중심으로. 값이 없으면 빈 문자열. 광고문구·약관설명은 제외.
- 반드시 아래 JSON만 출력(설명·코드펜스 금지):
{"coverages":[{"insurer":"","product_name":"","coverage_name":"","join_amount":"","premium":"","join_age":"","payment_period":"","maturity_period":"","gender":"","notes":""}]}
- 담보가 없으면 {"coverages":[]} 만 출력.`;

function parseRows(text) {
  if (!text) return [];
  let s = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { const o = JSON.parse(s); return Array.isArray(o?.coverages) ? o.coverages : []; } catch (_) { return []; }
}

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  if (!aiProvider(env)) return json({ error: 'AI 키가 설정되지 않았습니다.', code: 'no_key' }, 503);

  const body = await request.json();
  const raw = String(body?.text || '').trim();
  const sourceFile = body?.source_file ? String(body.source_file).slice(0, 200) : null;
  if (raw.length < 30) return error('분석할 텍스트가 너무 짧습니다. (PDF에서 텍스트가 추출되지 않았을 수 있습니다)');

  const r = await callLLM(env, SYSTEM, raw.slice(0, MAX_TEXT), { maxTokens: 3000 });
  if (!r.ok) return json({ error: 'AI 분석 실패', code: r.error }, 502);
  const rows = parseRows(r.text).slice(0, 120);

  const clip = (v, n) => (v == null || v === '') ? null : String(v).slice(0, n);
  let inserted = 0;
  for (const c of rows) {
    const coverage = clip(c.coverage_name, 100);
    const insurer = clip(c.insurer, 60);
    if (!coverage && !insurer) continue;
    try {
      await env.DB.prepare(
        `INSERT INTO ic_product_coverages
           (insurer, product_name, coverage_name, join_amount, premium, join_age,
            payment_period, maturity_period, gender, notes, source_file, verify_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(
        insurer, clip(c.product_name, 120), coverage, clip(c.join_amount, 60),
        clip(c.premium, 60), clip(c.join_age, 60), clip(c.payment_period, 60),
        clip(c.maturity_period, 60), clip(c.gender, 20), clip(c.notes, 300), sourceFile
      ).run();
      inserted++;
    } catch (_) {}
  }
  return json({ ok: true, extracted: inserted, found: rows.length });
});
