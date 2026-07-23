-- ════════════════════════════════════════════════════════════════
--   InsureConnect D1 (SQLite) Schema
--   Postgres → SQLite 변환:
--     timestamptz → TEXT (ISO 8601)
--     bigserial   → INTEGER PRIMARY KEY AUTOINCREMENT
--     jsonb       → TEXT (JSON 직렬화)
--     boolean     → INTEGER (0/1)
-- ════════════════════════════════════════════════════════════════

-- 채용공고
CREATE TABLE IF NOT EXISTS ic_recruitments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  company_name  TEXT,
  description   TEXT,
  file_url      TEXT,
  file_type     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recruit_created ON ic_recruitments(created_at DESC);

-- 소식지
CREATE TABLE IF NOT EXISTS ic_newsletters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company       TEXT NOT NULL,
  title         TEXT,
  file_url      TEXT,
  file_type     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nl_company_created ON ic_newsletters(company, created_at DESC);

-- 청구서류
CREATE TABLE IF NOT EXISTS ic_claim_forms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company       TEXT NOT NULL,
  title         TEXT,
  file_url      TEXT,
  file_type     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cf_company_created ON ic_claim_forms(company, created_at DESC);

-- 카드뉴스 (인슈어커넥트 뉴스)
CREATE TABLE IF NOT EXISTS ic_card_news (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id        TEXT NOT NULL,
  title         TEXT,
  file_url      TEXT,
  file_type     TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cn_set ON ic_card_news(set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cn_created ON ic_card_news(created_at DESC);

-- 보험지식 포스트
CREATE TABLE IF NOT EXISTS ic_knowledge_posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  image_url     TEXT,
  tags          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kn_created ON ic_knowledge_posts(created_at DESC);

-- 보험지식 댓글
CREATE TABLE IF NOT EXISTS ic_knowledge_comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id       INTEGER NOT NULL,
  nickname      TEXT,
  content       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_knc_post ON ic_knowledge_comments(post_id, created_at DESC);

-- 보험교재
CREATE TABLE IF NOT EXISTS ic_textbooks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  file_url      TEXT,
  file_type     TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tb_created ON ic_textbooks(created_at DESC);

-- 사이드바 배너
CREATE TABLE IF NOT EXISTS ic_sidebar_banner (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id        TEXT NOT NULL,
  title         TEXT,
  file_url      TEXT,
  file_type     TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sb_set ON ic_sidebar_banner(set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sb_created ON ic_sidebar_banner(created_at DESC);

-- 홈 팝업 공지
CREATE TABLE IF NOT EXISTS ic_home_popups (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL DEFAULT '',
  file_url          TEXT,
  file_type         TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  starts_at         TEXT,
  ends_at           TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hp_active_created ON ic_home_popups(is_active, created_at DESC);

-- 오픈채팅방 대화 순위
CREATE TABLE IF NOT EXISTS ic_kakao_stats (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  room_name         TEXT NOT NULL DEFAULT '오픈채팅방',
  period_label      TEXT,
  rankings          TEXT NOT NULL DEFAULT '[]', -- JSON array
  messages          TEXT, -- JSON array: monthly curated highlights [{n,t,c}]
  total_messages    INTEGER NOT NULL DEFAULT 0,
  participant_count INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ks_created ON ic_kakao_stats(created_at DESC);

-- 점검·장애 알림
CREATE TABLE IF NOT EXISTS ic_service_alerts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  insurer       TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  message       TEXT,
  severity      TEXT NOT NULL DEFAULT 'info', -- info | warn | down
  is_active     INTEGER NOT NULL DEFAULT 1,
  starts_at     TEXT,
  ends_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sa_active ON ic_service_alerts(is_active, starts_at);

-- 제휴 파트너 광고 카드
CREATE TABLE IF NOT EXISTS ic_partner_cards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  tagline     TEXT,
  category    TEXT,
  href        TEXT NOT NULL,
  img         TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ─── 통계 테이블 (가벼운 카운터 방식으로 재설계) ──────────────────
-- 기존: 매 클릭마다 row → 폭증
-- 변경: 일자별 1 row, 카운터 증가 → 부하 90% 감소

-- 페이지 방문 (일자별 집계)
CREATE TABLE IF NOT EXISTS ic_visits_daily (
  date          TEXT PRIMARY KEY,             -- 'YYYY-MM-DD' (KST)
  visits        INTEGER NOT NULL DEFAULT 0,
  unique_visits INTEGER NOT NULL DEFAULT 0
);

-- 카드 클릭 (일자별·카드별 집계)
CREATE TABLE IF NOT EXISTS ic_card_clicks_daily (
  date          TEXT NOT NULL,
  menu          TEXT NOT NULL,
  card          TEXT NOT NULL,
  clicks        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, menu, card)
);

-- 외부 링크 클릭 (일자별·회사별 집계)
CREATE TABLE IF NOT EXISTS ic_link_clicks_daily (
  date          TEXT NOT NULL,
  company_type  TEXT NOT NULL,
  company_name  TEXT NOT NULL,
  clicks        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, company_type, company_name)
);
