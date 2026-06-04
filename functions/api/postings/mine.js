/**
 * v2.11.0: 내가 등록한 공고 — GET /api/postings/mine (로그인)
 *   본인(submitter_id) 채용/강의 공고 + 상태 + 상단노출(featured) 여부
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);

  // v2.13.2: 공고별 조회수(view+copy+shared) + 폼클릭(전환) 리포트 — table/type/prefix 는 코드 고정값
  const sel = async (table, type, prefix) => {
    const rs = await env.DB.prepare(
      `SELECT p.id, p.title, p.status, p.featured_until, p.created_at,
              CASE WHEN p.featured_until IS NOT NULL AND p.featured_until > datetime('now') THEN 1 ELSE 0 END AS featured,
              COALESCE((SELECT SUM(clicks) FROM ic_link_clicks_daily
                        WHERE company_name = '${prefix}' || p.id
                          AND company_type IN ('${type}_view','${type}_copy','${type}_shared')), 0) AS views,
              COALESCE((SELECT SUM(clicks) FROM ic_link_clicks_daily
                        WHERE company_name = '${prefix}' || p.id
                          AND company_type = '${type}_form'), 0) AS form_clicks
       FROM ${table} p WHERE p.submitter_id = ? ORDER BY p.created_at DESC LIMIT 50`
    ).bind(user.id).all();
    return (rs.results || []).map((r) => ({ ...r, type }));
  };
  const [rec, lec] = await Promise.all([sel('ic_recruitments', 'recruit', 'recruit_'), sel('ic_lectures', 'lecture', 'lecture_')]);
  const items = [...rec, ...lec].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  // v2.13.9: 보유 상단노출권(크레딧) — 있으면 프론트에서 '권 사용(무료)' 버튼으로 표시
  const me = await env.DB.prepare(`SELECT feature_credit FROM ic_members WHERE id = ?`).bind(user.id).first();

  return json({ ok: true, items, cost: 50, days: 7, feature_credit: me?.feature_credit || 0 });
});
