-- v2.1.9: 보증금/선납금 객관식(%) 별도 컬럼
ALTER TABLE ic_rental_inquiries ADD COLUMN deposit_pct INTEGER;   -- 0,10,20,30,40,50
ALTER TABLE ic_rental_inquiries ADD COLUMN prepay_pct INTEGER;    -- 0,10,20,30,40,50
