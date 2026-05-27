/**
 * 일자별 카운터 증가 — 매번 INSERT 대신 UPSERT
 * 이전에 폭증의 원인이었던 row-per-visit 패턴 제거
 *
 * v2.1.46: 서버측 봇 UA 차단 — 클라이언트 dedupe 통과한 봇/스크래퍼 추가 차단
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9*3600*1000);
  return kst.toISOString().slice(0, 10);
}

export const onRequestPost = async ({ env, request }) => handle(async () => {
  // v2.1.46: 봇 차단 — 통계 데이터 오염 방지
  if (isBot(request)) return json({ ok: true, skipped: 'bot' });
  const date = kstDateKey();
  await env.DB.prepare(
    `INSERT INTO ic_visits_daily (date, visits, unique_visits)
     VALUES (?, 1, 1)
     ON CONFLICT (date) DO UPDATE SET visits = visits + 1`
  ).bind(date).run();
  return json({ ok: true });
});
