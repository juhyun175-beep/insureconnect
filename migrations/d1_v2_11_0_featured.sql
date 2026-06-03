-- v2.11.0: 공고 상단노출(featured) + 회원 연결(submitter_id)
-- 채용/강의 공고에 등록 회원 연결 + 포인트로 상단노출 기간(featured_until) 부여
ALTER TABLE ic_recruitments ADD COLUMN submitter_id INTEGER;
ALTER TABLE ic_recruitments ADD COLUMN featured_until TEXT;
ALTER TABLE ic_lectures ADD COLUMN submitter_id INTEGER;
ALTER TABLE ic_lectures ADD COLUMN featured_until TEXT;
CREATE INDEX IF NOT EXISTS idx_recruit_submitter ON ic_recruitments(submitter_id);
CREATE INDEX IF NOT EXISTS idx_lecture_submitter ON ic_lectures(submitter_id);
