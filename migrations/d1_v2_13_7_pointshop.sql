-- v2.13.7: 포인트 상점 — 삼따AI 추가 질문권(보너스 크레딧)
-- 포인트로 교환한 AI 질문권을 적립 → 무료 한도 초과 시 5P 차감 대신 보너스 우선 사용
ALTER TABLE ic_members ADD COLUMN ai_bonus INTEGER DEFAULT 0;
