/**
 * v2.9.3: 보험 상품 PDF → AI 담보 스펙 추출 (관리자)
 *   POST /api/coverages/analyze  body: { images:[dataURL], text, source_file }
 *   - images(페이지 이미지) 있으면 비전(GPT-4o)으로 표를 정확히 읽음(스캔본·복잡표 대응)
 *   - 없으면 텍스트 분석. GPT 1회 호출.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { callLLM, callVision, aiProvider } from '../../_lib/ai.js';

const MAX_TEXT = 30000;

const SYSTEM = `너는 보험 상품자료(상품요약서·가입설계서·제안서) 분석기다. 입력(텍스트 또는 표 이미지)에서 담보별 스펙을 빠짐없이 추출한다.
- 표의 모든 행을 각각 추출. 같은 상품의 여러 담보를 각각 분리. 담보가 수십 개면 수십 행 모두.
- 필드: insurer(보험사), product_name(상품명), coverage_name(담보명), join_amount(가입금액), premium(보험료), join_age(가입나이), payment_period(납입기간), maturity_period(만기), gender(남|여|공통), notes(조건/비고)
- 숫자·금액·나이를 표에 보이는 그대로. 값이 없으면 빈 문자열. 표지·광고·약관 설명문은 제외.
- 반드시 아래 JSON만 출력(설명·코드펜스 금지):
{"coverages":[{"insurer":"","product_name":"","coverage_name":"","join_amount":"","premium":"","join_age":"","payment_period":"","maturity_period":"","gender":"","notes":""}]}
- 담보가 하나도 없으면 {"coverages":[]} 만 출력.`;

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
  const images = Array.isArray(body?.images) ? body.images.filter(s => typeof s === 'string' && s.startsWith('data:image')).slice(0, 10) : [];
  const text = String(body?.text || '').trim();
  const sourceFile = body?.source_file ? String(body.source_file).slice(0, 200) : null;

  let r;
  let mode;
  if (images.length) {
    mode = 'vision';
    r = await callVision(env, SYSTEM, '이 보험 상품자료 이미지에서 담보별 스펙을 모두 표로 추출해줘.', images, { maxTokens: 4000 });
  } else if (text.length >= 30) {
    mode = 'text';
    r = await callLLM(env, SYSTEM, text.slice(0, MAX_TEXT), { maxTokens: 4000 });
  } else {
    return error('분석할 PDF 이미지/텍스트가 없습니다. (스캔본이면 페이지 이미지로 분석됩니다)');
  }
  if (!r.ok) return json({ error: 'AI 분석 실패', code: r.error, detail: r.detail || null, mode }, 502);

  const rows = parseRows(r.text);
  const clip = (v, n) => (v == null || v === '') ? null : String(v).slice(0, n);
  let inserted = 0;
  for (const c of rows.slice(0, 200)) {
    const coverage = clip(c.coverage_name, 100), insurer = clip(c.insurer, 60);
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
  // 진단: 0건이면 AI 원응답 앞부분을 함께 반환(디버깅)
  return json({ ok: true, extracted: inserted, found: rows.length, mode, raw: inserted === 0 ? String(r.text || '').slice(0, 300) : undefined });
});
