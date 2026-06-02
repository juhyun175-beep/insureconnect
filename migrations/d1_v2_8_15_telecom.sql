-- v2.8.15: 통신(휴대폰) 라인업 + 견적 신청 시스템 (렌트카 구조 미러링)
-- 관리자가 단말기를 등록·관리하고, 사용자는 카드에서 견적 신청 → 운영자 응대.

-- 단말기 라인업
CREATE TABLE IF NOT EXISTS ic_telecom_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                  -- 예: "갤럭시 S24 256GB"
  options TEXT,                        -- 예: "자급제, 5G"
  promo_text TEXT,                     -- 예: "공시지원 + 추가지원" (옵션)
  image_url TEXT,                      -- 단말기 이미지
  carrier TEXT,                        -- SKT / KT / LGU+ / 알뜰
  plan_text TEXT,                      -- 추천 요금제 안내
  monthly_text TEXT,                   -- 예상 월 납부 안내(텍스트)
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ic_telecom_devices_active_idx
  ON ic_telecom_devices(is_active, sort_order ASC, created_at DESC);

-- 사용자 견적 신청
CREATE TABLE IF NOT EXISTS ic_telecom_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER,                   -- nullable
  device_name_snapshot TEXT NOT NULL,  -- 신청 시점 단말기명 보존
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  carrier_pref TEXT,                   -- 희망 통신사
  preferred_time TEXT,
  organization TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'new',  -- new / contacted / closed / canceled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES ic_telecom_devices(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ic_telecom_inquiries_status_idx
  ON ic_telecom_inquiries(status, created_at DESC);
