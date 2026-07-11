/**
 * v2.123.0: 카카오톡 발송 대기열 처리 — /api/cron/kakao-queue
 *   POST (관리자 x-admin-secret 또는 CRON_SECRET x-cron-secret)
 *     → pending 최대 20건 발송 후 { ok, processed, sent, failed, revoked, remaining }
 *     트리거: cron 워커 5분 주기 + 관리자 대시보드 10초 폴링 킥 + 등록 직후 인라인 1청크.
 *   GET (관리자) → 상태별 합계 + 최근 배치별 진행률 (운영 확인용)
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized, constantTimeEqual } from '../../_lib/admin.js';
import { drainKakaoQueue, kakaoQueueStats } from '../../_lib/kakao-queue.js';

export const onRequestOptions = () => corsPreflight();

function authed(request, env) {
  if (verifyAdmin(request, env)) return true;
  const s = env.CRON_SECRET;
  return !!(s && constantTimeEqual(request.headers.get('x-cron-secret') || '', s));
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!authed(request, env)) return unauthorized();
  const result = await drainKakaoQueue(env, 20);
  return json({ ok: true, ...result });
});

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  return json({ ok: true, ...(await kakaoQueueStats(env)) });
});
