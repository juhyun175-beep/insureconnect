-- v2.95.0: 쿠팡 파트너스 추천 아이템 — 관리자 CRUD용 테이블
--   기존 하드코딩(_lib/coupang.js COUPANG_ITEMS)을 관리자 페이지에서 추가/수정/활성·비활성/삭제 가능하게 전환.
--   노출처: 인슈어커넥트 뉴스 뷰어 하단 스트립(.cnx) + SEO 페이지 추천 뷰어 모달(coupangModal).
--   운영 D1 적용 완료.

CREATE TABLE IF NOT EXISTS ic_coupang_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,           -- 상품명/라벨
  sub TEXT,                      -- 짧은 설명(선택)
  href TEXT NOT NULL,            -- 쿠팡 파트너스 링크(link.coupang.com)
  img TEXT NOT NULL,             -- 배너 이미지 URL(coupangcdn.com 등)
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 초기 시드(기존 하드코딩 5종)
INSERT INTO ic_coupang_items (label, sub, href, img, sort_order, is_active) VALUES
('차량용 거치대','외근 운전 필수 · 계기판 거치대','https://link.coupang.com/a/eOTTmWtHhI','https://image14.coupangcdn.com/image/affiliate/banner/c708da1a180df16dd06b78c48c8ec17d@2x.jpg',1,1),
('보조배터리','종일 외근 · 맥세이프 10000mAh','https://link.coupang.com/a/eOT86GHbpI','https://img5a.coupangcdn.com/image/affiliate/banner/cba23db3650847ccf6ce310c4c035ab5@2x.jpg',2,1),
('명함 케이스','첫인상 · 가죽 명함 지갑','https://link.coupang.com/a/eOUc4c9XJk','https://image12.coupangcdn.com/image/affiliate/banner/22f2b3425d627289da0754c4ba27e378@2x.jpg',3,1),
('다이어리·플래너','고객·일정 관리 · 만년 위클리','https://link.coupang.com/a/eOUgCN2p1U','https://image6.coupangcdn.com/image/affiliate/banner/e8975d8da8bab0de97db972c9513ed8f@2x.jpg',4,1),
('디퓨저','상담 공간·차량 · 선물세트','https://link.coupang.com/a/eOUjyMY2zk','https://img3c.coupangcdn.com/image/affiliate/banner/f9d7bf152de998312b6283ec855ebaf8@2x.jpg',5,1);
