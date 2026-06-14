/**
 * v2.65.0: 접속 하트비트 — POST /api/me/ping
 *   로그인 회원의 last_seen 갱신(관리자 「실시간 접속」 표시용). 비로그인은 조용히 무시.
 */
import { json, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user) return json({ ok: false });
    try {
      await env.DB.prepare(`UPDATE ic_members SET last_seen = datetime('now') WHERE id = ?`).bind(user.id).run();
    } catch (_) {
      // last_seen 컬럼 없으면 추가 후 재시도
      try {
        await env.DB.prepare(`ALTER TABLE ic_members ADD COLUMN last_seen TEXT`).run();
        await env.DB.prepare(`UPDATE ic_members SET last_seen = datetime('now') WHERE id = ?`).bind(user.id).run();
      } catch (_) {}
    }
    return json({ ok: true });
  } catch (_) {
    return json({ ok: false });
  }
};
