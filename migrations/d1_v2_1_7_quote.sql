-- v2.1.7: 렌트카 견적 시스템 — 차량/신청 테이블 확장

-- 차량: 태그·기본 월대여료·연료·색상 옵션
ALTER TABLE ic_rental_vehicles ADD COLUMN tags TEXT;                    -- 콤마 구분: "시승가능차량,페이스리프트,7일내즉시출고"
ALTER TABLE ic_rental_vehicles ADD COLUMN base_monthly_price INTEGER;   -- 월 기본 대여료(KRW), 견적 계산의 베이스
ALTER TABLE ic_rental_vehicles ADD COLUMN fuel_type TEXT;               -- 가솔린/하이브리드/디젤/전기/LPG
ALTER TABLE ic_rental_vehicles ADD COLUMN colors TEXT;                  -- 콤마 구분: "화이트,블랙,그레이"

-- 신청: 견적 옵션 저장
ALTER TABLE ic_rental_inquiries ADD COLUMN contract_months INTEGER;     -- 12/24/36/48/60
ALTER TABLE ic_rental_inquiries ADD COLUMN annual_km INTEGER;           -- 10000/20000/30000/40000/999999(무제한)
ALTER TABLE ic_rental_inquiries ADD COLUMN selected_color TEXT;
ALTER TABLE ic_rental_inquiries ADD COLUMN insurance_opts TEXT;         -- 콤마: "자차" / "완전자차" / ""
ALTER TABLE ic_rental_inquiries ADD COLUMN estimated_monthly INTEGER;   -- 클라이언트 계산 결과 (참고용)
