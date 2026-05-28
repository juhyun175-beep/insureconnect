-- v2.0.0 Sprint 2: 회원 인증 시스템 (이메일 OTP + JWT)

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS ic_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',     -- guest / member / certified / premium / admin
  cert_status TEXT,                         -- null / pending / approved / rejected
  cert_company TEXT,                        -- 위촉 GA / 보험사명
  cert_card_url TEXT,                       -- 명함 R2 URL
  cert_doc_url TEXT,                        -- 위촉증명서 R2 URL
  contact TEXT,                             -- 연락처 (선택)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_users_role ON ic_users(role);
CREATE INDEX IF NOT EXISTS idx_users_cert ON ic_users(cert_status);

-- 이메일 OTP (one-time password) — 인증 후 즉시 삭제
CREATE TABLE IF NOT EXISTS ic_email_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,                  -- SHA-256(code)
  expires_at TEXT NOT NULL,                 -- 10분 유효
  attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON ic_email_otps(email, created_at DESC);

-- 세션 (JWT 발급 기록 + 무효화 추적)
CREATE TABLE IF NOT EXISTS ic_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  jti TEXT NOT NULL UNIQUE,                 -- JWT ID (token 식별자)
  user_agent TEXT,
  ip TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  revoked INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES ic_users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON ic_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON ic_sessions(jti);
