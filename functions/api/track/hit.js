/**
 * v2.1.70: 유입(엔트리) 추적 — 세션당 1회, 랜딩페이지 + referrer + device + utm 기록
 *   POST /api/track/hit  body: { path, ref, utm }
 *   SSR/SPA 진입 시 클라이언트가 1회 호출. 봇 차단.
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { sourceFromReferrer, deviceFromUA } from '../../_lib/traffic.js';

export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const onRequestPost = async ({ env, request }) => handle(async () => {
  if (isBot(request)) return json({ ok: true, skipped: 'bot' });

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const path = String(body?.path || '/').slice(0, 300);
  const ref  = String(body?.ref || '').slice(0, 500);
  const utm  = body?.utm ? String(body.utm).slice(0, 80) : null;
  const ua   = request.headers.get('User-Agent') || '';

  const { source, host } = sourceFromReferrer(ref);
  const device = deviceFromUA(ua);
  const date = kstDateKey();
  const ts = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO ic_traffic_hits (date, ts, source, referrer, landing, device, utm_source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(date, ts, source, host || null, path, device, utm).run();

  // 가벼운 보존 정리(약 1%): 120일 초과 데이터 삭제
  if (Math.random() < 0.01) {
    await env.DB.prepare(`DELETE FROM ic_traffic_hits WHERE date < date('now','-120 days')`).run().catch(() => {});
  }

  return json({ ok: true });
});
