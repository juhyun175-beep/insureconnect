/**
 * v2.12.0(B안): 상단노출 효과 통계 — GET /api/postings/feature-stats (관리자)
 *   - 현재 노출중 공고 + 누적 조회/공유(engagement)
 *   - 상단노출 포인트 구매 횟수·소진 포인트 (ic_point_log reason='feature_posting')
 *   engagement 출처: ic_link_clicks_daily (company_name='recruit_{id}'/'lecture_{id}', type *_view/_copy/_shared)
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  // table/base/prefix 는 코드 내부 고정값 (사용자 입력 아님)
  const featuredOf = async (table, base, prefix) => {
    try {
      const rs = await env.DB.prepare(
        `SELECT p.id, p.title, p.featured_until,
                COALESCE((SELECT SUM(clicks) FROM ic_link_clicks_daily
                          WHERE company_name = '${prefix}' || p.id
                            AND company_type IN ('${base}_view','${base}_copy','${base}_shared')), 0) AS engagement,
                COALESCE((SELECT SUM(clicks) FROM ic_link_clicks_daily
                          WHERE company_name = '${prefix}' || p.id
                            AND company_type = '${base}_form'), 0) AS form_clicks
           FROM ${table} p
          WHERE p.featured_until IS NOT NULL AND p.featured_until > datetime('now')
          ORDER BY p.featured_until DESC`
      ).all();
      return (rs.results || []).map((r) => ({ id: r.id, title: r.title, featured_until: r.featured_until, engagement: r.engagement || 0, form_clicks: r.form_clicks || 0, type: base }));
    } catch (_) { return []; }
  };

  const [rec, lec] = await Promise.all([
    featuredOf('ic_recruitments', 'recruit', 'recruit_'),
    featuredOf('ic_lectures', 'lecture', 'lecture_'),
  ]);
  const featured = [...rec, ...lec].sort((a, b) => String(b.featured_until).localeCompare(String(a.featured_until)));
  const total_engagement = featured.reduce((s, f) => s + (f.engagement || 0), 0);
  const total_conversion = featured.reduce((s, f) => s + (f.form_clicks || 0), 0);

  let purchases = 0, points_spent = 0;
  try {
    const buy = await env.DB.prepare(
      `SELECT COUNT(*) AS purchases, COALESCE(SUM(-delta),0) AS points_spent
         FROM ic_point_log WHERE reason='feature_posting'`
    ).first();
    purchases = buy?.purchases || 0;
    points_spent = buy?.points_spent || 0;
  } catch (_) {}

  return json({
    ok: true,
    featured_now: featured.length,
    featured,
    purchases,        // 포인트로 구매한 상단노출 횟수 (무료 3일 맛보기 제외)
    points_spent,     // 소진된 포인트 합계
    total_engagement, // 현재 노출중 공고들의 누적 조회·공유 합
    total_conversion, // 현재 노출중 공고들의 누적 폼클릭(전환) 합
  });
});
