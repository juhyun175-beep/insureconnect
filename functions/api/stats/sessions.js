/** 체류 시간 통계 — 신규 시스템엔 세션 추적 없음. 빈 응답 */
import { json, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestPost = () => json({
  today_sessions: 0,
  avg_duration: 0,
  distribution: [],
  recent_sessions: []
});
export const onRequestGet = onRequestPost;
