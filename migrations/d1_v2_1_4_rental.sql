-- v2.1.4: 파트너 렌트카 차량 라인업 + 신청 시스템
-- 관리자가 홈 카드에 노출할 차량을 등록·관리하고,
-- 일반 사용자는 카드를 눌러 신청 → 운영자가 관리자 페이지에서 응대.

-- 차량 라인업 (관리자가 추가/수정)
CREATE TABLE IF NOT EXISTS ic_rental_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                  -- 예: "현대 아반떼 CN7 G1.6 모던 2WD"
  options TEXT,                        -- 예: "A/T, 컨비니언스, 하이패스"
  promo_text TEXT,                     -- 예: "1.0% 추가" (옵션)
  image_url TEXT,                      -- /api/files/rental/xxx.jpg
  category TEXT,                       -- 예: "전략" / "일반"
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ic_rental_vehicles_active_idx
  ON ic_rental_vehicles(is_active, sort_order ASC, created_at DESC);

-- 사용자 신청 내역
CREATE TABLE IF NOT EXISTS ic_rental_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER,                  -- nullable (차량이 추후 삭제되면 NULL)
  vehicle_name_snapshot TEXT NOT NULL, -- 신청 시점 차량명 보존
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  preferred_time TEXT,                 -- 예: "평일 오전", "주말 오후"
  organization TEXT,                   -- 소속 GA/대리점
  memo TEXT,                           -- 추가 문의 (옵션)
  status TEXT NOT NULL DEFAULT 'new',  -- new / contacted / closed / canceled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES ic_rental_vehicles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ic_rental_inquiries_status_idx
  ON ic_rental_inquiries(status, created_at DESC);
