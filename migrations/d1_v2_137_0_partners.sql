-- v2.137.0: 관리자 운영형 제휴 파트너 광고 카드
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

