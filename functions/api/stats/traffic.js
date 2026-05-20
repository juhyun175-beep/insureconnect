/** 유입 경로 — 신규 시스템엔 referrer 추적 없음. 빈 응답 */
import { json, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestPost = () => json({
  domain_today: [], domain_total: [],
  path_today: [], path_total: [],
  device_today: [], device_total: [],
  utm_today: [], utm_total: [],
  recent_visits: []
});
export const onRequestGet = onRequestPost;
