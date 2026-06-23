/**
 * v2.92.1: 자유게시판 글의 SEO/GEO/AEO 색인 자격 게이트 — 단일 출처(SSOT)
 *
 *   기존엔 og/[id]·community·sitemap·weekly-digest 4곳에 임계값이 흩어져 있어
 *   기준 변경 시 누락 위험이 컸음. 여기로 일원화한다.
 *
 *   기준:
 *     - 본문 150자 이상(thin-content 방지 — AdSense 반려·"크롤됐지만 색인안됨" 예방)  ★유지
 *     - AND (조회 10회 이상  OR  댓글 2개 이상)  ← 실제 회원 글이 자연스럽게 색인되도록 완화
 *       · 조회 20→10 하향, 댓글 참여를 대체 신호로 추가(토론이 붙은 글은 조회가 적어도 가치 있음)
 */
export const BOARD_MIN_LEN = 150;
export const BOARD_MIN_VIEWS = 10;
export const BOARD_MIN_COMMENTS = 2;

/** SQL WHERE 조각 — 호출부에서 `deleted = 0 AND ...` 형태로 결합.
 *  값은 코드 상수(숫자)라 인젝션 위험 없음. */
export const BOARD_SEO_WHERE =
  `LENGTH(content) >= ${BOARD_MIN_LEN} AND (view_count >= ${BOARD_MIN_VIEWS} OR comment_count >= ${BOARD_MIN_COMMENTS})`;

/** JS 판정 — 단건 객체({content, view_count, comment_count})에 대해 색인 자격 여부 */
export const isBoardIndexable = (p) => {
  const len = String(p?.content || '').replace(/\s+/g, ' ').trim().length;
  return len >= BOARD_MIN_LEN &&
    (((p?.view_count || 0) >= BOARD_MIN_VIEWS) || ((p?.comment_count || 0) >= BOARD_MIN_COMMENTS));
};
