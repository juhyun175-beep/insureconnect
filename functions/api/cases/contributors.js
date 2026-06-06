/**
 * v2.20.0: 사례 기여 리더보드 — GET /api/cases/contributors
 *   승인 사례 기여 상위(닉네임 마스킹·등급 배지) + 로그인 시 내 순위/기여수.
 *   기여 게이미피케이션: 회원이 등록한 사례가 AI 품질을 높임 → 기여를 가시화해 참여 유도(referral/leaderboard 패턴 미러링).
 *   닉네임은 첫 글자만 노출(개인정보 보호).
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

function mask(name) {
  const arr = Array.from(String(name || '').trim());
  if (!arr.length) return '회원';
  if (arr.length === 1) return arr[0] + '●';
  return arr[0] + '●'.repeat(Math.min(arr.length - 1, 3));
}

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const all = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results || []).catch(() => []);
  const first = (sql, ...b) => env.DB.prepare(sql).bind(...b).first().catch(() => null);

  // 승인(approved) 사례를 기여자(submitter_id)별 집계 — 검수 통과한 기여만 카운트
  const rows = await all(
    `SELECT c.submitter_id AS id, m.nickname AS nickname, m.role AS role, COUNT(*) AS n
     FROM ic_insurance_cases c LEFT JOIN ic_members m ON m.id = c.submitter_id
     WHERE c.verify_status = 'approved' AND c.submitter_id IS NOT NULL
     GROUP BY c.submitter_id ORDER BY n DESC, c.submitter_id ASC LIMIT 5`
  );
  const top = rows.map((r, i) => ({ rank: i + 1, name: mask(r.nickname), n: r.n, grade: r.role || 'member' }));

  let me = null;
  const user = await getUserFromRequest(env, request);
  if (user) {
    const mine = await first(
      `SELECT COUNT(*) AS n FROM ic_insurance_cases WHERE submitter_id = ? AND verify_status = 'approved'`,
      user.id
    );
    const myN = mine?.n || 0;
    let rank = null;
    if (myN > 0) {
      const rk = await first(
        `SELECT COUNT(*) + 1 AS rank FROM (
           SELECT submitter_id, COUNT(*) AS c FROM ic_insurance_cases
           WHERE verify_status = 'approved' AND submitter_id IS NOT NULL
           GROUP BY submitter_id
         ) t WHERE t.c > ?`,
        myN
      );
      rank = rk?.rank || null;
    }
    me = { rank, n: myN, grade: user.role || 'member' };
  }

  return json({ ok: true, top, me });
});
