-- v2.9.0: 보험 사례 데이터센터 — 대체 불가능한 자산(사례 DB)
-- 수집 → 검수 → 승인 → 검색 → (후속) AI 답변 근거. AI 없이도 수집/검수 동작.

CREATE TABLE IF NOT EXISTS ic_insurance_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'underwrite',  -- underwrite(인수심사) / disclosure(고지) / claim(보상)
  disease TEXT,                  -- 질병/사유 (고혈압, 당뇨, 갑상선암 ...)
  insurer TEXT,                  -- 보험사
  gender TEXT,                   -- M / F / any
  age INTEGER,                   -- 연령
  elapsed_period TEXT,           -- 경과기간 (예: 진단 후 2년)
  join_condition TEXT,           -- 가입조건 (간편심사, 일반심사 등)
  result TEXT,                   -- 결과 (정상가입/부담보/할증/거절/지급/지급거절 등)
  summary TEXT,                  -- 사례 요약
  original_text TEXT,            -- 원문(개인정보 마스킹 후)
  special_notes TEXT,            -- 특이사항
  reliability INTEGER NOT NULL DEFAULT 40,  -- 신뢰도 20/40/60/80/100
  source TEXT NOT NULL DEFAULT 'member',    -- member(회원등록) / kakao_txt / admin
  verify_status TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / rejected
  submitter_id INTEGER,          -- 등록 회원 (nullable)
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT
);
CREATE INDEX IF NOT EXISTS ic_cases_status_idx   ON ic_insurance_cases(verify_status, created_at DESC);
CREATE INDEX IF NOT EXISTS ic_cases_category_idx ON ic_insurance_cases(category, verify_status);
CREATE INDEX IF NOT EXISTS ic_cases_disease_idx  ON ic_insurance_cases(disease);
CREATE INDEX IF NOT EXISTS ic_cases_insurer_idx  ON ic_insurance_cases(insurer);

-- 포인트 시스템 (#10) — 회원 참여 유도
ALTER TABLE ic_members ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
