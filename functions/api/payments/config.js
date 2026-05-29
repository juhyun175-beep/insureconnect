/**
 * v2.1.1 (master): 결제 시스템 클라이언트 설정 조회
 *
 *   GET /api/payments/config
 *   → { clientKey, enabled }
 *
 * - clientKey 가 미설정이면 enabled=false (프론트 UI 자동 숨김)
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env }) => handle(async () => {
  return json({
    enabled: !!env.TOSS_CLIENT_KEY,
    clientKey: env.TOSS_CLIENT_KEY || null,
  });
});
