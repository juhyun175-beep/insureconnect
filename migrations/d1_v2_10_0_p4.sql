-- v2.10.0: P4 — 우수 사례 플래그(+50P 1회), 포인트 사용 로그
ALTER TABLE ic_insurance_cases ADD COLUMN excellent INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ic_point_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,        -- +등록/승인/우수, -사용
  reason TEXT,                   -- case_submit / case_approve / case_excellent / ai_extra
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ic_point_log_member_idx ON ic_point_log(member_id, created_at DESC);
