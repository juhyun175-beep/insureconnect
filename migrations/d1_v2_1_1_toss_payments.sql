-- v2.1.1 (master): Stripe → 토스페이먼츠 전환
-- 기존 stripe_session_id / stripe_payment_intent 컬럼은 NULL 인 채로 남겨둠 (deprecated)
-- 새 컬럼 추가:

ALTER TABLE ic_purchases ADD COLUMN toss_order_id TEXT;
ALTER TABLE ic_purchases ADD COLUMN toss_payment_key TEXT;
ALTER TABLE ic_purchases ADD COLUMN toss_method TEXT;            -- 카드/카카오페이/토스페이/네이버페이 등
ALTER TABLE ic_purchases ADD COLUMN toss_receipt_url TEXT;       -- 결제 영수증 URL

CREATE INDEX IF NOT EXISTS idx_purchases_toss_order   ON ic_purchases(toss_order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_toss_payment ON ic_purchases(toss_payment_key);
