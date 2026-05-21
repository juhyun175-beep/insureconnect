/**
 * 유입 경로 — 현재 시스템엔 referrer/UTM/device 추적 미구현
 * admin 기대 필드: referrer_today/total, landing_today/total, device_today/total, utm_today/total, recent
 * 빈 응답으로 안내 메시지 표시되도록 함
 */
import { json, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();
const empty = () => json({
  referrer_today: [], referrer_total: [],
  landing_today: [],  landing_total: [],
  device_today: [],   device_total: [],
  utm_today: [],      utm_total: [],
  recent: []
});
export const onRequestGet  = empty;
export const onRequestPost = empty;
