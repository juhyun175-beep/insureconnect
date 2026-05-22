-- v2.0.3: 사용자 공고 승인 시스템
-- ic_recruitments, ic_lectures 양쪽에 승인 워크플로우 컬럼 추가

ALTER TABLE ic_recruitments ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE ic_recruitments ADD COLUMN submitter_name TEXT;
ALTER TABLE ic_recruitments ADD COLUMN submitter_contact TEXT;
ALTER TABLE ic_recruitments ADD COLUMN reject_reason TEXT;
ALTER TABLE ic_recruitments ADD COLUMN approved_at TEXT;

ALTER TABLE ic_lectures ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE ic_lectures ADD COLUMN submitter_name TEXT;
ALTER TABLE ic_lectures ADD COLUMN submitter_contact TEXT;
ALTER TABLE ic_lectures ADD COLUMN reject_reason TEXT;
ALTER TABLE ic_lectures ADD COLUMN approved_at TEXT;

-- 기존 행은 approved 상태로 유지 (DEFAULT가 적용됨)

CREATE INDEX IF NOT EXISTS ic_recruitments_status_idx ON ic_recruitments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ic_lectures_status_idx ON ic_lectures(status, created_at DESC);
