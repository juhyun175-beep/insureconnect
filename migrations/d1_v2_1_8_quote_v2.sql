-- v2.1.8: 견적 옵션 확장 + 출고 구분
ALTER TABLE ic_rental_vehicles ADD COLUMN delivery_type TEXT;     -- "즉시출고" / "일반출고"

ALTER TABLE ic_rental_inquiries ADD COLUMN business_type TEXT;    -- 개인/개인사업자/법인
ALTER TABLE ic_rental_inquiries ADD COLUMN deposit_prepay TEXT;   -- 보증/선납 (직접입력)
ALTER TABLE ic_rental_inquiries ADD COLUMN insurance_age TEXT;    -- 만21세이상 / 만26세이상 / 만30세이상 / 만35세이상
