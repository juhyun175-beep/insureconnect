-- v2.0.0 (master): SEO 게시판 시스템 — 보험 카테고리 12종
CREATE TABLE IF NOT EXISTS ic_seo_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  tags TEXT,
  faq_json TEXT,
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published',
  author TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_unique ON ic_seo_posts(category, slug);
CREATE INDEX IF NOT EXISTS idx_seo_category ON ic_seo_posts(category, status);
CREATE INDEX IF NOT EXISTS idx_seo_published ON ic_seo_posts(status, created_at DESC);

-- 시드: 카테고리 정의 (정적 — Pages Function 에서 직접 사용)
-- (별도 테이블 없이 코드에서 enum 으로 관리)
