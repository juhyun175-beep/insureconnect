/**
 * GET /api/cases/contributors
 * Approved case contributors are shown as masked aggregate statistics only.
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';
import { loadCaseContributors, mask } from '../../_lib/contributors.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const rows = await loadCaseContributors(env, null, 5);
  const top = rows.map((r, i) => ({ rank: i + 1, name: mask(r.nickname), n: r.n, grade: r.role || 'member' }));

  let me = null;
  const user = await getUserFromRequest(env, request);
  if (user) {
    const mine = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM ic_insurance_cases WHERE submitter_id = ? AND verify_status = 'approved'`
    ).bind(user.id).first().catch(() => null);
    const myN = mine?.n || 0;
    let rank = null;
    if (myN > 0) {
      const rk = await env.DB.prepare(
        `SELECT COUNT(*) + 1 AS rank FROM (
           SELECT submitter_id, COUNT(*) AS c FROM ic_insurance_cases
           WHERE verify_status = 'approved' AND submitter_id IS NOT NULL
           GROUP BY submitter_id
         ) t WHERE t.c > ?`
      ).bind(myN).first().catch(() => null);
      rank = rk?.rank || null;
    }
    me = { rank, n: myN, grade: user.role || 'member' };
  }

  return json({ ok: true, top, me });
});
