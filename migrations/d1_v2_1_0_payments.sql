-- v2.1.0 (master): Stripe 결제 시스템

-- 상품 (카드뉴스 set, 묶음 등)
CREATE TABLE IF NOT EXISTS ic_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,                          -- 'cardnews' | 'bundle' | 'other'
  target_id TEXT,                              -- cardnews set_id 또는 bundle id
  price_krw INTEGER NOT NULL,                  -- 원 단위 (예: 9900 = ₩9,900)
  download_file_url TEXT,                      -- R2 의 단일 파일 (zip/pdf)
  download_filename TEXT,                      -- 사용자 노출 파일명
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_target ON ic_products(type, target_id, active);
CREATE INDEX IF NOT EXISTS idx_products_active ON ic_products(active, created_at DESC);

-- 구매 (결제 + 다운로드 권한)
CREATE TABLE IF NOT EXISTS ic_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  email TEXT NOT NULL,                         -- 비회원도 가능 (영수증/다운로드 링크 받을 이메일)
  user_id INTEGER,                             -- 회원이면 ic_users.id (Sprint 2 재도입 시)
  stripe_session_id TEXT,                      -- cs_xxx
  stripe_payment_intent TEXT,                  -- pi_xxx
  amount_krw INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | paid | failed | refunded
  download_token TEXT UNIQUE,                  -- URL-safe random (paid 시점에 생성)
  download_count INTEGER DEFAULT 0,
  download_max INTEGER DEFAULT 5,
  download_expires_at TEXT,                    -- 결제 후 30일
  paid_at TEXT,
  failed_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES ic_products(id)
);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON ic_purchases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_token ON ic_purchases(download_token);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON ic_purchases(email, status);
CREATE INDEX IF NOT EXISTS idx_purchases_session ON ic_purchases(stripe_session_id);
