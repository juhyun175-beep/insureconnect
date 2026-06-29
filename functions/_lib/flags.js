/**
 * v2.102.0: 기능 플래그.
 *   LOUNGE_OPEN — 실시간 채팅(전체 라운지) 오픈 여부.
 *     false = 오픈 예정(차단): /api/chat GET·POST 가 coming_soon 반환, notify 라운지 신호 숨김.
 *     오픈할 때 true 로 변경 후 배포. (프론트도 함께: index.html 의 LOUNGE_OPEN 상수)
 */
export const LOUNGE_OPEN = false;
