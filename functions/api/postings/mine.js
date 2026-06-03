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

  const sel = async (table, type) => {
    const rs = await env.DB.prepare(
      `SELECT id, title, status, featured_until, created_at,
              CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now') THEN 1 ELSE 0 END AS featured
       FROM ${table} WHERE submitter_id = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(user.id).all();
    return (rs.results || []).map((r) => ({ ...r, type }));
  };
  // table/type 은 코드 내부 고정값 — 사용자 입력 아님
  const [rec, lec] = await Promise.all([sel('ic_recruitments', 'recruit'), sel('ic_lectures', 'lecture')]);
  const items = [...rec, ...lec].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return json({ ok: true, items, cost: 50, days: 7 });
});
