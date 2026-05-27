/**
 * v2.1.43: VAPID 공개 키 반환 — 프론트엔드 구독 시 필요
 *
 *   GET /api/push/public-key  →  { publicKey: "<base64url>" }
 *
 * 키 미설정 시 { publicKey: null } — 프론트에서 푸시 UI 자체를 숨김.
 * Wrangler 시크릿 등록:
 *   npx wrangler pages secret put VAPID_PUBLIC_KEY  --project-name=insureconnect-hub
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env }) => handle(async () => {
  return json({ publicKey: env.VAPID_PUBLIC_KEY || null });
});
