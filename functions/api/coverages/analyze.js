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

const SYSTEM = `너는 보험 상품자료(상품요약서·가입설계서·제안서) 분석기다. 표 이미지/텍스트에서 담보별 스펙을 하나도 빠뜨리지 말고 전부 추출한다.
- 표에 보이는 **모든 담보 행을 전부** 추출하라. 담보가 30개면 30행, 50개면 50행 모두. (암진단비·유사암·소액암·뇌혈관질환·뇌출혈·허혈성심장질환·급성심근경색·수술비·입원일당·골절·후유장해·일상생활배상 등 항목별로 각각 한 행)
- 금액이 조건별로 다르면(1년이내/이후, 갱신/비갱신, 남/여, 표준/선택형) 각 조건을 별도 행으로 분리하거나 notes에 모두 기록.
- 필드: insurer(보험사), product_name(상품명), coverage_name(담보명), join_amount(가입금액), premium(보험료), join_age(가입나이), payment_period(납입기간), maturity_period(만기), gender(남|여|공통), notes(조건/비고)
- 금액·나이·숫자는 표에 보이는 그대로(예: "3,000만원", "1구좌 1천만"). 값 없으면 빈 문자열. 표지·로고·약관 설명문단은 제외.
- 반드시 아래 JSON만 출력(설명·코드펜스 금지):
{"coverages":[{"insurer":"","product_name":"","coverage_name":"","join_amount":"","premium":"","join_age":"","payment_period":"","maturity_period":"","gender":"","notes":""}]}
- 담보가 하나도 없으면 {"coverages":[]} 만.`;

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
    r = await callVision(env, SYSTEM, '이 보험 상품자료 이미지의 표에서 모든 담보를 하나도 빠짐없이 추출해줘. 담보명과 가입금액을 정확히, 행이 많아도 전부.', images, { maxTokens: 8000 });
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
