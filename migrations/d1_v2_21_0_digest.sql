-- v2.21.0: 주간 다이제스트 발송 로그 (성장 7/8) — 빈도 가드 + 감사 추적
-- send 모드 실행 시각을 기록해 6일 내 중복 발송을 차단. dry(미발송)도 집계 로그로 남김.

CREATE TABLE IF NOT EXISTS ic_digest_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  mode TEXT NOT NULL DEFAULT 'dry',          -- dry(집계만) / send(실제 발송)
  recipients_kakao INTEGER NOT NULL DEFAULT 0,
  recipients_push INTEGER NOT NULL DEFAULT 0,
  kakao_sent INTEGER NOT NULL DEFAULT 0,
  push_sent INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX IF NOT EXISTS ic_digest_runs_idx ON ic_digest_runs(mode, run_at DESC);
