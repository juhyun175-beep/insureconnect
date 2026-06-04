-- v2.13.9: 포인트 상점 확장 — 공고 상단노출권(크레딧)
-- 상점에서 '공고 상단노출 7일권'을 포인트로 구매 → feature_credit 적립
-- → 상단노출 시 포인트(50P) 대신 크레딧 1장 우선 소진(40P 특가)
ALTER TABLE ic_members ADD COLUMN feature_credit INTEGER DEFAULT 0;
