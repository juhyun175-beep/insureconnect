-- v2.1.43: PWA Web Push 구독 테이블
CREATE TABLE IF NOT EXISTS ic_push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_sent_at TEXT,
  active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_push_active ON ic_push_subscriptions(active);
