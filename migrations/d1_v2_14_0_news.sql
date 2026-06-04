-- v2.14.0: 홈 보험뉴스 캐시 (구글 뉴스 RSS, 키 불필요)
-- 카테고리별 페이로드를 30분 캐시 → 외부 호출 최소화·속도
CREATE TABLE IF NOT EXISTS ic_news_cache (
  cat        TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
