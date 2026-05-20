/**
 * 일자별 카운터 증가 — 매번 INSERT 대신 UPSERT
 * 이전에 폭증의 원인이었던 row-per-visit 패턴 제거
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9*3600*1000);
  return kst.toISOString().slice(0, 10);
}

export const onRequestPost = async ({ env }) => handle(async () => {
  const date = kstDateKey();
  await env.DB.prepare(
    `INSERT INTO ic_visits_daily (date, visits, unique_visits)
     VALUES (?, 1, 1)
     ON CONFLICT (date) DO UPDATE SET visits = visits + 1`
  ).bind(date).run();
  return json({ ok: true });
});
