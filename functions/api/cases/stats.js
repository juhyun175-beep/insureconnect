/**
 * v2.10.0: 보험 사례 데이터센터 통계 (관리자) — GET /api/cases/stats  (#12)
 *   총/인수/고지/보상 사례, 보험사별·질병별, 담보, 회원 포인트, AI 사용량·예상 비용
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const one = async (env, sql, ...binds) => {
  try { return await env.DB.prepare(sql).bind(...binds).first(); } catch (_) { return null; }
};
const all = async (env, sql, ...binds) => {
  try { const r = await env.DB.prepare(sql).bind(...binds).all(); return r.results || []; } catch (_) { return []; }
};

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const total = (await one(env, `SELECT COUNT(*) n FROM ic_insurance_cases`))?.n || 0;
  const pending = (await one(env, `SELECT COUNT(*) n FROM ic_insurance_cases WHERE verify_status='pending'`))?.n || 0;
  const approved = (await one(env, `SELECT COUNT(*) n FROM ic_insurance_cases WHERE verify_status='approved'`))?.n || 0;
  const excellent = (await one(env, `SELECT COUNT(*) n FROM ic_insurance_cases WHERE excellent=1`))?.n || 0;
  const byCat = await all(env, `SELECT category, COUNT(*) n FROM ic_insurance_cases WHERE verify_status='approved' GROUP BY category`);
  const cat = {}; for (const r of byCat) cat[r.category] = r.n;
  const topInsurers = await all(env, `SELECT insurer, COUNT(*) n FROM ic_insurance_cases WHERE verify_status='approved' AND insurer IS NOT NULL AND insurer<>'' GROUP BY insurer ORDER BY n DESC LIMIT 10`);
  const topDiseases = await all(env, `SELECT disease, COUNT(*) n FROM ic_insurance_cases WHERE verify_status='approved' AND disease IS NOT NULL AND disease<>'' GROUP BY disease ORDER BY n DESC LIMIT 10`);
  const newToday = (await one(env, `SELECT COUNT(*) n FROM ic_insurance_cases WHERE substr(created_at,1,10)=?`, today))?.n || 0;

  const covTotal = (await one(env, `SELECT COUNT(*) n FROM ic_product_coverages`))?.n || 0;
  const covApproved = (await one(env, `SELECT COUNT(*) n FROM ic_product_coverages WHERE verify_status='approved'`))?.n || 0;

  const memTotal = (await one(env, `SELECT COUNT(*) n FROM ic_members`))?.n || 0;
  const points = (await one(env, `SELECT COALESCE(SUM(points),0) s FROM ic_members`))?.s || 0;

  // AI 사용량 + 예상 비용 (ic_ai_logs: in_len/out_len 글자수 → 토큰 추정 → gpt-4o-mini 단가)
  const aiToday = (await one(env, `SELECT COUNT(*) n FROM ic_ai_logs WHERE date=?`, today))?.n || 0;
  const aiTotal = (await one(env, `SELECT COUNT(*) n FROM ic_ai_logs`))?.n || 0;
  const lenSum = await one(env, `SELECT COALESCE(SUM(in_len),0) i, COALESCE(SUM(out_len),0) o FROM ic_ai_logs`);
  const inTok = (lenSum?.i || 0) / 2.2, outTok = (lenSum?.o || 0) / 2.2;  // 한글 ~2.2자/토큰 추정
  const estCost = (inTok / 1e6) * 0.15 + (outTok / 1e6) * 0.60;  // gpt-4o-mini 기준 추정(비전·gpt-4o 제외)

  return json({
    cases: { total, pending, approved, excellent, new_today: newToday,
      by_category: { underwrite: cat.underwrite || 0, disclosure: cat.disclosure || 0, claim: cat.claim || 0 },
      top_insurers: topInsurers, top_diseases: topDiseases },
    coverages: { total: covTotal, approved: covApproved },
    members: { total: memTotal, total_points: points },
    ai: { today: aiToday, total: aiTotal, est_cost_usd: Math.round(estCost * 100) / 100 },
  });
});
