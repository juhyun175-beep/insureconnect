-- v2.9.2: 보험 상품/담보 스펙 (PDF AI 분석 결과) — 설계사 비교 레퍼런스
-- 상품요약서·가입설계서 등 PDF에서 담보별 가입금액·보험료·가입나이 등을 AI로 추출.

CREATE TABLE IF NOT EXISTS ic_product_coverages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insurer TEXT,                  -- 보험사
  product_name TEXT,             -- 상품명
  coverage_name TEXT,            -- 담보명 (예: 암진단비, 뇌혈관질환진단비)
  join_amount TEXT,              -- 가입금액 (예: 3,000만원 / 1억)
  premium TEXT,                  -- 보험료 (예: 월 12,300원)
  join_age TEXT,                 -- 가입나이 (예: 0~70세)
  payment_period TEXT,           -- 납입기간 (예: 20년납)
  maturity_period TEXT,          -- 만기 (예: 100세만기)
  gender TEXT,                   -- 남/여/공통
  notes TEXT,                    -- 비고/조건
  source_file TEXT,              -- 원본 파일명
  verify_status TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT
);
CREATE INDEX IF NOT EXISTS ic_cov_status_idx   ON ic_product_coverages(verify_status, created_at DESC);
CREATE INDEX IF NOT EXISTS ic_cov_insurer_idx  ON ic_product_coverages(insurer);
CREATE INDEX IF NOT EXISTS ic_cov_coverage_idx ON ic_product_coverages(coverage_name);
