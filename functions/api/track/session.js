/**
 * 세션 체류 시간 트래킹 — 일자별 카운터 방식
 *   POST /api/track/session { duration: <초> }
 *
 * 한 세션이 끝날 때 1회 호출 (페이지 unload). duration만큼 누적,
 * sessions_count는 +1. 매 세션마다 row 만들지 않아 부하 거의 0.
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  let dur = 0;
  try { const body = await request.json(); dur = Math.max(0, Math.min(parseInt(body.duration || 0, 10), 7200)); } catch (_) {}
  const date = kstDateKey();
  await env.DB.prepare(
    `INSERT INTO ic_sessions_daily (date, sessions_count, total_duration_sec)
     VALUES (?, 1, ?)
     ON CONFLICT (date) DO UPDATE SET
       sessions_count = sessions_count + 1,
       total_duration_sec = total_duration_sec + excluded.total_duration_sec`
  ).bind(date, dur).run();
  return json({ ok: true });
});
