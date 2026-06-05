-- v2.14.8: 공고주 맞춤 웹푸시 — 구독을 회원과 연결
-- 로그인 상태로 구독 시 member_id 기록 → 특정 공고주에게만 푸시 발송 가능
ALTER TABLE ic_push_subscriptions ADD COLUMN member_id INTEGER;
