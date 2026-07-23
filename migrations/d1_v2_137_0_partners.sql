-- v2.137.0: 관리자 운영형 제휴 파트너 광고 카드 (ic_partner_cards)
--   인슈어커넥트는 광고 게재 매체로서, 파트너사가 제공한 링크·배너를 홈 하단 「제휴 서비스」 존에 게재한다.
--   특정 파트너·시드 데이터는 넣지 않는다(코드/마이그레이션 하드코딩 금지).
--   id는 클릭·노출 집계에서 쓰는 영구 식별자 → 운영 삭제는 소프트 삭제(is_active=0, deleted_at)로 처리한다.
--   노출처: 홈 「제휴 서비스」 존(index.html) — GET /api/partners?active=1 로 지연 로드.
--   ※ 배포 및 운영 D1 마이그레이션은 이번 작업 범위 밖.

CREATE TABLE IF NOT EXISTS ic_partner_cards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,                 -- 파트너명(표시용, 변경 가능 → 추적키로 쓰지 않음)
  tagline     TEXT,                          -- 한 줄 소개(선택)
  category    TEXT,                          -- 카테고리 칩(선택)
  href        TEXT NOT NULL,                 -- 파트너 전용 링크(http/https)
  img         TEXT,                          -- 로고/썸네일 URL(선택, http/https)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_partner_cards_active_sort
ON ic_partner_cards (is_active, deleted_at, sort_order, id);
