/**
 * v2.16.2: 추천 리더보드 — GET /api/referral/leaderboard
 *   상위 추천인(닉네임 마스킹) + 로그인 시 내 순위. 추천 루프 게이미피케이션(신규유입).
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

  const rows = await all(
    `SELECT r.referrer_id AS id, m.nickname AS nickname, COUNT(*) AS n
     FROM ic_referrals r LEFT JOIN ic_members m ON m.id = r.referrer_id
     GROUP BY r.referrer_id ORDER BY n DESC, r.referrer_id ASC LIMIT 5`
  );
  const top = rows.map((r, i) => ({ rank: i + 1, name: mask(r.nickname), n: r.n }));

  let me = null;
  const user = await getUserFromRequest(env, request);
  if (user) {
    const mine = await first(`SELECT COUNT(*) AS n FROM ic_referrals WHERE referrer_id = ?`, user.id);
    const myN = mine?.n || 0;
    let rank = null;
    if (myN > 0) {
      const rk = await first(
        `SELECT COUNT(*) + 1 AS rank FROM (SELECT referrer_id, COUNT(*) AS c FROM ic_referrals GROUP BY referrer_id) t WHERE t.c > ?`,
        myN
      );
      rank = rk?.rank || null;
    }
    me = { rank, n: myN };
  }

  return json({ ok: true, top, me });
});
