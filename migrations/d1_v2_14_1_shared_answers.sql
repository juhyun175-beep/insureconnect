-- v2.14.1: 삼따AI 답변 공유 카드 (제품=미끼 PLG) — 공유된 단일 Q&A 저장
-- 공개 카드 페이지 /a/{id} 의 원본. DB 전체가 아닌 '답변 1개'만 공개(해자 안전)
CREATE TABLE IF NOT EXISTS ic_shared_answers (
  id           TEXT PRIMARY KEY,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  case_count   INTEGER DEFAULT 0,
  submitter_id INTEGER,
  views        INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now'))
);
