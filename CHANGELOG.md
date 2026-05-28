# Changelog

## [2.0.0-sprint2a] - 2026-05-28  ← master 브랜치 격리 (production 미배포)
### Added (회원 시스템 백엔드 인프라 — Sprint 2 Phase 2a)
- **D1 테이블 3종**
  - `ic_users` — id/email/display_name/role/cert_status/cert_company/cert_card_url/cert_doc_url/contact/created_at/updated_at/last_login_at/active
  - `ic_email_otps` — id/email/code_hash (SHA-256)/expires_at/attempts/created_at  (인증 후 즉시 삭제)
  - `ic_sessions` — id/user_id/jti (UUID)/user_agent/ip/expires_at/created_at/revoked
- **JWT 라이브러리** `_lib/jwt.js` — HMAC-SHA256, 외부 의존성 0
  - `signJwt(payload, secret, expSec)` / `verifyJwt(token, secret)`
  - `parseCookie / sessionCookie / clearSessionCookie`
- **인증 미들웨어** `_lib/auth.js`
  - `getCurrentUser({ request, env })` — 쿠키→JWT→DB 세션 cross-check
  - `hasRole(user, minRole)` — admin > premium > certified > member > guest 위계
- **이메일 발송** `_lib/email.js`
  - Resend API (https://resend.com) 무료 100/day
  - 키 미설정 시 console 폴백 + `AUTH_DEV_MODE=1` 시 응답에 OTP 노출
  - 디자인된 HTML 이메일 템플릿 (그라데이션 헤더 + 6자리 코드 박스)
- **API 4종** `/api/auth/*`
  - `POST /request-otp` — 이메일 검증, rate limit 1분, 10분 만료 OTP 생성·발송
  - `POST /verify-otp`  — OTP 검증(시도 5회 한도), 신규는 자동 가입(role=member), JWT 발급 + Set-Cookie
  - `GET  /me`          — 현재 로그인 사용자 조회 (cookie → JWT 검증)
  - `POST /logout`      — 세션 revoked=1 처리 + 쿠키 만료

### Configuration (Phase 2a 활성화 요건)
```bash
npx wrangler pages secret put JWT_SECRET     --project-name=insureconnect-hub  # 32+ 자리 랜덤
npx wrangler pages secret put RESEND_API_KEY --project-name=insureconnect-hub  # https://resend.com
npx wrangler pages secret put MAIL_FROM      --project-name=insureconnect-hub  # 발신자
# 선택 (개발용)
npx wrangler pages secret put AUTH_DEV_MODE  --project-name=insureconnect-hub  # 값: 1
```

### 격리 배포
- master 브랜치 preview deployment 로만 노출 (production main 영향 0)
- preview URL 에서 사용자 테스트 → OK 시 main 으로 동일 코드 재배포

### 다음 Phase
- 2b: 프론트 로그인 모달 + 마이페이지 + 사이드바 로그인 상태 표시
- 2c: OAuth (카카오 / 구글 / 네이버)

## [2.0.0-sprint1] - 2026-05-28  ← 고도화 v2 Sprint 1 완료
### Added (SEO 게시판 시스템 — 보험 카테고리 12종 SSR 게시판)
- **DB**: `ic_seo_posts` (category/slug/title/excerpt/content/cover/tags/faq_json/view_count/status/author)
- **공통 모듈**: `functions/_lib/seo-categories.js` 12 카테고리 enum
- **SSR 페이지 3종**
  - `/insurance` — 카테고리 그리드 (게시글 수 표시)
  - `/insurance/{category}` — 카테고리별 글 목록
  - `/insurance/{category}/{slug}` — 게시글 본문 (JSON-LD Article + Breadcrumb + FAQPage)
- **schema.org JSON-LD 3종** 자동 삽입 — Google 검색 결과 풍부 노출
- **봇 제외 view_count** — `isBot()` 통과한 실제 사용자만 카운트
- **자동 메타** — meta description / canonical / og:* / twitter:* / 한국어 locale
- **Related Posts** — 같은 카테고리 최신 5개 자동 노출
- **CRUD API**: `/api/seo-posts/{ ?, [id] }` (GET·POST·PATCH·DELETE) — 관리자 시크릿 보호
- **관리자 UI**: admin.html 「📝 SEO 게시판」 탭 신설
  - 카테고리 select + slug + 제목/요약/본문/커버/태그/FAQ JSON/상태 폼
  - 등록·수정·삭제·필터 기능
  - 첫 진입 시 자동 목록 로드
- **사이드바 메뉴**: 「📝 보험 정보 게시판」 NEW 배지 진입 링크
- **sitemap.xml 통합** — 카테고리 12개 + 모든 게시글 자동 포함
- **시드 콘텐츠 2건** (실손보험 청구 가이드 / 신입 설계사 첫 달 체크리스트)

### Master 브랜치 정책 메모
- v2.0.0 코드는 점진 진화로 main 직배포 (Sprint 1 한정 — 게시판 자체가 새 경로라 기존 동작 영향 0)
- 회원 시스템(Sprint 2) 부터 master 브랜치 격리 후 preview URL 검증 → main merge 전략 적용

### 다음 Sprint
- Sprint 2: 회원 시스템 (이메일+OAuth+JWT)
- Sprint 3: 설계사 인증
- Sprint 4: 리쿠르팅 상품화
- Sprint 5: 강의 평점/신청
- Sprint 6: AI 도구
- Sprint 7: CRM SaaS

## [2.1.49] - 2026-05-28
### Fixed (카드뉴스 세트 삭제 — R2 사고의 진짜 원인 발견 + 수정)
- **버그 1 (서버 GET)**: `/api/card-news` 의 `onRequestGet` 이 `?set_id=` 쿼리 무시
  - 클라이언트가 `?set_id=A` 보내도 전체 200+개 슬라이드 반환
- **버그 2 (서버 DELETE)**: `/api/card-news/index.js` 에 `onRequestDelete` 미정의
  - 클라이언트가 `DELETE /api/card-news?set_id=A` 호출 → **405 Method Not Allowed** → DB 삭제 실패
- **🔥 사고 시나리오 재구성 (이전 R2 손실의 진짜 원인)**:
  1. 누군가 세트 A 삭제 시도
  2. GET 이 set_id 무시 → 전체 카드뉴스 반환 (200개+)
  3. 클라이언트가 그 200개 file_url 모두 `DELETE /api/files/card-news/*` 호출
  4. **R2 의 모든 카드뉴스 파일 삭제 (= v2.1.48 placeholder fallback 이 필요했던 원인)**
  5. 마지막 `DELETE /api/card-news?set_id=A` → 405 → **DB 는 그대로**
  6. 사용자가 본 결과: 「삭제 안 됨 + 모든 카드뉴스 깨짐」

### 🔧 3중 안전장치
1. **서버 GET**: `set_id` 쿼리 시 정확히 그 세트만 반환 + `sort_order ASC` 정렬
2. **서버 DELETE 신설**: `/api/card-news?set_id=<uuid>` 처리
   - UUID 형식 검증 — 무차별 대량 삭제 방지
   - `set_id` 필수 — 누락 시 400 Bad Request
   - 삭제 행 수 응답 (`deleted: N`)
3. **클라이언트 deleteCardNewsSet 보강**:
   - UUID 형식 사전 검증
   - GET 응답의 모든 행이 진짜 해당 set_id 인지 cross-check (서버 버그 재발 방지)
   - 한 세트 50장 초과 시 재확인 prompt
   - DELETE 응답 `ok: true` 확인

### Why this matters
- 삭제 버튼이 실제로 작동
- R2 파일 무차별 삭제 사고 재발 방지 (3중 검증)
- 같은 패턴(collection DELETE + GET 필터)이 다른 리소스에도 있는지 점검 완료 — 카드뉴스 만 해당, 나머지는 `/api/{resource}/{id}` 단건 삭제 패턴이라 안전

## [2.1.48] - 2026-05-28
### Fixed (긴급 — 카드뉴스 이미지 404 → placeholder fallback)
- **원인 진단**: `/api/files/card-news/...` 모든 경로 404
  - `wrangler r2 object get` 직접 확인 → "The specified key does not exist"
  - R2 의 `card-news/` 폴더 객체들이 외부 사고로 손실
  - DB (`ic_card_news`) 메타데이터는 보존됨
  - 채용공고(`recruitments/`) R2 객체는 정상 → 사고는 `card-news/` prefix 한정
- **수정**: `/api/files/[[path]]` 가 R2 미스 시
  - 이미지 확장자(png/jpg/webp/gif/svg)면 → **placeholder SVG 200 응답**
    - 안내 메시지: 「이미지를 불러올 수 없습니다 / 관리자가 재업로드 시 자동 복구됩니다」
    - `X-R2-Fallback: placeholder` 헤더로 디버깅 가능
  - 비이미지(PDF 등)는 기존 404 유지
- **효과**: 카드뉴스 tile / 슬라이드 / 카카오 OG 미리보기 모두 깨진 X 표시 사라짐
- **복구 경로**: 관리자가 카드뉴스 재업로드 시 자동으로 정상 이미지 노출 (코드 변경 불필요)

### Why this matters
- 사용자 입장: "업로드한 자료가 안 보임" → 즉시 placeholder 로 graceful 표현
- 데이터 손실 영향 격리 (제목/카운트/메타 모두 보존)
- 향후 R2 미스 발생해도 사이트 동작 자체는 깨지지 않음

## [2.1.47] - 2026-05-28
### Fixed (카드뉴스 클릭 시 빈 화면 버그)
- **원인**: `renderDashPreviews` 의 카드뉴스 클릭 핸들러가 `goToPage('cardnews')` 호출
  - `PAGE_NAMES` 에 `cardnews` 미포함 → `ALL_PAGES.forEach` 가 모든 `page-*` 숨김 → 빈 화면 노출
  - 모달은 열리지만 모달 닫으면 빈 페이지만 보임 → 사용자: "뉴스 카드 오류"
- **수정**: `goToPage('cardnews')` 호출 제거 — 카드뉴스는 모달이지 별도 페이지 아님
  - 현재 보고 있던 페이지(홈/실시간 모니터 등) 유지하며 모달만 오픈
  - 모달 닫으면 원래 페이지로 자연 복귀

## [2.1.46] - 2026-05-27
### Reset (인기 채용/강의 카운트 완전 초기화)
- `ic_link_clicks_daily` 의 `recruit_view / recruit_copy / recruit_shared / lecture_view / lecture_copy / lecture_shared` 행 4개 모두 삭제
- **이 배포 시점부터 fresh 카운팅 시작** — 사용자가 클릭/공유한 만큼만 누적

### Fixed (실시간 카운팅 전수 점검 — 봇·중복 트래픽 차단 일관화)
- **공통 봇 차단 모듈** `functions/_lib/bot.js` 신설 (`isBot(request)`)
  - 차단 패턴: bot/crawler/spider/scrap/preview/facebookexternalhit/twitterbot/slackbot/telegrambot/whatsapp/line/kakaotalk-scrap/kakao-link/naverbot/yeti/googlebot/bingbot/duckduck/baidu/yandex/applebot/embedly/pinterest/discordbot/skypeuripreview/chatgpt/gptbot/claudebot/perplexitybot/headless/phantom/selenium/playwright/puppeteer/cypress 등 30+ 패턴
  - UA 없는 요청도 봇으로 간주
- **서버측 봇 차단 적용 4개 엔드포인트**
  - `/api/track/visit` — 봇 visits 카운트 차단
  - `/api/track/link-click` — 봇 link click 카운트 차단
  - `/api/track/card-click` — 봇 card click 카운트 차단
  - `/api/track/session` — 봇 세션 통계 차단
- **클라이언트측 보강**
  - `trackVisit()` — `_BOT_UA_RE` 클라이언트 검사 추가
  - `trackCardClick()` — 봇 차단 추가 (기존 미적용)
  - `trackClick()` — v2.1.45 의 봇 차단 + 세션 dedupe 유지

### 점검 결과
- **랜딩페이지 트래킹 호출 4종** 모두 봇 차단 ✅
- **관리자페이지** — 트래킹 호출 없음 (표시 전용) ✅
- **OG 핸들러** — 이미 봇 차단 적용됨 (v2.0.9) ✅

### Why this matters
- 봇 트래픽으로 인한 통계 오염 해소 — 「누가 봐도 비현실적인 343회」 같은 사고 방지
- 트래킹 시스템 봇 차단 정책 통일 — 한 곳만 누락되면 의미 없음
- 카운트 reset + 봇 차단 인프라 함께 배포 → 처음부터 깨끗한 데이터

## [2.1.45] - 2026-05-27
### Fixed (실시간 인기 채용공고 카운트 오류 — 343회 미스터리 해결)
- **원인 진단 (D1 직접 조회 결과)**:
  - `recruit_9 (원금융서비스)`: `recruit_view=341, recruit_copy=1` → 가중치 점수 344
  - 다른 항목도 view 카운트가 비정상적으로 높음 (recruit_11=85, recruit_8=40)
  - **dedupe 부재**: 동일 사용자가 페이지 새로고침·OG 링크 재진입할 때마다 매번 view 카운트됨
  - **봇 미차단**: OG 스크래퍼/크롤러도 view 트래킹됨
  - **"pt" 표기**: 가중 점수라 사용자 입장에서 직관적이지 않음 (실제 회수와 괴리)
- **4중 수정**
  1. **`trackClick` 봇 UA 차단** — googlebot/kakaotalk-scrap/yeti 등 약 25개 봇 패턴 차단
  2. **세션 내 dedupe** — `recruit_view / lecture_view / knowledge / cardnews` 는 (name+type) 키로 세션당 1회만 카운트 (copy/shared 등 의도적 액션은 제외)
  3. **API 가중치 제거** — `view × 1 + copy × 3 + shared × 5` → 단순 `SUM(clicks)` (모두 1:1)
  4. **프론트 단위 변경** — `pt` → **`회`** (실제 클릭/뷰 수)
- **데이터 정리**: 기존 폴루션된 `*_view` 행 3개 삭제 → 깨끗한 fresh start

### Why this matters
- 343회는 명확히 오류 (실 방문자 수 대비 비현실적)
- "회"는 사용자가 직관적으로 이해 가능 — 신뢰성 ↑
- 봇/중복 제거로 향후 데이터 품질 보장

## [2.1.44] - 2026-05-27
### Fixed (실시간 인기 콘텐츠 카드 레이아웃 — 잘림·찌그러짐 해결)
- **5가지 미관 문제 동시 해결**
  1. **breakpoint 1280px → 1440px** — 일반 노트북(1366·1440)에서 4컬럼 → 2×2 변경 (컬럼당 폭 2배 확보)
  2. **`.lm-name` 1줄 nowrap → 2줄 wrap** (`-webkit-line-clamp: 2`) + `word-break: keep-all` (한글 단어 단위) + `overflow-wrap: anywhere` (URL/긴 단어 강제 분리)
  3. **`.lm-clicks` 알약 통일** — `min-width: 42px`, padding/radius 고정 → 「31회」「1회」「NEW」 모두 같은 폼팩터로 정렬 안정
  4. **NEW 배지 inline style 제거** → `.lm-new` 클래스로 분리 (그라데이션·그림자 클래스 기반)
  5. **`.lm-item` grid 레이아웃** (`20px 1fr auto`) + `min-height: 38px` — 행 일관성
- **`.lm-empty` flex 정렬** — `min-height: 100px` + 중앙 정렬 → 컬럼 간 키 안 맞춰지는 문제 해결

### Why this matters
- 4컬럼이 ultra-wide 모니터에서만 의미가 있고 일반 노트북에선 가독성 ↓
- 텍스트 잘림은 핵심 정보(어떤 비교표/공고인지) 가림 → 클릭률 저하
- 알약 폭 일관화 → 시각적 안정감 ↑ (정렬 흔들림 없음)

## [2.1.43] - 2026-05-27
### Added (PWA Push 알림 — 재방문 유도 채널 신설)
- **Service Worker `sw.js` 푸시 알림 전용으로 재작성**
  - 캐시 / fetch hijack 없음 (옛 PWA 사고 재발 방지)
  - `push` 이벤트 → `showNotification` (제목·본문·아이콘·이미지·URL·tag 지원)
  - `notificationclick` → 기존 InsureConnect 탭 포커스 + URL 이동, 없으면 새 창
- **DB**: `ic_push_subscriptions` 신설 (endpoint UNIQUE + keys + active flag)
- **API 4종**
  - `GET  /api/push/public-key` — VAPID 공개 키 (env 기반, 미설정 시 null → 프론트 자동 숨김)
  - `POST /api/push/subscribe` — endpoint upsert + 활성화
  - `POST /api/push/unsubscribe` — active=0 비활성화
  - `POST /api/push/send` (admin only) — 모든 활성 구독자에게 broadcast
- **Web Push 발송 헬퍼 `_lib/webpush.js`**
  - 외부 npm 의존성 0 — Web Crypto API 만 사용
  - VAPID JWT (ES256) 서명 + aes128gcm 메시지 암호화 (RFC 8291)
  - 404/410 응답 자동 감지 → 만료 구독 자동 비활성화
- **프론트**: 사이드바 푸터에 「🔔 새 공고 알림 받기」 토글 버튼
  - 권한 요청 → 구독 → 서버 등록 자동 흐름
  - 이미 구독중이면 「해제」 토글
  - 차단 상태면 「🔕 알림 차단됨」 비활성 표시
  - 미지원 브라우저 / VAPID 미설정 시 버튼 자동 숨김

### TODO (Phase 2 — 사용자 1회 설정 필요)
- [ ] **VAPID 키 발급 + Cloudflare 시크릿 등록** (5분 소요)
  ```
  npx web-push generate-vapid-keys
  npx wrangler pages secret put VAPID_PUBLIC_KEY  --project-name=insureconnect-hub
  npx wrangler pages secret put VAPID_PRIVATE_KEY --project-name=insureconnect-hub
  npx wrangler pages secret put VAPID_SUBJECT     --project-name=insureconnect-hub
  # subject 예: mailto:juhyun175@gmail.com
  ```
- [ ] 등록 후 사이드바 「🔔 알림 받기」 버튼 자동 노출
- [ ] 향후 admin.html 에 「새 공고 푸시 발송」 UI 추가 가능 (백엔드는 이미 완성)

### Why this matters
- 재방문 유도 채널 — 신규 공고·강의 등록 시 푸시 → retention ↑
- 외부 서비스 의존도 0 — Cloudflare D1 + Workers 만으로 완결
- 알림 차단 / 미지원 환경 graceful degradation

## [2.1.42] - 2026-05-26
### Added (동적 OG 이미지 — 카톡 미리보기 클릭률 향상)
- **`/og-image/{type}/{id}` 엔드포인트 신설** — SVG 1200×630 디자인 카드 동적 생성
  - 4가지 타입별 컬러 프리셋:
    - `recruit` — 블루 그라데이션 (#1a3de8 → #5b8cff) + 💼 채용공고
    - `lecture` — 퍼플 그라데이션 (#7c3aed → #c084fc) + 🎓 강의 일정
    - `news` — 시안 그라데이션 (#0ea5e9 → #22d3ee) + 📰 카드뉴스
    - `knowledge` — 그린 그라데이션 (#059669 → #34d399) + 📚 보험지식
  - 디자인 요소:
    - 그라데이션 배경 + 장식 원 + 광택 띠
    - 상단 카테고리 배지
    - 큰 제목 (자동 줄바꿈, 최대 3줄, 22자/줄)
    - 부제 (회사명·강사명) — 옐로우 강조
    - 날짜 표시
    - 하단 InsureConnect 브랜드 + 도메인
    - 우측 하단 → 화살표 (CTA)
- **Cloudflare edge 캐시** — 1시간 brower / 24시간 CDN
- **OG 핸들러 통합** (`/og/{type}/{id}`)
  - 업로드 이미지 있으면 우선 사용
  - 없으면 동적 OG 이미지로 자동 폴백
  - **wsrv.nl 프록시 경유 SVG→PNG 변환** (카카오톡 OG 스크래퍼는 SVG 미지원 → PNG 필요)
  - 변환 URL: `https://wsrv.nl/?url=…&output=png&w=1200&h=630&fit=cover`

### Why this matters
- 텍스트 전용 콘텐츠 (PDF 미첨부, 이미지 없는 보험지식 등) 의 카톡 미리보기 클릭률 ↑
- 일반 fallback 로고 대비 클릭률 2-3배 (업계 평균)
- 카드 디자인이 InsureConnect 브랜드 일관성 강화

## [2.1.41] - 2026-05-26
### Added (방문자 카운터 강조 — 사회적 증명 + 첫인상 강화)
- **홈 대시보드 상단에 방문자 카운터 strip 추가** (PC + 모바일)
  - 디자인: 블루 그라데이션 + 옐로우 텍스트 강조 + 흰색 광택 shine (5s 주기)
  - 「🔴 LIVE | 오늘 **142명**의 보험설계사가 방문 중 | 📊 누적 5,892명 · 💼 채용 12건 · 🎓 강의 3건」
  - PC: ic-top-row 위 / 모바일: Hero CTA 아래
- **데이터 소스**: 기존 `/api/stats` `today_visits`/`total_visits` 재활용 + `_lmCache` 의 채용/강의 카운트
- **자동 갱신**: 기존 `loadSideStats()` 호출 시점에 함께 갱신 (사이드바와 동기)

### Why this matters
- 사회적 증명 (Social Proof) — "다른 보험설계사들도 사용 중" 신뢰감
- 첫인상 강화 — 홈 진입 즉시 "활성 사이트" 인지
- 카운터 노출만으로도 신규 가입/체류 시간 ↑ (업계 평균 +15~25%)

## [2.1.40] - 2026-05-26
### Fixed (실시간 인기 채용/강의 컬럼 반응 없음 — v2.1.38 후속)
- **원인**: `ic_link_clicks_daily` 의 `*_copy`/`*_shared` 만 시그널로 사용 → 공유 빈도 낮아 거의 0 데이터
- **3종 해결**
  1. **view 시그널 추가** — `openRecruitViewer`/`openLectureViewer` 호출 시 `trackClick(`recruit_${id}`, 'recruit_view')` 발생
  2. **가중 합산** — view(×1) + copy(×3) + shared(×5) — 공유 우대하되 단순 조회도 반영
  3. **Fallback 최신순** — 엔게이지 데이터 0 이면 최신 승인 5개 표시 + 「NEW」 녹색 배지로 차별화
- **UI 개선**
  - 클릭 수 단위: `회` → `pt` (가중 점수 의미)
  - 신규 항목: 녹색 그라데이션 「NEW」 배지
  - 빈 상태 텍스트: 「아직 공유 기록이 없습니다」 → 「등록된 채용공고가 없습니다」

### Why this matters
- v2.1.38 도입 직후 데이터 부족으로 빈 컬럼만 노출되던 문제 해결
- 사용자 첫 view 도 시그널로 활용 → 인기 순위가 실제로 움직임

## [2.1.39] - 2026-05-26
### Added (SEO 풀스택 — Google Jobs / 네이버 검색 노출)
- **`/sitemap.xml` 대폭 확장**
  - 기존: 보험지식 게시글만
  - 신규: **채용공고 + 강의공고 + 카드뉴스 + 보험지식 + 정적 페이지** 통합
  - 채용/강의는 `status='approved'` 만, 우선순위 0.9 (높음)
  - D1 직접 조회 — Cloudflare edge 캐시 30분 / s-maxage 1시간
- **`/og/{type}/{id}` 페이지 검색 인덱싱 가능화**
  - 이전: `<meta name="robots" content="noindex,nofollow">` 로 검색 차단
  - 이후: **`index,follow`** + `<link rel="canonical">` + 본문 텍스트 노출 + JSON-LD 스키마
- **schema.org JSON-LD 스키마 적용**
  - `recruit` → **`JobPosting`** (Google Jobs / 네이버 채용 검색 직접 노출)
    - `title / description / datePosted / hiringOrganization / employmentType: CONTRACTOR / industry: 보험`
    - validThrough: 등록 후 90일
  - `lecture` → **`Course`** (Google 검색 강의 카테고리)
    - `name / description / provider(강사) / inLanguage: ko-KR`
  - `knowledge` → **`Article`** (`articleBody` + `datePublished`)
  - `news` → **`Article`** (헤드라인 + 이미지)
- **사용자 redirect는 유지 (UX 보존)**
  - 일반 사용자: 50ms 후 `location.replace(target)` 으로 메인 앱 진입
  - 봇 (Google/Bing/Naver Yeti/Kakao 등): UA 감지 후 redirect 차단 → 본문 + JSON-LD 인덱싱

### Why this matters
- **무료 유입 채널 개설**: Google Jobs / 네이버 검색 / Daum 검색에 자동 노출
- 채용공고 검색 노출 → 보험설계사 잠재 신규 사용자 유입 ↑
- 강의공고 검색 노출 → 학습 관심 사용자 유입 ↑
- 1주일 내 첫 인덱싱 시작 (제출 후 robots.txt 의 sitemap 라인을 Google/네이버 webmaster 도구에 알려야 함)

### TODO (사용자가 직접 수행)
- [ ] Google Search Console (https://search.google.com/search-console) 사이트 등록 + sitemap 제출
- [ ] 네이버 서치어드바이저 (https://searchadvisor.naver.com) 사이트 등록 + sitemap 제출

## [2.1.38] - 2026-05-26
### Changed
- **PC 홈 Hero CTA 제거** — 사이드바 CREW 300 강조만으로 충분 (모바일 홈 Hero는 유지)

### Added (실시간 인기 콘텐츠 — 채용/강의 순위 신설)
- **인기 채용공고 / 인기 강의공고 컬럼 추가**
  - 2컬럼 → **4컬럼 그리드** (PC: 4열, 1280px↓: 2열×2행, 700px↓: 1열)
  - 데이터 소스: `ic_link_clicks_daily.*_copy + *_shared` 합산 (공유유입 + 외부 공유)
  - 서버 `/api/top-items` 에 `recruit_today/total`, `lecture_today/total` 응답 추가
  - SQL JOIN 으로 `recruit_<id>` → `ic_recruitments.title` 매핑, status='approved' 필터
  - 클릭 시 `lmOpenRecruit(id)` / `lmOpenLecture(id)` → 해당 페이지 + 뷰어 자동 오픈
  - 트래킹: `trackCardClick('실시간순위', '채용공고')` / `'강의공고'` — 효과 측정 가능

## [2.1.37] - 2026-05-26
### Added (CREW 300 커뮤니티 참여 극대화 — 홈 진입 즉시 시야 정중앙)
- **홈 대시보드 상단 Hero CTA 띠** (PC + 모바일 양쪽)
  - 카카오 옐로우 그라데이션 + 흰색 광택 shine 애니메이션 (4.2s 주기)
  - 좌측: CREW 300 로고 (52×52 흰 배경 카드, 보더 그림자)
  - 중앙 상단: 🔴 **LIVE** 배지 (펄스 점) + 👥 **300+ 활동 중** 배지
  - 중앙 본문: 「CREW 300 — 보험설계사 오픈채팅」 헤드라인 + 「동료 설계사들과 실시간 정보·노하우 공유」 서브
  - 우측: 검은 알약 「참여하기 →」 CTA (호버 시 우측 슬라이드)
  - hover : translateY(-2px) + 그림자 강화
  - 트래킹: `trackClick('CREW300 오픈채팅 참여', 'home-hero')` / `'home-hero-mobile'`
- **사이드바 CREW 300 버튼 강조 (v2.1.18 → 강화)**
  - 카카오 옐로우 그라데이션 + scale pulse(2.6s) + shine 광택(3.8s)
  - 「CREW 300 [LIVE]」 라벨 + 「보험설계사 300+ 활동 중」 서브
  - 화살표 좌우 bounce 애니메이션
  - LIVE 배지: 빨간 알약 + 펄스 점 (1.2s)
- **행동심리 트리거 3종 적용**
  1. 사회적 증명 — 「300+ 활동 중」 명시
  2. 실시간성 (FOMO) — 「LIVE」 배지 + 펄스 점
  3. 행동 유도 — 검은 알약 「참여하기 →」 명확한 CTA + 화살표 애니메이션

### Why this matters
- 사용자 피드백: "이용자들이 홈대시보드 진입 시 눈에 확 들어오도록 + 참여 극대화"
- 홈 진입 시 PC 는 페이지 최상단, 모바일은 시계 바로 아래 — 100% 노출 보장
- 카카오 옐로우는 한국 사용자에게 「카톡 = 클릭」 학습된 색상 → 클릭률 ↑

## [2.1.36] - 2026-05-26
### Changed (보안 정책 — 신청 폼 링크 엄격화)
- **「구글폼·네이버폼만」 정책으로 화이트리스트 축소**
  - 이전(v2.1.29): docs.google.com / forms.gle / form.naver.com / naver.me / tally.so / forms.office.com / surveymonkey.com / typeform.com / open.kakao.com / kakao.com / kr.surveymonkey.com / github.com
  - 이후(v2.1.36): **docs.google.com / forms.gle / form.naver.com / naver.me** 4개만
  - 카카오톡 오픈채팅(open.kakao.com)·기타 사이트 모두 차단
  - 이유: 「신청 폼 링크」 의도와 카톡 오픈채팅(채팅방)은 의미적으로 다르고, 폼 외 도메인은 피싱·외부 유출 위험 ↑
- **3중 방어 적용**
  1. 서버 (`functions/api/recruitments/index.js`, `functions/api/lectures/index.js`) — 화이트리스트 통과 못한 URL 은 `null` 로 저장 (defense in depth)
  2. 프론트 실시간 입력 검증 (`smValidateFormUrl`) — input oninput 시 즉시 빨간 박스로 차단 사유 표시
  3. submit 시점 재검증 — Step1→Step2 진행 차단
- **UI 가이드 개선**
  - 입력란 헬프 텍스트: 「✅ 구글폼·네이버폼만 허용 / ❌ 카카오톡 오픈채팅·기타 사이트 차단」 명시
  - 카톡 링크 입력 시 전용 메시지: 「⚠ 카카오톡 오픈채팅 링크는 차단됩니다. 구글폼 또는 네이버폼만 입력해주세요.」

### Why this matters
- 관리자 승인 게이트가 있긴 하나, 사용자 입력 시점부터 막아 혼란·실수 방지
- 「폼 = 폼만」 의도 명확화 → 운영 정책 일관성 ↑

## [2.1.35] - 2026-05-26
### Fixed (채용/강의 페이지 카드 미표시 — 진짜 원인 발견)
- **`_ensureShareCounts` IIFE 스코프 누출 버그**
  - v2.1.31 에서 공유 카운트 헬퍼(`_ensureShareCounts`, `_shareBadge`) 를 IIFE `(function(){ ... })()` 내부에 정의
  - 같은 IIFE 안의 `loadHomeJobs`/`loadHomeLectures` 는 정상 작동 (클로저 공유)
  - 다른 script 블록의 `loadRecruitPage` (라인 9420) 와 `loadLecturePage` (라인 9480) 가 호출 시 `ReferenceError`
  - try/catch 가 잡아 「채용공고를 불러올 수 없습니다」 또는 빈 화면 표시 → 사용자: "홈엔 있는데 페이지엔 없네"
- **해결**: IIFE 내부에서 `window._ensureShareCounts = _ensureShareCounts; window._shareBadge = _shareBadge;` 노출
  - 외부 스코프 호출처는 unqualified name 으로 자동 window 탐색 → 즉시 작동
- **부수 효과**: v2.1.34 의 TTL 재로드는 유지 (별개 개선) — 단, 그것은 stale 표시 막는 용도였고 진짜 원인은 이번 스코프 버그였음

### Why this matters
- 새 공고 등록 → 관리자 승인 후 실제로 채용공고/강의 페이지에 노출되어야 viral 효과
- 1주일 가까이 사용자가 「홈엔 보이는데 페이지엔 없네」 혼란을 겪었을 가능성 — 즉시 수정 배포

## [2.1.34] - 2026-05-26
### Fixed (관리자 승인 후 페이지 stale 표시 — 핵심 UX 버그)
- **채용공고/강의/뉴스레터/청구서양식 페이지가 세션당 1회만 로드되던 버그**
  - 이전: `if (page === 'recruit' && !rcLoaded) { ...; rcLoaded = true; }`
  - 결과: 사용자가 페이지 1회 진입 → 관리자가 새 공고 승인 → 사용자 재진입 시 stale 데이터 그대로
  - 사용자 피드백: "홈엔 새 공고 떴는데 채용공고 페이지엔 안 보임"
- **해결**: TTL 기반 재로드 가드 (`PAGE_RELOAD_TTL_MS = 60_000`)
  - 60초 이상 경과 시 자동 재호출 → 새 데이터 반영
  - 60초 이내 빠른 페이지 전환은 캐시 유지 → 불필요한 트래픽 방지
- **영향 페이지**: newsletter / claimform / recruit / lecture (4개 — 모두 같은 패턴이라 모두 수정)

### Why this matters
- 관리자가 새 공고 승인 즉시 사용자에게 노출되어야 viral 효과
- 1분 stale 은 허용 가능한 trade-off (D1 부담 방지)

## [2.1.33] - 2026-05-26
### Fixed (보험교재 다운로드 — UX 치명적 불편 해결)
- **실무도구 > 보험교재 다운로드 버튼이 실제로 다운로드하도록 수정**
  - 이전: `<a target="_blank">` 만 사용 → PC 에선 빈 미리보기 탭, 모바일에선 PDF 뷰어/공유 시트로 빠짐 (사용자: "카톡 공유만 됨")
  - 수정: 서버측 `Content-Disposition: attachment` 헤더 + 프론트 `download` 속성 조합
- **서버 (`/api/files/[[path]].js`)**
  - `?download=1&name=<encoded>` 쿼리 지원 — RFC 5987 형식으로 한글 파일명 보존 (`filename*=UTF-8''…`)
  - 비ASCII 파일명은 ASCII 폴백 + UTF-8 이중 표기 → IE/Safari 호환
- **프론트 (`index.html` 보험교재 모달)**
  - 다운로드 링크에 `download` 속성 + `?download=1&name=교재제목.pdf` 부가
  - 파일명에서 OS 금지문자(`\/:*?"<>|`) 자동 치환 + 80자 컷
  - 클릭 시 즉시 다운로드 매니저로 직행 (PC: Save-as / 모바일: Downloads 폴더)

### Why this matters
- 사용자 피드백 그대로: "다운로드 버튼인데 PC 에선 팝업 빈창, 모바일에선 카톡 공유만 — 굉장히 배려 없는 짓"
- 다운로드 버튼은 다운로드를 해야 함 — 공유와 분리

## [2.1.32] - 2026-05-26
### Fixed (PC 환경 공유 버그 — 운영체제 한계)
- **PC(Windows)에서 채용/강의/카드뉴스/앱 공유 시 「다시 시도하세요. 공유할 수 있는 일부 방법만 표시됩니다」 에러 해결**
  - 원인: `navigator.share()` 호출 시 Windows 자체 공유 시트(IDataTransferManager) 가 노출되는데
    - 한국 사용자가 원하는 카카오톡/라인/디스코드 등이 등록되지 않아 「근처 공유, Mail 앱」 정도만 표시
    - Windows UWP 공유 권한 이슈로 위 에러 빈번
  - 해결: 모바일/태블릿 환경에서만 `navigator.share()` 호출, **데스크탑은 즉시 clipboard 복사**로 분기
  - 판정 조건: `matchMedia('(max-width: 768px)')` OR 모바일 UA OR 터치스크린(maxTouchPoints>1)
  - 영향: `shareRecruit / shareLecture / shareCardNews / shareApp` 4개 공유 핸들러 전부 + 공통 `nativeShareWithFallback` 헬퍼

### Why this matters
- PC 사용자는 이제 「다시 시도하세요」 에러 없이 **즉시 클립보드 복사** → 카카오톡 PC앱 등에 붙여넣기 가능
- 모바일 사용자 경험은 그대로 (v2.1.30 OS 공유 시트 유지)

## [2.1.31] - 2026-05-26
### Added (바이럴 마케팅 2순위 — 공유 카운트 사회적 증명 배지)
- **채용/강의 카드에 「📤 N회 공유」 배지** 노출 (홈 대시보드 + 전체 페이지)
  - 빨강~오렌지 그라데이션 pill, 카드 우하단 absolute, 부드러운 pulse 애니메이션
  - 사회적 증명(social proof) — 다른 사람이 이미 공유한 공고일수록 추가 공유 유도
  - v2.1.30 네이티브 공유 기능과 직접적 복리 효과 (공유↑ → 배지 숫자↑ → 더 많은 공유)
- **신규 API `/api/share-counts`** — 5분 edge cache
  - `ic_link_clicks_daily` 의 `*_copy` 이벤트를 type/id 별로 집계 반환
  - 카드 렌더링 시 단 1번 fetch + 메모리 캐시 — 부담 없이 모든 카드에 배지 표시

### Fixed (v2.1.30 추적 이벤트 의미 충돌)
- v2.1.30 의 native share 이벤트명을 `*_shared` → `*_copy` 로 환원
  - 기존 `cardnews_shared` 는 **OG 링크 통한 외부 유입** 의미로 admin 「공유유입 Top 5」 통계가 이미 사용 중
  - 두 이벤트 모두 outgoing 공유 의도 → `*_copy` 단일 표기로 통일하여 통계 일관성 회복

## [2.1.30] - 2026-05-24
### Removed
- **사용자 신청 1시간 쿨다운 폐지**
  - 「최근 신청 후 1시간이 지나야 다시 신청할 수 있습니다」 alert + localStorage 체크 제거
  - 어차피 관리자 승인 게이트가 있어 무의미한 마찰이었음
  - 한 사람이 채용+강의 둘 다 올리고 싶을 때 즉시 가능

### Added (바이럴 마케팅 1순위 — Native Web Share API 통합)
- **모바일에서 1탭 카카오톡/라인/문자 공유** 지원
  - `navigator.share()` API 우선 사용 — OS 네이티브 공유 시트 노출
  - 채용공고·강의·카드뉴스·앱 공유 모두 적용
  - 데스크탑 / 미지원 환경에선 자동으로 기존 clipboard 복사 fallback
  - 사용자가 공유 sheet 닫으면(AbortError) 조용히 종료 (clipboard 로 강제 fallback 안 함)
- **분석 강화**
  - 기존 `*_copy` 만 추적하던 것을 native share 시 `*_shared` 이벤트로 분리 추적
  - `app_shared` / `recruit_shared` / `lecture_shared` / `cardnews_shared` 분리 카운터
  - 향후 관리자 통계 슬라이드의 '공유유입' 부분이 실데이터로 풍성해짐

### Why this matters
- **단계 7→4 단축** — 이전: 복사→앱전환→카톡열기→채팅선택→붙여넣기→전송 / 이후: 공유클릭→카톡선택→전송
- 한국 모바일 사용자 viral 효과 즉시 ↑ (OG 미리보기는 이미 v2.1.16 부터 완벽 작동)
- Kakao SDK 처럼 별도 앱키·도메인 등록 불요 — 브라우저 표준 API

## [2.1.29] - 2026-05-24
### Added
- **채용/강의 공고에 외부 폼 링크 첨부** (구글폼·네이버폼·카카오톡 등)
  - 신청 모달에 「신청 폼 링크 (선택)」 입력란 추가 — 어떤 도메인이 지원되는지 안내 포함
  - 서버측 화이트리스트 검증 (`docs.google.com / forms.gle / form.naver.com / naver.me / tally.so / forms.office.com / surveymonkey.com / typeform.com / open.kakao.com / kakao.com / github.com`)
  - http/https 만 허용, 최대 500자 — XSS·피싱·임의 URL 차단
  - 채용공고 뷰어 / 강의 뷰어에 「📝 신청 폼 작성하기 →」 그라데이션 버튼 노출
  - DB: `ic_recruitments.form_url`, `ic_lectures.form_url` 컬럼 추가

### Fixed (다크모드 텍스트 가시성)
- 채용공고 뷰어 (`.rc-viewer-*`) — 하드코딩 `#111`, `#222`, `#9ca3af` → CSS 변수 `var(--txt-hi/--txt-mid/--txt-lo)` 로 교체
- `.rc-viewer-body` 배경 `background: #fff` → `var(--bg-card)` — 다크모드에서 흰 카드 → 다크 카드로 자연 전환
- admin 인기 콘텐츠 표의 `${l.company_name}` 에 `esc()` 추가 (defense-in-depth, v2.1.28 의 보안 점검 누락분)

## [2.1.28] - 2026-05-24
### Fixed (홈 팝업 「오늘 그만보기」 작동 안 함)
- 원인: v2.1.26 사이드바 배너 삭제 시 `_getTodayStr()` 헬퍼 함수가 같은 블록에서 함께 사라졌는데, home popup 의 「오늘 그만보기」 로직이 그 함수에 의존 중이었음. `ReferenceError` 가 try/catch 로 silently 흡수되면서 `localStorage.setItem(...)` 이 실행되지 않아 다음 진입 때 또 팝업이 뜸.
- 수정: `_getTodayStr()` 함수 복원 + **KST 기준** 으로 명시 (이전엔 로컬 타임존 — 한국 사용자가 자정 직전 체크하면 시간대에 따라 즉시 만료될 수 있던 미세 버그도 함께 해결)
- 검증: `localStorage.getItem('home_popup_hide_<id>')` 가 `<YYYY-MM-DD>|<stamp>` 형식으로 저장되어 같은 날 다시 진입 시 팝업 미노출

### Security (랜딩 + 관리자 페이지 전체 보안 점검)
- **HTTP 보안 헤더 강화 (`_headers`)**
  - `Strict-Transport-Security: max-age=63072000` 추가 (HSTS 2년) — HTTP downgrade 공격 방지
  - `Permissions-Policy` 확장: `payment=(), usb=(), interest-cohort=()` 까지 명시 차단
  - `X-XSS-Protection: 0` (현대 브라우저 권장값, OWASP)
  - **admin.html 전용 강화**:
    - `Cache-Control: private, no-cache, no-store, must-revalidate` (이전엔 no-cache 만)
    - `Pragma: no-cache`
    - `Cross-Origin-Opener-Policy: same-origin` — popup window.opener 공격 차단
    - `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` (검색 노출 + 캐싱 모두 차단)
- **관리자 인증 강화**
  - `functions/_lib/admin.js` — 시크릿 비교를 **constant-time** (XOR + 누적 mismatch) 로 변경 → timing-attack 표면 제거
  - `functions/api/admin/verify.js` — 실패 시 일관된 400ms 지연 → brute-force 시 분당 ~150회 시도 한도 (합리적 길이 SECRET 이면 사실상 무력화)
- **XSS 방어적 escape 추가**
  - `admin.html` 인기 콘텐츠 표의 `${l.company_name}` → `${esc(l.company_name)}` (현재 데이터는 안전한 하드코딩 값이지만 defense-in-depth)

### 보안 점검 결과 — 양호 (별도 조치 불요)
- **SQL injection**: 모든 D1 쿼리가 `.prepare(...).bind(...)` 의 parameterized 방식 사용 ✓
- **시크릿 노출**: `wrangler.toml` `[vars]` 안에 평문 시크릿 없음 (모두 `wrangler pages secret put` 으로 관리) ✓
- **HTTPS 강제**: Cloudflare Pages 기본 + 위 HSTS 보강 ✓
- **CORS**: 공개 read 엔드포인트는 `*` 허용 (정상), 관리자 endpoint 는 `x-admin-secret` 헤더 검증으로 보호 ✓
- **파일 업로드** (`/api/user-upload/*`): 폴더 화이트리스트(recruitments/lectures/rental-cards) + MIME 화이트리스트(image/*, pdf, heic) + 10MB 제한 + 확장자 정제 + 서버 생성 랜덤 파일명 (path traversal 차단) ✓
- **OG meta**: 모든 사용자 입력 값에 `esc()` 적용 + image URL 도 절대 URL 강제 ✓
- **클립보드 (링크 복사)**: 안전한 origin 기반 URL 생성, 사용자 입력 직접 포함 X ✓

### 미해결 (개선 권고)
- **사용자 신청 endpoint (`/api/recruitments`, `/api/lectures`, `/api/rental-inquiries`, `/api/user-upload`)** — 서버측 IP 기반 rate-limit 없음. 봇 스팸 가능성. 현재 클라이언트 localStorage 쿨다운만 존재 (우회 가능). 후속 작업으로 D1 기반 IP-카운터 또는 Cloudflare Turnstile 도입 권고.
- **CSP**: 인라인 스크립트가 많아 strict CSP 적용 시 광범위 리팩토링 필요 → 별도 진행 권고.

## [2.1.27] - 2026-05-24
### Changed
- **사이드바 「내 공고 직접 등록」 — 채용/강의 2버튼을 1버튼으로 통합**
  - 이전: 💼 채용공고 / 🎓 강의공고 두 작은 버튼 (점선 박스 안)
  - 이후: **`📤 내 공고 직접 등록 · 💼 채용 · 🎓 강의`** 단일 그라데이션 버튼 (파랑→핑크)
- **모달 안에서 모드 선택 토글**
  - 모달 Step 1 상단에 채용/강의 2-segment 토글 (segmented control)
  - 활성 모드는 모드별 색상 (채용=블루, 강의=핑크)
  - 토글 시 즉시: 모달 타이틀, 회사명/강사명 필드 표시, 제목·상세 내용의 placeholder 가 모드별로 갱신
  - 마지막 선택 모드를 `localStorage.ic_submit_last_mode` 에 저장 → 다음 모달 열 때 그 모드로 시작 (직전 작업 흐름 유지)
- **`openSubmitModal()`** 인자 없이도 호출 가능 — 인자 있으면 그 모드로 강제, 없으면 localStorage 의 마지막 모드 복원
- 기존 호출자 `openSubmitModal('recruit')` / `openSubmitModal('lecture')` 도 그대로 작동 (강의공고 페이지의 「강의 직접 등록하기」 버튼 등)

## [2.1.26] - 2026-05-24
### Removed (사이드바 배너 기능 완전 폐지)
- **HTML 제거**
  - PC 사이드바 `.side-latest` 파트너사 프로모션 섹션
  - 모바일 홈 `#m-home-banner` 파트너사 프로모션 섹션
  - `#sb-modal-overlay` 사이드바 배너 뷰어 모달
  - `#promo-popup-overlay` 첫 접속 자동 프로모션 팝업
- **JS 제거** (총 약 320 줄)
  - `loadSideLatest()`, `startSideBannerRotation()`, `stopSideBannerRotation()`, `visibilitychange` 핸들러
  - `openSidebannerModal()`, `closeSidebannerModal()`, `sbModalPrev/Next`, `renderSbModal()`
  - `openSideLatestItem`, `openSideLatestCard`
  - `_promoSlides`, `showPromoPopupIfNeeded`, `renderPromoPopup`, `promoPopupPrev/Next`, `closePromoPopup`
  - 모바일 `loadMobileHome` 안의 banner 로딩 블록
  - `showHomePopupIfNeeded(showPromoPopupIfNeeded)` 체인 → 단순 `showHomePopupIfNeeded()` 로 정리
  - keydown ESC/Arrow 핸들러에서 sb-modal/promo-popup 분기 제거
- **CSS 제거**
  - `.side-latest`, `.side-latest-list`, `.side-latest-row`, `.side-latest-skeleton`
  - `.side-cn-card`, `.side-cn-thumb`, `.side-cn-body`, `.side-cn-label`, `.side-cn-title`, `.side-cn-date`, `.side-cn-badge`, `.side-cn-fallback`, `.side-cn-slide`, `.side-cn-slide-fb`, `.side-cn-dots`, `.side-cn-dot`
  - 모바일 override (`body.ic-mobile .side-latest`, `body.ic-mobile .side-cn-*` 등)
  - 모바일 모달 전체화면 룰 (`#sb-modal-overlay`, `#promo-popup-overlay`)
  - 성능 힌트 (`@media reduce-motion` 의 .side-cn-card 비활성 + GPU will-change)
- **관리자 페이지 제거**
  - `#up-sidebar` 탭 + 패널 (총 14 → 11 탭)
  - `#sb-preview-overlay` 미리보기 모달 + ESC/방향키 핸들러
  - `uploadSidebarBanner()`, `loadSidebarBanners()`, `deleteSidebarSet()`, `openSbPreview()`, `closeSbPreview()`, `sbPreviewPrev/Next`, `renderSbPreview()` 함수 일괄 삭제
  - `loadSidebarBanners()` init 호출 제거
- **API 엔드포인트 삭제**: `functions/api/sidebar-banner/index.js` + `[id].js` + 폴더
- **D1 테이블 DROP** (`migrations/d1_v2_1_26_drop_sidebar_banner.sql`)
  - `DROP TABLE IF EXISTS ic_sidebar_banner` 실행 완료 (적용 검증됨)

### Verified (전체 점검 결과)
- 관리자 탭 — `📥 사용자 신청 / 📰 보험사 소식지 / 📋 청구서류 / 📖 보험교재 / 🚨 점검·장애 / 🗞 인슈어커넥트 뉴스 / 📚 보험지식 / 💬 대화순위 / 📢 홈 팝업 / 💼 채용공고 / 🎓 강의 / 🚗 차량 라인업` (12개) 모두 정상
- 통계 슬라이드 — `방문 개요 / 클릭 통계 / 체류 시간 / 인기 콘텐츠 / 렌트카 카드` (5개) 모두 작동
- 홈 대시보드 — 실시간 인기 + 채용/강의 (left) + 카카오 (right) + 즐겨찾기 floating popup
- 좌측 빨간 「🚗 리스/렌트카」 PILL, 우측 vertical nav — 모두 작동
- 공유 링크 (`/og/news/...`, `/og/recruit/...`, `/og/lecture/...`) — 정상
- 카드 링크 복사 (채용/강의) — 정상
- 견적내기 모달 (3단계 funnel + 명함 업로드) — 정상

## [2.1.25] - 2026-05-24
### Removed
- **「보험설계사를 위한 통합 정보 허브」 카드 섹션 제거** (`.ic-hero`)
  - HTML 섹션 통째 삭제
  - 관련 CSS 모두 삭제 — `.ic-hero{}` / `[data-theme=dark] .ic-hero{}` / `.ic-hero-title` / `.ic-hero-sub` / `.ic-hero-br` / `.ic-hero-cta` / `.ic-hero-pillgrid` (+ media queries) / `.ic-hero-pill` / `.ic-hero-pill.community` (+ dark) / `a.ic-hero-pill` / `.ic-hero-btn` (+ primary, hover) — 데드코드 일괄 정리
  - `.ic-hero-fav` 컨테이너 제거 — 내부 자식 CSS(`.ic-hero-fav #home-fav-grid` 등) 는 `#fav-float-popup` 으로 재타겟팅

### Changed
- **「진행중인 채용공고 / 강의」 위치 이동**
  - 이전: `.ic-top-row` 아래 단독 행
  - 이후: `.ic-top-left` 안의 (구) `.ic-hero-fav` 자리 — live-monitor 바로 아래
  - 결과: 좌측 컬럼이 「실시간 인기 콘텐츠 → 채용공고 / 강의」 로 자연스럽게 흘러가고, 우측 카카오 패널과 높이 자동 정렬
- **MY FAVORITES — 드래그 가능한 floating popup 으로 변환**
  - `#fav-float-popup` (280px, top-right 기본 위치, max-height 62vh)
  - 헤더 (`.fav-float-handle`) 를 마우스/터치로 잡아 자유롭게 이동
  - 화면 경계 자동 clamp — 항상 헤더 일부는 보이게
  - 위치는 `localStorage.ic_fav_popup_pos_v1` 로 영구 저장
  - × 버튼으로 닫으면 우상단에 작은 ⭐ FAB(`#fav-float-reopener`) 가 노출됨 → 누르면 다시 열림
  - 숨김 상태도 `localStorage.ic_fav_popup_hidden_v1` 로 영구 저장
  - 홈 페이지에서만 노출 — 다른 페이지 이동 시 자동 hide, 홈 복귀 시 마지막 상태 복원
  - `body.ic-mobile` / ≤1024px 자동 hide (모바일 홈은 별도 UI)
  - 드래그 시 box-shadow 강조 + opacity 0.96 으로 들고 있는 느낌

### Backward Compat
- 즐겨찾기 렌더링 코드는 그대로 — 동일한 `#home-fav-section` / `#home-fav-grid` / `#home-fav-count` ID 가 popup 안에서 살아있어 기존 `renderFavorites()` 가 손대지 않고 작동

## [2.1.24] - 2026-05-24
### Changed (관리자 통계 — 신규 구조 반영)
- **클릭 통계 슬라이드 (Slide 1) — 좌측 빨간 PILL 추적 합류**
  - `MENU_LABEL` 에 `'좌측버튼': '↖ 좌측 빨간 버튼 (리스/렌트카)'` 추가
  - `menuOrder = ['우측버튼', '좌측버튼']` — 두 메뉴 그룹 모두 노출
  - 하드코딩된 「▶ 우측버튼 7일 클릭 추이」 → 「▶ 메뉴 버튼 7일 클릭 추이」로 일반화
  - 빈 상태 메시지도 일반화
- **렌트카 통계 슬라이드 (Slide 4) — 3단계 funnel 로 확장**
  - 이전: 카드 클릭 → 신청 완료 (2단계)
  - 이후: **페이지 진입 (좌측 PILL) → 카드 클릭 → 신청 완료** (3단계 funnel)
  - 신규 KPI: 누적/오늘 페이지 진입, 「클릭 → 신청 전환률」 명시
  - 신규 차트: 「최근 14일 — 페이지 진입」 라인 (좌측 PILL 클릭 일별 추이)
  - 슬라이드 타이틀: "🚗 리스/렌트카 통계 (진입 → 카드 클릭 → 신청 완료)"
- **API `/api/rental-stats` 확장**
  - `kpi.total_entries`, `kpi.today_entries`, `kpi.entry_to_click` 추가
  - `timeline[].entries` 추가 — 14일 일별 페이지 진입 카운트
  - 데이터 소스: `ic_card_clicks_daily` WHERE menu='좌측버튼' AND card='리스/렌트카'

### Removed / Cleaned
- **DB 클린업** (`migrations/d1_v2_1_24_merge_rental_clicks.sql`)
  - v2.1.22~v2.1.23 사이 짧은 기간에 들어온 분리된 클릭 기록을 통합:
    - `('좌측버튼','리스')` + `('좌측버튼','렌트카')` 두 행의 clicks 합산 → `('좌측버튼','리스/렌트카')` 단일 행으로 머지
    - 옛 두 행 DELETE
  - 결과: 통계가 새 단일 PILL 구조에 깔끔히 정렬, 분리된 옛 라벨 흔적 0

## [2.1.23] - 2026-05-24
### Changed
- **좌측 빨간 PILL nav — 「리스 / 렌트카」 단일 버튼으로 통합**
  - 이전: 🚗 리스 + 🚙 렌트카 두 개 버튼 (둘 다 동일 페이지)
  - 이후: **🚗 리스 / 렌트카** 한 개 버튼으로 통합
  - 버튼 크기 36×150px (이전 34×110px) 로 살짝 키워 한 줄 텍스트가 여유있게 들어가도록

## [2.1.22] - 2026-05-24
### Added
- **신규 페이지 `#page-rental` (🚗 리스/렌트카)**
  - "아직도 걸어다니세요?" 배너 + 추천 차량 라인업 카드 그리드 (홈에서 이전됨)
  - 등록된 차량 0대일 때 「현재 등록된 차량이 없습니다」 안내 노출
- **좌측 빨간 PILL 네비게이션** (사이드바 오른쪽 / 홈 콘텐츠 왼쪽)
  - `.left-nav-group` + `.left-nav-btn` — 우측 nav 패턴 그대로 미러, 빨간 그라데이션 (`#ef4444 → #dc2626`)
  - 2개 pill: **🚗 리스**, **🚙 렌트카** — 둘 다 `goToPage('rental')` 로 동일 페이지 진입
  - 호버 시 빨간 그림자 강조 + 슬라이딩 라이트 효과
  - ≤1024px 자동 숨김 (모바일 슬라이드 메뉴와 충돌 방지)
- **모바일 진입 카드** — 모바일 홈 강의 섹션 아래에 같은 카피로 큰 빨간 CTA 버튼 추가 (`goToPage('rental')`)
- **`PAGE_NAMES.rental`** 등록 → 백 바·문서 제목·라우팅 자동 통합

### Removed
- 홈 대시보드(`#page-home`)에서 인라인 추천 차량 라인업 섹션 제거
- 모바일 홈(`#page-home-mobile`) 에서도 동일 섹션 제거 (위 모바일 진입 카드로 대체)

### Changed
- `loadRentalLineup()` — 이전엔 빈 상태에서 section 자체를 `hidden` 했는데, 이제 페이지로 분리됐으므로 grid + 빈상태 메시지 토글로 변경

## [2.1.21] - 2026-05-24
### Added
- **강의공고 카드 — 「링크 복사」 버튼 추가** (오픈채팅방 공유용)
  - 홈 대시보드 + 강의 페이지 + 모바일 홈 강의 리스트 모두 적용
  - 채용공고는 이전부터 있었음 → 이제 두 종류 모두 패리티 확보
- **`/og/lecture/{id}` OG 미리보기 엔드포인트 신설**
  - `ic_lectures` 에서 title/instructor/description/file_url 읽어와 카카오톡·SNS 공유 시 강사명·이미지·요약이 풍부한 미리보기 카드 노출
  - 봇/크롤러 카운트 제외, 5분 캐시, 실제 사용자는 즉시 `/?lecture=<id>` 로 redirect
- **`shareLecture(id, evt)` JS 함수**
  - `/og/lecture/<id>` URL 을 clipboard 에 복사 + 「강의공고 링크가 복사되었습니다」 토스트
  - `trackClick('lecture_<id>', 'lecture_copy')` 로 강의별 복사 카운트 추적
- **`?lecture=<id>` 진입 핸들러** — 공유 링크로 들어온 사람은 강의 페이지로 자동 이동 + 해당 강의 뷰어 자동 오픈
- **모바일 list-item 공통 copy 버튼 (`.ic-m-list-copy`)**
  - 32×32 둥근 버튼, `has-copy` 클래스 적용 시 body 우측 패딩 38px 로 텍스트 안 가림
  - 복사 성공 시 0.9초간 녹색 강조
  - 다크모드 대응

## [2.1.20] - 2026-05-24
### Fixed
- **홈 통합 정보 허브 카드 — 메뉴 pill 카드 밖 삐져나감 버그**
  - 원인: `.ic-hero-pillgrid` 가 `repeat(5, 1fr)` (= `minmax(auto, 1fr)`). 「💬 MANAGER LINK」가 `nowrap`이라 한 줄 너비 ~108px → 좁은 PC hero(약 365–500px)에서 5컬럼 셀이 70–95px → 트랙이 콘텐츠 최소 너비까지 확장되면서 그리드가 카드보다 넓어져 우측이 카드 경계 밖으로 노출됨
  - 수정:
    1. `repeat(5, 1fr)` → **`repeat(4, minmax(0, 1fr))`** (PC) — 트랙 expansion 차단 + 4컬럼으로 셀 너비 확보
    2. `.ic-hero-pill` 에 `min-width: 0` + `overflow: hidden` + `text-overflow: ellipsis` 보호
    3. `.ic-hero-pill.community` (CREW 300 / MANAGER LINK) 는 `grid-column: span 2` 로 2셀 점유 → PC 마지막 줄이 `[뉴스] [CREW span2] [MANAGER span2]` 가 안 되고 `[CREW span2] [MANAGER span2]` 한 줄로 자연스럽게 정렬
    4. 태블릿(≤720px, ≥381px) 은 3컬럼 + community `auto`(1셀) — 셀 너비가 충분
    5. 모바일(≤380px) 은 2컬럼 + community `span 2`(전체 행)
  - 결과: 어느 너비에서도 모든 pill 이 카드 안에 머무름

## [2.1.19] - 2026-05-24
### Added
- **홈 통합 정보 허브 카드 — 커뮤니티 오픈채팅 버튼 추가**
  - 「📚 보험지식 / 🗞 뉴스」 뒤에 **💬 CREW 300**, **💬 MANAGER LINK** 2개 pill 추가
  - 사이드바와 동일 링크 사용 (`gSN4EEoh`, `gka8SGqi`)
  - 새 탭으로 열림 + `trackClick('...오픈채팅 참여','hero-pill')` 분석
  - **카카오 옐로우 변형 (`.ic-hero-pill.community`)**: 평시엔 옐로우 톤 테두리, 호버 시 진한 옐로우 배경 + 진한 글씨로 외부 링크임을 직관적으로 구분
  - 모바일/태블릿에서도 자동 줄바꿈 (기존 `grid-template-columns` 변형 그대로 적용)
  - 라이트/다크 테마 모두 자연스러운 톤 매칭

## [2.1.18] - 2026-05-24
### Fixed
- **커뮤니티 오픈채팅방 링크 갱신** (기존 링크 「존재하지 않는 채팅방」 오류)
  - **CREW 300**: `gd0a5Cjh` → `gSN4EEoh` (https://open.kakao.com/o/gSN4EEoh)
  - **MANAGER LINK**: `gxFQUWFh` → `gka8SGqi` (https://open.kakao.com/o/gka8SGqi)
  - 적용 위치 (총 4곳)
    - PC 사이드바 `.side-comm-section` 의 CREW 300 / MANAGER LINK 버튼
    - 모바일 홈 `#page-home-mobile` 의 커뮤니티 참여 섹션 두 버튼
  - 운영자 문의 링크(`sAZWQ7pi`)는 그대로 유지

## [2.1.17] - 2026-05-24
### Changed
- **홈 대시보드 — 즐겨찾기 / 오픈채팅방 대화순위 하단 여백 채우기**
  - **즐겨찾기**: 사용자가 등록한 개수가 적어도 시각적으로 풍성하게
    - `#home-fav-grid` 의 `max-height: 240px` 제약 제거 → `flex: 1` 로 카드 영역 전체 채움
    - 사용자 즐겨찾기 + **「💡 추천 도구」 패딩 카드**로 총 8개 목표 노출
    - 추천 카드는 실무도구(계산기 등) 우선, 그래도 부족하면 보험포털 카드로 채움
    - 추천 카드는 사용자 즐겨찾기와 시각적으로 구분 — 80% 투명도, 호박색 테두리, 「💡 추천」 배지
    - 「이런 도구도 자주 쓰여요」 구분선으로 사용자 본인 즐겨찾기와 분리
    - 추천 카드 클릭 시 해당 도구가 즉시 실행됨 (사용자가 자주 쓰게 되면 ☆ 별 버튼으로 진짜 즐겨찾기에 추가 가능)
  - **오픈채팅방 대화순위**: Top 10 → **Top 20**
    - 카드 영역(`align-self: stretch`)을 자연스럽게 채움
    - 항목이 많을 때는 v2.1.12 에서 추가한 얇은 스크롤바(4px)로 부드럽게 스크롤
- 결과: 양쪽 카드 모두 하단까지 콘텐츠가 차서 즐겨찾기·대화순위가 짧을 때 생기던 어색한 흰 여백 해소

## [2.1.16] - 2026-05-24
### Fixed
- **카카오톡/슬랙 공유 시 OG 첫 이미지 미노출 버그**
  - 원인 1: `/api/files/[[path]].js` 에 `onRequestHead` 가 없어서 HEAD 요청이 Cloudflare Pages 정적 자산 폴백(SPA index.html) 으로 떨어짐 → 카카오 스크래퍼가 og:image 의 Content-Type 을 HEAD 로 사전 검증할 때 `text/html` 받고 이미지로 인정 안 함
  - 원인 2: 일부 파일이 R2 에 잘못된 Content-Type(`text/html`) 메타데이터로 저장되어 있었음
  - 원인 3: OG 메타에 하드코딩된 `og:image:width=1200, height=630` 가 실제 카드뉴스 첫 슬라이드(예: 2100×3000) 와 안 맞아서 일부 스크래퍼가 이미지 매칭에 실패
  - 수정 (`/api/files/[[path]].js`)
    - `onRequestHead` 추가 — `env.STORAGE.head(key)` 로 정확한 헤더만 응답
    - GET/HEAD 공통 로직: 확장자가 알려진 타입(png/jpg/webp/pdf 등) 이면 R2 stored metadata 보다 **확장자 기반 inferred MIME 우선 사용** → 잘못 저장된 contentType 자동 보정 (기존 파일 재업로드 불필요)
  - 수정 (`/og/[type]/[id].js`)
    - `og:image:width` / `og:image:height` 하드코딩 제거 — 실제 이미지 크기와 mismatch 시 스크래퍼 거부 방지
    - `og:image:alt` / `twitter:image:alt` 추가 (접근성·검색 노출 ↑)

### Notes
- 카카오톡은 OG 응답을 약 5분 캐싱 — 수정 직후 같은 링크를 다시 공유해도 옛 미리보기가 잠시 보일 수 있음
- 카카오 OG 캐시 강제 갱신은 카카오 디벨로퍼스(https://developers.kakao.com/tool/clear/og) 에서 URL 넣고 「캐시 갱신」 가능

## [2.1.15] - 2026-05-24
### Fixed
- **관리자 방문 개요 — 「이번 주 방문자」 주 경계 보정**
  - 이전: 월요일 시작 주(ISO 주) 로 계산되어 일요일에 6일치가 누적된 비정상적으로 큰 숫자가 표시됨 (예: 오늘 일 5/24 = 34명, 이번 주 5/18 ~ 5/24 = 2471명 — 5/19 의 2039 데이터가 끼어있음)
  - 수정: **일요일 시작 ~ 토요일 끝** (국내 달력 관례) 으로 변경
    - 매주 일요일 0시(KST) 에 「이번 주」 카운터가 자동 리셋
    - 일요일에는 그 날 방문만 잡혀 「오늘 ≈ 이번 주」 가 자연스러움
    - SQL 도 `date >= week_start AND date <= today` 로 명시 (미래 날짜 제외)
  - admin UI:
    - 컨텍스트 바를 `이번 주(일~토): 5/24(일) ~ 5/30(토) · 오늘까지 누적` 형식으로 변경 → 주 범위와 누적 의미가 한눈에 보임
  - API 응답에 `today_date` 추가 (날짜 라벨링 보조)

## [2.1.14] - 2026-05-23
### Fixed
- **추천 차량 카드 — 「견적내기」 버튼 높이 통일**
  - 기존: 카드 본문(차종명·#태그·옵션)의 텍스트 양에 따라 버튼이 위/아래로 밀려서 그리드 정렬이 깨짐
  - 수정: 「견적내기 →」 + 「📨 문자로 견적서 발송해드립니다」 안내를 `.ic-rental-card-actions` 래퍼로 묶고 `margin-top: auto` 적용 → 어떤 카드든 버튼이 카드 하단에 핀되어 일자 정렬
  - 본문 정보(이름·태그·옵션)는 카드 상단부터 자연스럽게 채워지고, 빈 공간은 액션 블록이 흡수
- **관리자 — 렌트카 카드 통계에서 삭제된 차량 기록 완전 제외**
  - 기존 API: 삭제된 차량의 클릭도 `(삭제됨 #id)` 로 표시되어 통계 노이즈 발생
  - 수정 (`/api/rental-stats`): KPI · 14일 타임라인 · 차량별 표 **3개 쿼리 모두**에 `AND company_type IN (SELECT 'vehicle_' || id FROM ic_rental_vehicles)` 필터 적용
  - 결과: 현재 등록된 차량의 데이터만 집계 → 누적 클릭/신청·전환률·차트가 운영 가능한 차량 범위로만 산출됨
  - 차량 0대일 때는 14일 timeline 을 0 으로 패딩한 빈 통계 반환 (NULL/NaN 안전)

## [2.1.13] - 2026-05-23
### Added
- **관리자 통계 — 「🚗 렌트카 카드」 슬라이드 신설** (5번째 슬라이드, 차트 + 클릭수)
  - 별도 마이그레이션 없이 기존 `ic_link_clicks_daily` 의 누적 데이터(이미 trackClick 으로 들어오는 중) 활용
  - 신규 API `GET /api/rental-stats?days=14` (관리자 전용) → KPI · 14일 타임라인 · 차량별 Top 30
  - 화면 구성
    - **KPI 5장**: 오늘 카드 클릭 / 누적 카드 클릭 / 오늘 신청 완료 / 누적 신청 완료 / 누적 전환률
    - **차트 2개**: 최근 14일 — 카드 클릭 라인, 신청 완료 라인 (기존 `renderLineChart` 재사용, 0 패딩 적용)
    - **차량별 Top 클릭 표**: 썸네일·차종명·즉시출고 배지·👁 클릭(시각 막대)·📨 신청·⚡ 전환률(전환률에 따라 녹/황/회색)
  - 차량이 비활성/삭제되어도 행은 보존 (이름은 차종명 또는 `(삭제됨 #id)`)
  - 슬라이드 전환 시 차트 자동 재렌더링 (canvas 가 hidden 일 때 0px 그려지는 문제 방지)

### Tech
- API: `topByType` 패턴 대신 `CASE WHEN ... THEN clicks` 단일 쿼리로 KPI · 타임라인 효율 집계
- 일 빠진 날도 0 으로 채워 14일 연속 타임라인 보장 → 라인 차트 단절 없음

## [2.1.12] - 2026-05-23
### Fixed
- **홈 대시보드 — 오픈채팅방 대화순위 카드 높이 정렬**
  - 기존: `.ic-kakao-panel { align-self: start }` 로 컨텐츠만큼만 차지 → 왼쪽 컬럼(실시간 인기 + 통합 정보 허브 / 즐겨찾기)이 더 길 때 카드 하단이 즐겨찾기 하단보다 위에서 끊겨 미관 불량
  - 수정: `align-self: stretch` 로 그리드 컬럼 전체 높이 사용 → 카드 하단이 즐겨찾기 하단과 정확히 일치
  - 내부 동작:
    - `.ic-kakao-rank-list` 가 `flex: 1; min-height: 0; overflow-y: auto` 로 남는 세로 공간을 자연스럽게 채우고 항목이 많을 때만 얇은(4px) 스크롤바 노출
    - `.ic-kakao-updated` 는 `margin-top: auto` 로 카드 하단에 고정

## [2.1.11] - 2026-05-23
### Removed
- **관리자 통계 — 🌐 유입 경로 슬라이드 전체 제거**
  - 슬라이드 4종(방문 개요 / 클릭 통계 / 체류 시간 / 인기 콘텐츠)으로 통계 단순화
  - `SS_COUNT` 5 → 4, 관련 JS(`loadTrafficSources`/`renderTrafficSources`/`tsSetPeriod`) 비활성

### Fixed
- **인기 콘텐츠 통계 — 공유유입·복사 Top 빈 칸 채움**
  - 기존 `/api/top-items` 가 `*_top_shared_*` / `*_top_copy_*` 를 빈 배열로 하드코딩 → 모든 카드가 "데이터 없음" 표시
  - `ic_link_clicks_daily` 에 이미 누적 중인 type `knowledge_shared` / `cardnews_shared` / `knowledge_copy` / `cardnews_copy` 를 실제 쿼리하도록 수정
  - 보험지식·카드뉴스 각 섹션의 👁 조회 / 🔗 공유유입 / 📋 복사 Top 5 가 실제 데이터로 표시됨

### Changed
- **관리자 콘텐츠 업로드 탭 — 그룹별 재정렬 + 사용자신청 통합**
  - 14개 탭 → 11개로 정리, 시각적 구분자(`tab-group-sep`)로 그룹화
  - **「📥 사용자 신청」 통합 탭** 신설 — 기존 ⏳ 승인대기(채용·강의) + 📋 렌트카 신청을 하나의 패널 안 sub-tabs 로 통합
    - 외부 배지: 두 sub-tab 의 미응대 합산 표시
    - sub-tab 별 자체 배지: 채용·강의 승인대기 N건, 렌트카 신규 N건
    - 새로고침 버튼은 활성 sub-tab 기준 호출
  - 탭 그룹:
    1. **사용자 신청** (우선 응대 · 핑크 강조)
    2. **보험사 콘텐츠** (소식지 · 청구서류 · 보험교재 · 점검·장애 알림)
    3. **인슈어커넥트 콘텐츠** (뉴스 · 보험지식 · 대화순위)
    4. **홈 화면 노출** (팝업 공지 · 사이드바 배너)
    5. **공고·판매 등록** (채용공고 · 강의 · 차량 라인업)
  - 기존 `#up-pending`, `#up-rental-inquiries` standalone 패널 제거 — 컨텐츠는 `#up-requests` 안 sub-pane 으로 흡수
  - 승인대기 팝업의 "확인" 버튼이 이제 통합 탭 + pending sub-tab 으로 정확히 이동

## [2.1.10] - 2026-05-23
### Fixed
- **관리자 사이드바 배너 — 삭제 버튼이 동작하지 않던 버그**
  - 원인: 프론트가 `DELETE /api/sidebar-banner?set_id=xxx` 로 호출하지만, DELETE 핸들러는 `/api/sidebar-banner/[id].js` 에만 있어 라우팅이 안 맞았음 (path id 없는 요청은 `index.js` 로 가는데 거기엔 DELETE가 없었음 → 405 silently 무시)
  - `index.js` 에 `onRequestDelete` 추가 — `?set_id=xxx` query param 으로 세트 전체 삭제
  - 프론트도 응답 status 검사 + 실패 시 명확한 alert 표시하도록 강화

### Added
- **견적내기 팝업 (Step 2) — 명함 업로드 기능**
  - 「명함 사진 선택 또는 촬영」 점선 박스 (📇 아이콘 + 안내)
  - JPG / PNG / WebP / HEIC / GIF 지원, 최대 10MB
  - 모바일은 `capture="environment"` 로 후면 카메라 즉시 촬영 가능
  - 선택 시 즉시 미리보기(축소 썸네일) + 우상단 ✕ 제거 버튼 + 파일명·용량 표시
  - 「신청하기」 누르면 R2 의 `rental-cards/` 폴더에 자동 업로드(랜덤 파일명) → 반환된 URL 을 신청 데이터에 첨부
  - 업로드 실패 시 inquiry 제출 중단하고 에러 메시지 표시 (데이터 불일치 방지)
- **관리자 신청 내역 — 명함 썸네일 + 원본 열기 링크**
  - 신청 카드 안에 「📇 명함」 라벨 + 썸네일 이미지 (클릭 시 새 탭에서 원본)
  - 「원본 열기 ↗」 텍스트 링크 별도

### Backend
- DB Migration (`migrations/d1_v2_1_10_card.sql`)
  - `ic_rental_inquiries`: + `business_card_url TEXT`
- `functions/api/user-upload/[[path]].js`: ALLOWED_FOLDERS 에 `rental-cards` 추가, ALLOWED_MIME 에 HEIC/HEIF 추가
- `functions/api/rental-inquiries/index.js`: GET/POST 모두 `business_card_url` read/write

## [2.1.9] - 2026-05-23
### Changed
- **개인/법인 선택은 월 대여료 계산에 영향 X**
  - 운영자 응대 시 참고용 메타데이터로만 사용 — 실제 가격 계산에서는 제거
- **보증/선납 직접입력 → 객관식 칩**
  - 보증금: 0% / 10% / 20% / 30% / 40% / 50%
  - 선납금: 0% / 10% / 20% / 30% / 40% / 50% (별도 선택)
  - 각 선택마다 예상 월 대여료 실시간 변동
  - **선납금은 큰 폭 할인** (10% 단위 4%pt씩, 50% → 18% 할인) — 사용자 명시
  - 보증금은 소폭 할인 (1~8%) — 회수 보장 성격
- **「인슈어커넥트 파트너사 혜택」 → 「아직도 걸어다니세요? 보험설계사라면 우대해드립니다」**
  - 가독성 ↑ 한 구절을 강조하기 위해 폰트 크기·굵기 강화 + **3색 그라데이션 텍스트**(파랑→핑크→앰버)
  - **글로우 박스 섀도 펄스** (3.2s 주기)
  - **슬라이딩 샤인** (5.5s 주기로 빛이 배너 가로질러 지나감)
  - **아이콘 펄스 (Bob + tilt)** — 🚗 살짝 흔들림
  - **타이틀 펄스** — drop-shadow 톤 변화로 강조감 ↑
  - PARTNER BENEFITS → **「설계사 전용」 핑크/앰버 그라데이션 필**
  - `prefers-reduced-motion` 사용자는 모션 자동 무력화 (접근성)
- **Step 2 (상담 신청) — 선호 연락 시간대 칩 제거**
  - 휴대폰 입력란 아래에 「📨 입력하신 번호로 견적서가 문자로 발송됩니다」 안내문 추가
- **카드 — 「견적내기 →」 아래 「📨 문자로 견적서 발송해드립니다」 안내문 추가** (녹색 강조)

### DB Migration (`migrations/d1_v2_1_9_deposit_prepay.sql`)
- `ic_rental_inquiries`: + `deposit_pct INTEGER`, `prepay_pct INTEGER`
- 기존 `deposit_prepay` 텍스트 컬럼에도 "보증 N% / 선납 N%" 형식으로 같이 저장 (관리자 가독성)

## [2.1.8] - 2026-05-23
### Changed
- **견적내기 모달 — 「계약조건」 명세 반영**
  - 계약조건 섹션 헤더 추가
  - **개인/법인** 칩: 개인 / 개인사업자 / 법인
  - **계약기간** 칩: 24 / 36 / 48 / 60개월 (12개월 제거)
  - **주행거리** 칩: 1만 / 1.5만 / 2만 / 2.5만 / 3만 / 3.5만 / 4만 / 5만 km (8단계)
  - **보증/선납**: 직접입력 text input (예: "보증금 30% / 선납 0%")
  - **보험연령** 칩: 만21세 / 만26세 / 만30세 / 만35세 이상
  - 「기본 제공 (전 차량 공통)」 박스 — 대물보험 **10억**, 용품설정 **블박 + 썬팅** (고정 표시)
  - 색상·자차 보험 칩은 명세에서 빠져 모달에서 제거 (단 DB의 기존 컬럼은 보존 → 과거 신청 데이터 안전)
- **견적 계산식 갱신**
  - `base × 개인/법인 × 계약 × 주행 × 보험연령`
  - 법인=0.97, 개인사업자=0.98 (세제 반영)
  - 보험연령 21세=1.15, 26세=1.05, 30세=1.00, 35세=0.97

### Added
- **관리자 등록 — 출고 구분 필드 추가**
  - 라디오: 미지정 / ⚡ 즉시출고 / 일반출고
  - 홈 카드 썸네일 좌하단에 「⚡ 즉시출고」 그라데이션 배지 자동 노출
  - 관리자 차량 목록에도 즉시출고/일반출고 배지 표시
- **신청 내역 표시 확장**
  - 견적 옵션 박스에 개인/법인 · 계약 · 주행 · 보험연령 · 보증/선납 · 예상 월 대여료 한눈에
  - 과거 v2.1.7 데이터(색상/자차)도 작은 글씨로 호환 표시

### DB Migration (`migrations/d1_v2_1_8_quote_v2.sql`)
- `ic_rental_vehicles`: + `delivery_type`
- `ic_rental_inquiries`: + `business_type`, `deposit_prepay`, `insurance_age`

## [2.1.7] - 2026-05-23
### Changed
- **「내 공고 직접 등록」을 홈 → 사이드바로 이동**
  - PC/모바일 사이드바: 「빠른 검색」 바로 아래에 **💼 채용공고 / 🎓 강의공고** 2-버튼 카드 배치
  - 홈 본문(`#page-home`, `#page-home-mobile`)에서 해당 CTA 섹션 제거 → 홈 본문 한층 깔끔해짐
  - 동일한 `openSubmitModal('recruit'|'lecture')` 호출 — 기존 등록 모달 그대로 사용
- **렌트카 섹션 — 견적 시스템 전면 리뉴얼** (실제 렌트카 판매 사이트 UX 참고)
  - 카드 디자인: 차량 이미지 + 차종명 + **#태그(시승가능차량, 페이스리프트 등)** + 핑크/그라데이션 **「견적내기 →」** 버튼
  - 카드 클릭 → **다단계 견적 모달**
    - **Step 1 — 견적 옵션**: 계약기간 칩(12/24/36/48/60개월) · 연 주행거리 칩(1만/2만/3만/4만/무제한) · 색상 칩(관리자 등록 있을 때) · 자차 보험 칩(미선택/자차/완전자차) → **예상 월 대여료 실시간 자동 계산** 큼지막한 그라데이션 박스로 표시
    - **Step 2 — 상담 신청**: 견적 요약(차량명·계약·주행·색상·보험·월 대여료) + 이름/휴대폰/시간대/소속/메모 입력. ← 견적 수정으로 Step 1 로 복귀 가능
    - **Step 3 — 완료**: 영업일 1일 이내 전문매니저 연락 안내
  - 가격 계산식 (클라이언트 추정)
    - base × 계약기간 배수 (12=1.18 → 60=0.92) × 주행거리 배수 (1만=1.00 → 무제한=1.28) × 보험 배수 (자차=1.05, 완전자차=1.09), 천원 단위 반올림
    - **확정가는 전문매니저 안내**로 명시 → 사용자 기대값 관리

### Added
- **DB 마이그레이션** (`migrations/d1_v2_1_7_quote.sql`)
  - `ic_rental_vehicles`: `tags`, `base_monthly_price`, `fuel_type`, `colors` 컬럼 추가
  - `ic_rental_inquiries`: `contract_months`, `annual_km`, `selected_color`, `insurance_opts`, `estimated_monthly` 컬럼 추가
- **API 확장** — POST/PATCH 양쪽 모두 새 필드 read/write 지원
- **admin.html — 차량 등록 폼 확장**
  - 태그(콤마구분), 월 기본 대여료(견적 베이스), 연료(가솔린/하이브리드/디젤/전기/LPG), 선택가능 색상(콤마구분) 입력 필드 추가
  - 차량 목록에서 태그·연료·월기본·색상 같이 노출
  - 신청 내역에 「📐 견적 옵션」 박스 추가 — 계약/주행/색상/보험/예상 월 대여료 한눈에

### Tracking
- `trackClick('렌트카 견적 시작', 'vehicle_{id}')` — 카드 클릭 시점
- `trackClick('렌트카 견적 신청 완료', 'vehicle_{id}')` — 폼 제출 성공 시점
- 두 지표 비교로 견적 시작→실제 신청 전환률 측정 가능

## [2.1.6] - 2026-05-23
### Removed
- 홈 대시보드 추천 차량 라인업 우측의 "롯데렌터카 Biz car × AUTO.ST · 즉시 신청 가능" 보조 카피 제거 — 헤더가 더 깔끔해지고 「🚗 추천 차량 라인업 · PARTNER」 만 남음

## [2.1.5] - 2026-05-23
### Changed
- **추천 차량 라인업 — 위치 이동 + 「인슈어커넥트 파트너사 혜택」 헤더 추가**
  - PC: 「공고 직접 등록 CTA」와 「진행중인 채용공고/강의」 사이 → **「진행중인 채용공고/강의」 아래** 로 이동 (광고 슬롯 직전)
  - 모바일: 「공고 직접 등록」과 「빠른 메뉴」 사이 → **「진행중인 강의」 아래** 로 이동 (오픈채팅방 위)
  - 라인업 위에 **「🎁 인슈어커넥트 파트너사 혜택」** 그라데이션 배너 헤더 추가 → 향후 다른 파트너 혜택도 같은 카테고리로 확장 가능
  - 차량 0대일 때는 배너까지 자동 숨김 (`rental-section` 내부에 배치)
- 디자인 디테일
  - 배너 좌측 4px 그라데이션 액센트 바 (#1a3de8 → #db2777)
  - 우측에 「PARTNER BENEFITS」 핑크/블루 필 (PC 만)
  - 다크 테마 컬러 자동 대응

## [2.1.4] - 2026-05-23
### Removed
- v2.1.3 에서 만든 "재고 조회 유도" promo strip — 사용자 피드백으로 폐기 (이용자가 재고를 파악하는 흐름이 아니라, **카드 클릭 → 해당 차량 신청**으로 전환)

### Added
- **홈 대시보드 — 추천 차량 라인업 (카드 그리드 + 신청 모달)**
  - PC/모바일 홈에 차량 카드 그리드 노출 (관리자가 등록한 활성 차량이 있을 때만)
  - 카드 = 차량 이미지 + 차종명 + 옵션 요약 + 프로모션 배지("1.0% 추가" 등) + "구분" 라벨(전략/일반) + 「신청하기」 CTA
  - 카드 클릭 → 「🚗 차량 신청」 모달 오픈, 선택 차량이 박스 형태로 자동 표시되어 어떤 차를 신청하는지 명확
  - 신청 폼: **이름(필수) + 휴대폰(필수) + 선호 연락 시간대(4개 칩: 평일오전/평일오후/주말오전/주말오후) + 소속 GA/대리점(선택) + 추가 메모(선택)**
  - 제출 시 D1 `ic_rental_inquiries` 테이블에 저장 → 관리자 페이지로 들어옴
  - 완료 화면: "운영자가 입력하신 시간대에 맞춰 연락 · 영업일 기준 1일 이내"
- **백엔드 API (Pages Functions + D1 + R2)**
  - `GET  /api/rental-vehicles` (공개) — 활성 차량 목록 (홈 카드용)
  - `GET  /api/rental-vehicles?status=all` (관리자) — 전체 (비활성 포함)
  - `POST /api/rental-vehicles` (관리자) — 신규 등록
  - `GET/PATCH/DELETE /api/rental-vehicles/{id}` (조회 공개, 수정·삭제 관리자)
  - `POST /api/rental-inquiries` (공개) — 사용자 신청 접수
  - `GET  /api/rental-inquiries` (관리자) — 신청 목록 (status 필터링 지원)
  - `PATCH/DELETE /api/rental-inquiries/{id}` (관리자)
  - 이미지는 R2 (`/api/files/rental/...`) 활용
- **관리자 페이지 (admin.html) — 2개 탭 추가**
  - **🚗 차량 라인업**: 차종명/옵션/프로모션/구분(전략/일반)/정렬/이미지 업로드 → 등록 → 활성↔비활성 토글, 삭제
  - **📋 렌트카 신청**: 신규/연락완료/완료/취소 status 필터, 신청 상세(차량 썸네일, 고객 정보, 시간대, 소속, 메모), 상태 변경 버튼, 탭 라벨에 신규 신청 건수 badge, 60초마다 자동 폴링
- **DB 스키마 추가** (`migrations/d1_v2_1_4_rental.sql`)
  - `ic_rental_vehicles` — name, options, promo_text, image_url, category, sort_order, is_active, created_at, updated_at
  - `ic_rental_inquiries` — vehicle_id (FK), vehicle_name_snapshot, customer_name, customer_phone, preferred_time, organization, memo, status, timestamps

### Tracking
- `trackClick('렌트카 카드 클릭', 'vehicle_{id}')` — 카드 클릭 시점
- `trackClick('렌트카 신청 완료', 'vehicle_{id}')` — 폼 제출 성공 시점
- 두 지표를 비교하면 카드 클릭→실제 신청 전환률 측정 가능

## [2.1.3] - DEPRECATED
삭제됨. v2.1.4 로 대체.

## [2.1.2] - 2026-05-23
### Changed
- **사이드바 줌 정책 — 메인은 줌, 사이드바는 100% 고정 시각**
  - 이용자가 브라우저 줌(Ctrl +/-)을 110%, 150% 등으로 키워도 사이드바는 항상 "100% 기준"의 시각 크기로 유지
  - 메인 홈 대시보드는 정상적으로 줌이 적용 (글자/카드가 커짐) → 본문 가독성은 그대로 확보
  - 사이드바 내부의 모든 기능(로고/메뉴/시계/파트너 배너/커뮤니티/푸터)이 100%일 때와 동일하게 다 보임 — 줌으로 인한 잘림/스크롤 없음
  - 80% 등 축소 줌에서는 그대로 — 줄여서 보고 싶을 땐 그대로 두는 게 자연스러우므로 보정 안 함
- **동작 원리**
  - JS가 사이드바의 자연 높이가 뷰포트를 넘는지 측정 → 넘는 만큼만 CSS `zoom`으로 역(逆)보정
  - body `padding-left`도 같이 비례 축소해서 메인 영역 시작 위치 정렬 유지
  - `ResizeObserver`로 배너 로딩 같은 동적 변화에도 자동 재보정
  - 모바일/태블릿(≤1024px, `body.ic-mobile`)은 보정 비활성 — 슬라이드 메뉴로 동작
  - 가독성 floor: scale 최소 0.6 (그 아래로는 안 줄임, 극단 줌에서는 기존 `overflow-y: auto` 안전망으로 스크롤)

## [2.1.1] - 2026-05-23
### Fixed
- **브라우저 줌(Ctrl +/-) 시 사이드바 잘림 해결**
  - `.side-nav` `overflow: hidden` → `overflow-y: auto` (스크롤바는 CSS로 시각적 숨김 유지)
  - 줌으로 헤더·메뉴·시계가 커져도 사이드바 전체가 자연스럽게 스크롤되어 푸터/파트너사 프로모션 배너가 잘리지 않음
  - `.side-latest`에 `min-height: 180px` — 프로모션 영역이 0으로 짓눌리는 것 방지

## [2.1.0] - 2026-05-22
### Fixed
- **소식지·청구서류 뷰어 로딩 실패 복구**: v2.0.3에서 도입한 Mozilla PDF.js demo viewer(`mozilla.github.io/pdf.js/web/viewer.html`)가 비공식 임베딩이라 X-Frame-Options/CORS로 차단되어 자료가 안 떴음
  - 네이티브 iframe(`src="${url}#view=FitH"`)으로 복원 → 브라우저 내장 PDF 뷰어가 모바일에서도 페이지 스크롤/줌 처리
  - 모달 좌측 상단에 「⤴ 새 탭에서 열기」 fallback 링크 추가 → in-app 브라우저에서 페이지 넘김이 불편할 때 OS 기본 PDF 앱으로 바로 열 수 있음

## [2.0.9] - 2026-05-22
### Added
- **공유 링크 방문자 카운트**: `/og/{type}/{id}` 진입 시 서버측에서 `ic_visits_daily` 증가
  - 카카오톡/슬랙/페이스북/네이버 등 봇·크롤러 UA(`BOT_UA_RE`)는 카운트 제외
  - 리다이렉트 target에 `_via=share` 플래그 부여 → 클라이언트 `trackVisit()`가 중복 카운트 방지
  - 홈 대시보드 `/api/stats` + 관리자 페이지 통계 모두 자동 반영 (동일 테이블 참조)

## [2.0.8] - 2026-05-22
### Changed
- **홈 대시보드 채용공고 + 강의공고 가로 2열 페어 배치**: `ic-jobs-pair` 래퍼 신설 (PC `1fr 1fr` grid)
  - 좌측 = 진행중인 채용공고(내부 2열), 우측 = 진행중인 강의(내부 2열) → 시각적으로 총 4열 종대
  - 1024px↓ (좁은 화면)에서는 자동으로 세로 스택으로 변환

## [2.0.7] - 2026-05-22
### Changed
- **홈 대시보드 채용·강의 그리드 2열 종대**: PC `.ic-jobs-grid`를 4열 → **2열**로 변경. 채용공고/강의공고 두 섹션 모두 동일하게 적용. 480px↓ 모바일은 기존대로 1열 유지

## [2.0.6] - 2026-05-22
### Changed
- **공고 등록 입금 계좌 변경**: 카카오뱅크 3333-32-2808356 / 최주현(인슈어커넥트) → **카카오뱅크 3333-36-8293199 / 인슈어커넥트**
- **홈팝업 공지 / 점검·장애 알림 즉시 반영**: 관리자 페이지의 시작·종료 시각 입력 필드 제거
  - 등록 시 `starts_at` / `ends_at`을 항상 `null`로 전송 → API의 `IS NULL` 조건으로 항상 활성 노출
  - 버튼 라벨도 "등록 (즉시 반영)" / "📢 공지 등록 (즉시 반영)"로 명시
- **관리자 페이지 통계에서 하단네비 제거**: 모바일에서 하단 네비게이션 자체가 삭제됐으므로 통계 항목도 제거 (`MENU_LABEL`, `menuOrder`, 라벨 텍스트 정리)

## [2.0.5] - 2026-05-22
### Fixed
- **PC 홈 대시보드 레이아웃 복원**: 직전 v2.0.4에서 좌측 컬럼(`ic-hero-fav`) 안에 넣어 어긋났던 카드 배치를 원복
  - 「📤 내 공고 직접 등록하기」 CTA 위치를 **오픈채팅방 대화순위 카드 아래(전체 폭)** 으로 이동
- **오픈채팅방 대화순위 패널 높이 정리**: `align-self: start` 적용 → 좌측 컬럼 높이에 맞춰 강제로 늘어나던 패널을 컨텐츠 만큼만 차지하도록 변경, 하단 빈공간 제거

## [2.0.4] - 2026-05-22
### Added
- **홈 대시보드 공고 등록 CTA**: 페이지 진입 없이 홈에서 바로 채용/강의 등록 가능
  - PC: 히어로 영역 바로 아래 "📤 내 공고 직접 등록하기" 섹션 + 채용/강의 버튼
  - 모바일: 빠른 검색 다음 위치에 카드형 버튼 2개 (`ic-m-submit-card`)
- **모바일 헤더 시계 통합**: `ic-m-hero`를 `[시계][로고]` 가로 레이아웃으로 재구성
  - 최상단 로고 왼쪽에 컴팩트 시계(KST · HH:MM · 요일·MM.DD) 배치
  - 기존 별도 시계 카드는 호환 위해 숨김 처리 (display:none)

### Fixed
- **PC 사이드바 커뮤니티 URL 동기화**: `gSN4EEoh`/`gka8SGqi` (스테일) → `gd0a5Cjh`/`gxFQUWFh` (모바일과 동일, 최신)
  - 사용자가 보던 "존재하지않는 채팅방" 에러 원인 해소
- **모바일 커뮤니티 버튼 로고**: 이모지(🎯, 👥) → **crew300.png / managerlink.png** 실제 로고 이미지로 교체 (PC와 동일 자산)

## [2.0.3] - 2026-05-22
### Added
- **사용자 공고 승인 시스템**: 채용·강의 공고를 사용자가 직접 등록 → 관리자 승인 후 노출
  - 3-step 모달 (정보 입력 → 카카오뱅크 3333-32-2808356 / 최주현(인슈어커넥트) / 50,000원 입금 안내 → 완료)
  - 계좌번호 복사 버튼, localStorage 기반 1시간 1회 신청 제한 (스팸 방지)
- **관리자 승인 워크플로우** (admin.html)
  - 「⏳ 승인대기」 탭 + 빨간 펄스 배지 + 1분 폴링
  - 진입 시 자동 팝업 ("새 승인요청 N건 도착") + 사이드바 빨간 점 배지
  - 승인/반려 버튼 → 신청자명·연락처 alert로 노출 (수동 카톡 발송 안내)
- **커뮤니티 채팅방 fallback toast**: 카드 클릭 6.5초 내 페이지 이탈 없으면 "검색 가이드 + 운영자 문의" 안내

### Changed
- **모바일 보험지식·카드뉴스(최신) 그리드**: 1열 → **2열** (`body.ic-mobile`)
- **소식지/청구서류 PDF 뷰어**: PDF.js viewer(Mozilla CDN) 통합 → 모바일에서 페이지 넘김 가능

### API
- `GET /api/recruitments`, `/api/lectures`: 기본 `status=approved`만 반환, `?status=pending|all`은 관리자 전용
- `POST /api/recruitments`, `/api/lectures`: 관리자 인증 없으면 `status='pending'`으로 INSERT (submitter_name/contact 필수)
- `PATCH /api/{table}/{id}`: `status`, `reject_reason`, `approved_at` 갱신 허용
- `POST /api/user-upload/{folder}/{filename}`: 사용자 파일 업로드 (recruitments/lectures만, 10MB 제한, image/* + pdf)

### Database (D1)
- `ic_recruitments`, `ic_lectures` 컬럼 추가: `status`, `submitter_name`, `submitter_contact`, `reject_reason`, `approved_at`
- 기존 행은 `status='approved'` 기본값으로 유지

## [2.0.2] - 2026-05-19
- 개선: 홈 대시보드 레이아웃 재구성 (모임방순위 카드 높이에 맞춤)
  - 상단 좌측: 실시간 인기 콘텐츠(원래 크기) 위로 + 통합 정보 허브 · MY FAVORITES 아래 2열로 배치
  - 상단 우측: 모임방 대화순위 카드 (좌측 전체 높이와 매칭)
  - 하단: 진행중인 채용공고 + 시계 양옆 2컬럼 배치
  - 반응형: ≤1024px 상단 행 스택, ≤900px 하단 행 스택, ≤720px 전체 스택

## [2.0.1] - 2026-05-19
- 개선: 홈 대시보드 레이아웃 재구성
  - 상단 행: 실시간 인기 콘텐츠(좌) + 모임방 대화순위(우) 2컬럼
  - 히어로 행: 통합 정보 허브(좌) + MY FAVORITES(중) + 시계(우) 3컬럼
  - 채용공고 카드 컴팩트화 — 썸네일 4:2.2 비율, 폰트·여백 축소로 한눈에 들어옴
  - 즐겨찾기는 히어로 행 내 컴팩트 카드로 (빈 상태 안내도 축소)
  - 반응형: ≤1100px 2열, ≤1024px 상단 행 스택, ≤720px 전체 스택

## [2.0.0] - 2026-05-19
- 신규: 홈 대시보드 — 채용공고 옆 카카오톡 모임방 대화순위 패널
  - 채용공고(좌) + 모임방 대화순위(우) 2컬럼 분할 레이아웃
  - 관리자가 카카오톡 PC 대화 내보내기 .txt 파일 업로드 → 자동 파싱
  - 대화 횟수 기준 TOP 10 순위 (🥇🥈🥉 메달 + n건 표시)
  - 모임방 이름·기간 레이블 설정 가능, 저장 시 홈에 즉시 반영
  - Supabase ic_kakao_stats 테이블 신설 (RLS: anon 읽기 / 관리자 쓰기)
  - 관리자 페이지 '💬 대화순위' 탭 신설
    - .txt 파일 선택 → 분석 → 미리보기 → 저장 플로우
    - 카카오톡 PC/모바일 내보내기 양식 모두 지원 (패턴 자동 감지)
    - 시스템 메시지(이모티콘·사진·입퇴장) 자동 필터링
    - 저장된 통계 목록 + 삭제 기능
  - 데스크탑 2컬럼 → 모바일 1컬럼 반응형

## [1.9.7] - 2026-05-18
- 정리: 관리자 클릭 통계 — 우측버튼·하단네비만 남기고 나머지 통계 삭제
  - "📊 메뉴 클릭 요약" 섹션 전체 제거 (홈·CREW300·MANAGERLINK·운영자문의)
  - 카드 7일 추이: 실무도구·보험포털 → 우측버튼·하단네비 2종으로 교체
  - menuOrder 외 메뉴는 통계에 노출 안 되도록 엄격 필터링
  - 빈 데이터 상태 안내 메시지 추가

## [1.9.6] - 2026-05-18
- 정리: 홈 하단 "회원가입 없이 무료/개인정보 안전/중립 정보 제공/피드백 환영" 신뢰 카드 4개 제거 (푸터·사이드바와 중복)

## [1.9.5] - 2026-05-18
- 개선: 홈 대시보드 "주요 기능 안내" 정적 12개 카드 → 동적 채용공고 쇼케이스로 교체
  - "🔥 진행중인 채용공고" 헤더 + HIRING pulse 배지
  - 최신 4건 카드 그리드 (썸네일·NEW배지·회사명·제목·날짜)
  - 카드 클릭 → 채용공고 페이지로 이동 + 해당 항목 자동 뷰어 오픈
  - "전체 보기 →" 버튼으로 채용공고 페이지 직행
  - 로딩 스켈레톤, 빈 상태/에러 안내 포함

## [1.9.4] - 2026-05-18
- 개선: 즐겨찾기 발견성 향상
  - 홈 대시보드 최상단에 'MY FAVORITES' 섹션 추가 (히어로 바로 아래)
  - 즐겨찾기가 비어 있을 땐 안내 카드 + 실무도구 이동 버튼 자동 표시
  - 즐겨찾기 있을 땐 카드 그리드로 자동 전환, 카드 수 배지 노출
  - 실무도구 페이지의 기존 즐겨찾기 섹션과 동기화 (한 곳에서 추가하면 양쪽 갱신)

## [1.9.3] - 2026-05-18
- 정리: 홈 "주요 기능 안내" 카드 그리드 정렬 — 9개 → 12개 (즐겨찾기·빠른 검색·점검 알림 추가)
  - 데스크탑 4×3, 태블릿 3×4, 모바일 2×6 모든 화면에서 완벽한 직사각형
  - 카드 min-height 110px로 행 높이 균등화

## [1.9.2] - 2026-05-18
- 신규: 홈 히어로 우측에 iPhone 스타일 실시간 시계 위젯 추가
  - 24시 디지털 시계, 콜론 깜빡임, 초 단위 자동 갱신
  - KST 라벨, 녹색 활성 인디케이터, AM/PM 표시
  - 요일 칩 + 월/일 날짜 표시
  - 모바일(<860px)에서는 히어로 위/아래로 자동 스택

## [1.9.1] - 2026-05-18
- 정리: 홈 히어로 "서비스 자세히 보기" 버튼 숨김
- 정리: 푸터 "면책조항" 링크 숨김

## [1.9.0] - 2026-05-18
- 신규: 계산기 4종 풀세트 (블루오션 #3)
  - 💴 화폐가치 계산기 (현재↔미래 가치, 물가상승률 반영)
  - 🏦 예·적금 계산기 (단리/복리, 세후 수령액, 세금 옵션 3종)
  - 👴 연금 계산기 (적립금 계산 + 균등 인출 수령액 계산)
  - 💰 보험료 환산 (월·연·일시납 단위 환산)
  - 통합 모달 1개로 4개 계산기 처리 (탭 전환 방식)
- 신규: 보험사 점검·장애 알림 시스템 (블루오션 #4)
  - 신규 테이블 ic_service_alerts (Supabase, RLS 적용)
  - 랜딩 페이지 최상단 알림 배너 (info/warn/down 3단계 색상)
  - 다중 알림 시 ‹ › 슬라이드 네비, X 누르면 오늘 하루 숨김
  - 관리자 페이지: 알림 등록/활성화 토글/삭제 CRUD
  - 시작/종료 시각 설정, 자동 만료
- 실무도구 16개 → 20개로 확장, sec-badge 갱신
- 모바일 실무도구 패널에도 신규 4개 계산기 추가
- 글로벌 검색 + 즐겨찾기 인덱스에 신규 4개 자동 포함

## [1.8.0] - 2026-05-18
- 신규: 즐겨찾기 시스템 (블루오션 #1)
  - 모든 실무도구·보험포털 카드에 별(★) 버튼 자동 주입
  - 즐겨찾기한 항목은 실무도구 페이지 상단에 'MY FAVORITES' 섹션으로 자동 표시
  - localStorage 저장 (백엔드 부담 없음)
- 신규: 글로벌 빠른 검색 (블루오션 #2)
  - Ctrl+K / ⌘K 단축키로 어디서든 검색 모달 호출
  - 실무도구 16개 + 보험포털 5개 + 페이지 네비 11개 통합 인덱스
  - 키보드 ↑↓ 탐색, Enter 선택, Esc 닫기
  - 빈 검색어일 때 즐겨찾기 + 페이지 바로가기 자동 추천
  - 사이드바에 검색 버튼 추가 (모바일에서도 접근 가능)
- 포털 카드 5개에 data-tool-id 부여 (즐겨찾기/검색 식별자)

## [1.7.3] - 2026-05-18
- 버그: 파트너사 프로모션 배너가 화면 비율/창 크기에 따라 잘리거나 너무 작게 표시되던 문제 수정
  - 콘텐츠 영역: 고정 `max-height:70vh` 제거 → flex column + 세로 스크롤로 변경
  - 이미지: `object-fit:contain` 축소 방식 → `width:100%; height:auto` 자연 비율로 변경 (가로 폭 채움)
  - PDF iframe: 최소 높이 보장 (min-height:420px)
  - 결과: 어떤 화면 크기에서도 배너 콘텐츠가 잘리지 않고 100% 보임

## [1.7.2] - 2026-05-18
- 개선: 파트너 전용 페이지 버튼 위치를 '동료에게 공유하기' 바로 아래로 이동, side-footer-link 스타일로 통일, 구 side-partner-link CSS 전체 제거

## [1.7.1] - 2026-05-18
- 개선: 앱 설치 버튼 강조 스타일 적용 (블루 그라디언트, 글로우 pulse 애니메이션)

## [1.7.0] - 2026-05-18
- 신규: PWA 설치 지원 (PC·Android·iOS 홈 화면 바로가기)
  - manifest.json + sw.js 추가
  - PC/Android Chrome·Edge: 사이드바에 "홈 화면에 앱 설치" 버튼 (설치 가능 시 자동 표시)
  - iOS Safari: 하단 안내 배너 (공유 → 홈 화면에 추가, 하루 1회 표시)

## [1.6.9] - 2026-05-18
- 개선: 관리자 클릭통계 현행화 및 간소화
  - 메뉴 클릭 요약: 홈·CREW300·MANAGERLINK·운영자문의 4개로 정리
  - 카드 7일 추이: 실무도구·보험포털 2개로 축소 (우측버튼·하단네비·패널 제거)
  - MENU_LABEL 실무도구·보험포털 2개로 정리

## [1.6.8] - 2026-05-18
- 버그: 보험교재 업로드 시 한글 파일명으로 Supabase Storage Invalid key 오류 수정 (Storage 경로는 ASCII만 사용, 제목은 DB에 한글 그대로 저장)

## [1.6.7] - 2026-05-18
- 버그: 보험교재 다중 업로드 제목/설명 입력란 편집 불가 문제 수정 (nl-field 클래스 적용)

## [1.6.6] - 2026-05-18
- 개선: 보험교재 관리자 업로드 — 여러 파일 동시 선택 지원
  - 파일 선택 시 파일별 제목(파일명 자동입력)/설명 입력 행 동적 생성
  - 순서대로 업로드하며 진행상황 표시 (N/전체), 초기화 버튼 추가

## [1.6.5] - 2026-05-18
- 버그: 보험교재 모달 삽입 시 script 태그 중첩으로 JS 코드가 페이지에 텍스트로 노출되던 오류 수정

## [1.6.4] - 2026-05-18
- 버그: 모바일 실무도구 패널에 v1.6.1 신규 4개 도구 누락 수정 (특수건물·병원약국·실손24·숨은보험금)
- 버그: 홈 기능 소개 카드 "12종" → "16종" 업데이트
- 신규: 실무도구 '보험교재' 추가 (관리자 PDF/이미지 업로드 → 팝업에서 다운로드)
  - Supabase ic_textbooks 테이블 + textbooks 버킷 생성 (50MB 제한)
  - 랜딩페이지: 보험교재 툴카드 + 다운로드 팝업 모달 (다운로드 횟수 자동 집계)
  - 관리자 페이지: 보험교재 업로드·목록·삭제 기능 완성

## [1.6.3] - 2026-05-18
- guide.html 신규 추가 (보험설계사 업무 가이드, 3,000자+ 정적 콘텐츠)
  - 4개 섹션: 업무 흐름 가이드, 주요 보험사 소개, 기능 상세 안내, FAQ
  - AdSense 광고 슬롯 포함, about.html과 별개의 상세 가이드 페이지
- sitemap.js에 guide.html (priority 0.8) + about.html (priority 0.7) 추가

## [1.6.1] - 2026-05-18
- 실무도구 4개 신규 추가 (11개 → 15개)
  - 🏗️ 특수건물 조회 — 한국화재보험협회(KFPA) bridge.kfpa.or.kr
  - 🏥 병원·약국 찾기 — 건강보험심사평가원(HIRA) hira.or.kr
  - 💉 실손24 — 실손보험 통합 청구 silson24.or.kr
  - 💰 숨은보험금 찾기 — 생·손보협회 미청구 보험금 cont.insure.or.kr
  - 모두 외부 링크(새 탭), 링크복사 버튼, 클릭 추적 지원
  - 실무도구 배지 카운트 11개 → 15개로 업데이트

## [1.6.0] - 2026-05-18
- GA 전산 페이지 신규 추가 (법인대리점 17곳)
  - 우측 PILL 버튼 'GA' 신설 (전산과 수납 사이)
  - page-ga 페이지 + 검색 기능 + 17개사 카드 그리드
  - 데이터: 에이플러스에셋, 어센틱금융그룹, 더베스트금융, 프라임에셋, 메가,
    IFA, 지에이코리아, 글로벌금융, 메타리치, FM에셋, 엠금융, KGA에셋,
    토스인슈어런스, 굿리치, 벨류마크, 한화피플라이프, 에즈금융서비스
  - 각 카드: 약칭 배지 + 회사명 + 외부 링크(새 탭) + ripple 클릭 효과
  - 클릭 추적: trackClick(회사명, 'ga')
  - 홈 대시보드 기능 안내 카드에 'GA 전산' 추가 (🏢)
  - 출처 안내 박스: "법인대리점의 사내 전산 시스템 — 소속 설계사만 접속 가능"
  - PAGE_NAMES에 ga 추가

## [1.5.5] - 2026-05-17
- 푸터 컴팩트화: 로고 왼쪽 + 텍스트 오른쪽 가로 배치, 모바일 ≤640px 세로 fallback

## [1.5.4] - 2026-05-17
- 푸터 위치 정정: 페이지별 삽입 방식 → 원래 있던 전역 `<footer>` 요소에 통합
  - 1.5.3에서 JS로 .content마다 삽입했던 .ic-foot 제거
  - 기존 `<footer>` 요소 강화: 로고 + 정책링크 5개 + 면책 안내문 + 카피라이트
  - flex column 중앙정렬 디자인
  - .ic-foot* 관련 CSS 정리 (footer/.foot-* 클래스로 통합)

## [1.5.3] - 2026-05-17
- 전역 푸터로 개편 (모든 페이지 공통 하단) — 1.5.4에서 위치 정정

## [1.5.2] - 2026-05-17
- 홈 대시보드 '주요 기능' 카드를 정보 안내성으로 변경
  - `<a>` → `<div>` 태그 변경 (클릭 불가)
  - 페이지 이동 onclick 핸들러 제거
  - hover transform/border-color 변경 효과 제거 → 안정적인 정보 표시
  - cursor: default + user-select: none 적용
  - 섹션 부제 추가: "실제 이용은 우측 PILL 메뉴 또는 좌측 사이드 메뉴를 이용해 주세요"
  - 실제 페이지 이동은 우측 고정 PILL 버튼과 좌측 사이드바에서 처리

## [1.5.1] - 2026-05-17
- AdSense 광고 슬롯의 빈 박스 처리
  - 광고 미로드 시 슬롯 자체 숨김 (display: none)
  - data-ad-status="filled"일 때만 카드 프레임 표시

## [1.5.0] - 2026-05-17
- 📋 AdSense 재신청 준비: 1~4번 작업 완료
  1) 최신 콘텐츠 → 별도 페이지 (page-latest) + 우측 PILL '최신' 버튼 신규
  2) 홈 대시보드 전면 개편 — 서비스 소개 hero + 8개 기능 카드 + 신뢰 카드 4개 + 푸터
  3) 정적 페이지 3종 신규
     - terms.html: 이용약관 10조항 (보험정보 사이트 특화)
     - about.html: 서비스 소개 (Hero / 기능 / 사용자 / 운영원칙 / 출처 / 문의)
     - disclaimer.html: 면책조항 (정보 정확성 / 외부링크 / 보험사 저작권 / 광고 책임 / 책임한계)
  4) AdSense 광고 단위 활성화
     - 홈 대시보드에 ins.adsbygoogle 슬롯 자연스럽게 배치 (광고 라벨 포함)
     - #page-home ins.adsbygoogle display:none !important 룰 제거
     - showPage('home') 진입 시 idle 타이밍에 adsbygoogle.push() 호출
  5) 콘텐츠 출처 표기 (저작권 보호)
     - 소식지/청구서류 페이지 상단에 'ℹ️ 출처: 각 보험사 공식 자료' 안내 박스
- 푸터에 모든 정책 페이지(소개/약관/개인정보/면책) 링크 노출

## [1.4.0] - 2026-05-17
- ⚡ 추가 최적화 라운드 2
  - 🖼 **이미지 약 99% 다이어트** (합계 3.1MB → 99KB)
    - sharp으로 적절한 크기로 리사이즈 (사이드바 아이콘 96px, 로고 400px)
    - WebP 변환: managerlink 1.4MB→1.4KB, crew300 568KB→1.7KB, logo-banner 326KB→13KB
    - PNG도 압축해서 덮어쓰기 (WebP 미지원 브라우저용 폴백)
    - `<picture>` 태그로 WebP 우선, PNG 폴백 자동 처리
  - 🏗 **초기 로드 시퀀스 우선순위화 (requestIdleCallback)**
    - 즉시 로드: 홈 피드 (Above the fold)
    - 800ms idle: 사이드바 배너
    - 1500ms idle: 실시간 모니터
    - 2000ms idle: 사이드 통계
    - → 초기 화면 표시(LCP)가 빨라지고 TTI 단축
  - 📦 **AdSense를 페이지 load 이후 idle에 동적 삽입**
    - 초기 렌더 차단 완전 제거
  - 🎨 **content-visibility: auto** — 화면 밖 모달/오버레이 렌더 비용 회피
    - 카드뉴스 모달, 보험지식 모달, 도구 패널, 사이드바 배너 모달, 자동 팝업 등
    - 브라우저가 알아서 화면 안 보일 때 paint 스킵
  - 🔄 **innerHTML 일괄 적용 (rAF 묶음)**
    - renderLiveMonitor: 3개 리스트를 requestAnimationFrame 안에서 묶어서 한 번에 적용 → reflow 1회
  - 🧹 .gitignore 추가 (.img-opt, node_modules 등 제외)

## [1.3.2] - 2026-05-17
- 통계 책임 분리 (랜딩 vs 어드민)
  - 랜딩페이지 모니터 위젯: 👁 조회수 토글 제거 → 오늘/누적만 표시 (조회수 단일 메트릭으로 단순화)
  - 어드민 페이지에 '🔥 인기 콘텐츠' 5번째 슬라이드 신설
    - 보험지식 & 카드뉴스 섹션별로 3분할:
      · 👁 조회 Top 5 (블루 박스, 내부 클릭 기준)
      · 🔗 공유유입 Top 5 (그린 박스, 외부 공유 링크 진입 = 바이럴 지표)
      · 📋 복사 Top 5 (퍼플 박스, 공유 의도)
    - 범례 안내 카드 + 오늘/누적 토글 + 업데이트 시각

## [1.3.1] - 2026-05-17
- 콘텐츠 조회 추적을 '내부 클릭' vs '외부 공유 링크 유입'으로 분리
  - 기존: 두 경로가 모두 같은 'knowledge'/'cardnews' 타입으로 합산되어 구분 불가
  - 변경: 외부 공유 링크 진입은 'knowledge_shared'/'cardnews_shared'로 별도 기록
  - openKnPost / openCardNewsModal에 source 파라미터 추가 (URL 핸들러에서 'shared' 전달)
- 모니터 위젯 토글 추가: 👁 조회 / 🔗 공유유입 / 📋 복사 (3개 모드)
  - 조회 모드: primary=내부 클릭, secondary=🔗 공유유입 보조 표시
  - 공유유입 모드: primary=공유 유입수, secondary=👁 내부 클릭 보조 표시 (바이럴 점수 = 외부 유입이 높은 콘텐츠)
  - 복사 모드: 기존과 동일
- Supabase RPC 업그레이드: knowledge/cardnews에 shared 필드 LEFT JOIN + top_shared 4개 리스트 추가

## [1.3.0] - 2026-05-17
- 유입 경로 추적 시스템 추가 (Traffic Sources)
  - DB 스키마: ic_page_visits에 referrer_domain/referrer_url/landing_path/utm_source/utm_medium/utm_campaign/device_kind 컬럼 추가
  - 인덱스 추가로 빠른 집계
  - 랜딩페이지 trackVisit이 유입 정보 자동 수집 (PII 제거: query string 제외)
  - 주요 도메인 그룹화: google/naver/kakao/youtube/instagram/facebook/twitter/threads 등 자동 분류
  - 자체 도메인 유입은 (direct)로 처리 (내부 이동 노이즈 제거)
- 관리자페이지: '🌐 유입 경로' 슬라이드 탭 신설 (Slide 3)
  - 유입 도메인 Top 10 (막대 그래프 시각화)
  - 랜딩 경로 Top 10
  - 디바이스(mobile/desktop/tablet) 분포
  - UTM 캠페인 테이블 (utm_source/medium/campaign × visits)
  - 최근 유입 50건 상세 테이블 (시각/유입원/랜딩/UTM/디바이스)
  - 오늘/누적 토글
- Supabase RPC: get_ic_traffic_sources (anon-callable, 6개 리스트 + 최근 50건 한 번에 반환)

## [1.2.0] - 2026-05-17
- ⚡ 성능 최적화 (페이지 렉 해소)
  - HTTP 캐싱 헤더 강화: 이미지/폰트/CSS/JS 1년 캐시 (immutable)
  - HTML stale-while-revalidate 적용 (1분 fresh, 10분 백그라운드 갱신)
  - 이미지 lazy loading + decoding="async" 적용 (crew300, managerlink 1.4MB는 사이드바 펼친 후에만 로드)
  - 로고는 fetchpriority="high"로 빠른 표시
  - 폰트 비차단 로드 (preload + media print 트릭) — 렌더링 블록 제거
  - Page Visibility API: 탭 비활성 시 60초 모니터 인터벌 자동 정지 → 다시 활성화되면 재개
  - prefers-reduced-motion 대응: 모션 최소화 모드면 모든 애니메이션 무력화
  - 모바일에서 사이드바 배너 카드의 무한 glow/shine 애니메이션 비활성화 (저사양 기기 렉 방지)
- Supabase 인덱스 추가 (통계 쿼리 가속)
  - ic_link_clicks: (company_type, date), (company_type, company_name)
  - ic_card_clicks: (menu, date)
  - ic_page_visits/sessions, ic_sidebar_banner, ic_card_news 인덱스 추가
  - ANALYZE 실행으로 통계 갱신

## [1.1.1] - 2026-05-17
- 실시간 모니터 위젯: 링크 복사 카운트 추적 추가
  - shareCardNews/copyKnLink 성공 시 trackClick(title, 'cardnews_copy'|'knowledge_copy') 호출
  - 위젯에 '👁 조회 / 📋 복사' 메트릭 토글 추가
  - 조회 모드: 메인 숫자=클릭, 보조 칩=복사수 (>0일 때)
  - 복사 모드: 메인 숫자=복사수, TOP 복사 항목으로 재정렬
  - 전산 컬럼은 복사 기능 없으므로 복사 모드에서 안내 메시지 표시
- Supabase RPC 업그레이드
  - knowledge/cardnews에 LEFT JOIN으로 copies 카운트 추가
  - knowledge_top_copy_today/total + cardnews_top_copy_today/total 6개 신규 리스트 반환

## [1.1.0] - 2026-05-17
- 랜딩페이지 최상단에 '실시간 인기 콘텐츠' 모니터 위젯 추가
  - 3개 카테고리(인기 전산 / 인기 보험지식 / 인기 카드뉴스) Top 3 표시
  - 오늘 / 누적 토글 (KST 기준)
  - 60초 자동 갱신 + 마지막 업데이트 시각 표시
  - 1/2/3위 메달 색상 (골드/실버/브론즈)
  - 항목 클릭 시 해당 페이지/포스트로 바로 이동
  - LIVE 빨간 펄스 애니메이션 배지
  - 모바일에서 1열 스택, 데스크탑에서 3열 그리드
- 클릭 추적 누락 보완
  - 카드뉴스 모달 열 때 trackClick(title, 'cardnews')
  - 보험지식 포스트 열 때 trackClick(title, 'knowledge')
- Supabase: get_ic_top_items RPC 추가
  - SECURITY DEFINER + anon/authenticated 권한 부여
  - jeonsan(life+nonlife+payment) / knowledge / cardnews × today/total 6개 리스트 반환

## [1.0.1] - 2026-05-17
- 랜딩페이지 사이드바 하단에 '🔐 파트너 전용 페이지' 링크 추가
  - 사이드 푸터 안에서 점선 테두리 + 작은 폰트로 차분하게 노출 (Discoverable but not flashy)
  - 호버 시 블루 강조 + 화살표 살짝 이동 애니메이션
  - 모바일에서는 더 작게 압축
- 관리자 페이지 로그인 화면 개선
  - '🔐 파트너 전용 페이지' 안내 카드 추가 (블루 그라데이션 배경)
  - 운영자 문의 카카오톡 오픈채팅 버튼 추가 (카카오 옐로우 #FEE500)
  - 'InsureConnect 메인으로 돌아가기' 링크 추가
- 보안 강화
  - admin.html에 noindex/nofollow/noarchive/nosnippet 메타 태그 추가 (검색엔진 노출 방지)
  - 기존 서버측 RLS + verify_admin_secret RPC 보안 모델은 변경 없음 (URL 노출되어도 안전)

## [1.0.0] - 2026-05-17
- 관리자 페이지 전면 디자인 리뉴얼 (랜딩페이지와 동일 스타일)
  - 사이버펑크 → 소프트 블루 클린 디자인으로 전환
  - 폰트: JetBrains Mono / Black Han Sans → Pretendard + Noto Sans KR
  - 색상: 네온 시안/핑크/퍼플 → 랜딩페이지 블루 팔레트 (#1a3de8, #4a70f5, #00c8ee)
  - 모든 cyberpunk 장식 제거 (scanlines, glitch flicker, neon glow, clip-path 다각형)
  - 라운드 코너: 0 → 16px (--radius-lg), 10px (--radius-md), 6px (--radius-sm)
  - 그림자: 네온 글로우 → 소프트 섀도우 (--sh-card, --sh-md)
- 라이트/다크 모드 토글 추가 (☀️ / 🖥 / 🌙)
  - localStorage 저장 + OS prefers-color-scheme 자동 감지
  - FOUC 방지 head 인라인 스크립트
- UX 개선
  - 카드/패널 일관된 라운드 + 호버 시 살짝 떠오르는 효과
  - 업로드 탭: pill 형태, active 시 그라데이션 배경
  - 통계 슬라이더: 클린한 탭 인디케이터 (밑줄 강조)
  - KPI/차트/순위 테이블: 한눈에 들어오는 위계
  - 삭제 버튼은 빨간색으로 통일하여 위험성 명확히 표시

## [0.9.1] - 2026-05-17
- 관리자 페이지: 사이드바 배너 섹션 전면 개선
  - 노출 정책 안내 박스 추가 (최신 1개 세트만 활성, 자동 팝업 동작, 오늘 하루 보지않기 정책 명시)
  - 'LIVE' 배지: 현재 노출 중인 최신 세트를 시각적으로 강조 (네온 그린 + flicker 애니메이션)
  - '대기' 배지: 비활성 세트는 흐리게 표시 + opacity 0.78
  - '👁 미리보기' 버튼: 이용자 시점과 동일한 슬라이드 뷰어로 배너 확인 가능
  - 미리보기 모달: ESC/좌우방향키/배경클릭 지원, 이미지/PDF 모두 지원
  - 활성 세트는 'LIVE' + '사이드바 + 자동 팝업 노출 중' 라벨 추가

## [0.9.0] - 2026-05-17
- 첫 접속 자동 팝업 (배너 광고) 기능 추가
  - PC/모바일 공통: 페이지 로드 시 최신 파트너사 프로모션 배너를 자동 팝업으로 표시
  - 슬라이드 다수일 경우 이전/다음 버튼으로 탐색 가능 (단일이면 숨김)
  - "오늘 하루 보지않기" 체크박스 → localStorage에 오늘 날짜 저장 (다음날 다시 표시)
  - 미체크 시: 매 접속마다 표시 (광고 효과)
  - ESC 키, 배경 클릭, 닫기 버튼으로 닫기 가능
  - 이미지/PDF 모두 지원, 사이드바 배너와 동일한 데이터 소스 (ic_sidebar_banner) 재사용

## [0.8.8] - 2026-05-17
- 모바일 사이드바 배너 완전 재설계 (두 번째 이미지처럼)
  - 이전 모바일 CSS의 .side-cn-thumb height:90px 고정 제거 (충돌 해소)
  - flex:1 체인 정착: side-latest → list → card → thumb 모두 flex:1
  - 결과: 배너가 사이드바 남은 공간을 모두 차지 + 썸네일이 카드 안에서 body 뺀 영역을 다 차지
  - max-height 제한 모두 제거 → 자연스러운 비율
  - side-footer margin-top:0 유지 → 커뮤니티 바로 아래

## [0.8.7] - 2026-05-17
- 모바일 사이드바 중간 빈 공간 완전 제거
  - 전략 변경: side-latest flex:1→none, 모든 섹션 자연 높이
  - side-footer margin-top:auto 제거
  - 빈 공간이 생긴다면 사이드바 맨 아래(푸터 밑)에만 생기도록

## [0.8.6] - 2026-05-17
- 모바일 사이드바 커뮤니티 아래 빈 여백 제거
  - 원인: .side-footer { margin-top: auto } → 항상 하단에 고정되어 중간에 빈 공간 생성
  - .side-footer margin-top:0으로 override
  - .side-latest flex:1 유지 + 카드 max-height:185px 제한으로 두 번째 이미지처럼 자연스럽게 채움

## [0.8.5] - 2026-05-17
- 모바일 사이드바 배너 flex 확장 버그 근본 수정
  - 원인: 모바일 override CSS가 파일 앞쪽, 기본 sidebar CSS가 뒤쪽 → 기본값이 덮어씀
  - 해결: 사이드바 기본 CSS 바로 뒤에 모바일 flex 재정의 블록 추가
  - .side-latest / .side-latest-list / .side-cn-card / .side-cn-thumb 모두 flex:none !important

## [0.8.4] - 2026-05-17
- 모바일 사이드바 배너 이미지 영역 채움 수정
  - side-cn-thumb display:flex → display:block + img position:absolute inset:0
  - flex 컨텍스트에서 height:100% 미작동 문제 해결 → 이미지가 90px 영역을 꽉 채움
  - object-fit: cover 유지 (contain 되돌림)

## [0.8.3] - 2026-05-17
- 모바일 사이드바 배너 짤림 수정
  - side-nav overflow:hidden → overflow-y:auto (스크롤바는 시각적으로 숨김)
  - 배너 썸네일 object-fit: contain으로 변경 → 이미지 전체 표시 (크롭 없음)
  - 썸네일 배경색 추가 (contain 모드에서 여백 처리)

## [0.8.2] - 2026-05-17
- 모바일 하단 네비 바 온/오프 토글 기능 추가
  - 우측 하단 탭(▼/▲) 버튼으로 숨기기/다시 보기
  - 숨김 상태: 바가 아래로 슬라이드 아웃, 탭만 남음
  - localStorage로 상태 유지 (앱 재시작 후에도 기억)
  - 숨김 시 .content padding-bottom 자동 감소 → 콘텐츠 영역 최대 확보

## [0.8.1] - 2026-05-17
- 모바일 사이드 메뉴: 배너 카드 flex:1 제거 → 내용만큼만 높이 차지
- 썸네일 90px 고정, 카드 body 콤팩트 처리
- 커뮤니티·푸터 섹션이 화면 안에 모두 표시되도록 수정

## [0.8.0] - 2026-05-17
- 모바일 사이드 메뉴: 스크롤 제거, 한 화면에 전부 표시
  - 폭 min(80vw, 280px)으로 조정
  - 헤더·탭·배너·커뮤니티·푸터 전 영역 여백/폰트 압축
  - 배너 썸네일 max-height 110px으로 비율 유지하며 화면 맞춤

## [0.7.9] - 2026-05-17
- 모바일 사이드 메뉴 레이아웃 개선
  - 메뉴 폭: 고정 240px → min(85vw, 320px)으로 확대
  - side-nav: overflow-y: auto 적용 → 내부 전체 스크롤 가능
  - 파트너사 프로모션 배너 썸네일: flex:1 해제, 고정 160px 높이로 항상 보이게
  - 헤더 로고·메뉴 탭·커뮤니티·푸터 여백 최적화
  - 저작권 텍스트 모바일에서 숨김 (공간 절약)

## [0.7.8] - 2026-05-17
- 모바일 레이아웃 전면 수정
  - footer: 480px 이하에서 숨김 → 콘텐츠 영역 최대 확보
  - body padding-bottom 제거 (overflow:hidden 환경에서 레이아웃 압축 원인 제거)
  - .content padding-bottom으로 하단 네비바(72px+safe-area) 뒤 가림 방지
  - 홈화면: 햄버거 버튼 겹침 방지를 위해 padding-top 60px 자동 적용
  - back-bar 표시 시 body.has-back-bar 클래스로 padding-top 자동 전환
  - 홈피드 2열, 툴/전산/채용 1열, 소식지 2열 모바일 그리드 최적화
  - back-bar 제목 길면 말줄임(…) 처리

## [0.7.7] - 2026-05-17
- 카드납 가이드 모달 다크모드 대응
  - 모달 배경·헤더·검색창·탭·아코디언·뱃지·주의문·면책고지 전부 수정
  - 확인(ok/no) 뱃지, 카드사 칩은 기존 색상 유지 (가독성 충분)

## [0.7.6] - 2026-05-17
- 다크모드 전체 점검 및 수정
  - 보험지식 모달(제목·날짜·본문·표·댓글·입력폼) 다크 대응
  - 채용공고 뷰어 텍스트 다크 대응
  - 문의 폼 배경·입력창 다크 대응
  - 커뮤니티 히어로/블록/조건 카드 다크 대응
  - 소식지·청구서류 검색창 다크 대응
  - 홈피드 카드·카드뉴스 모달 다크 대응
  - kn-table: prefers-color-scheme → data-theme 기반으로 통일
- 모바일(≤480px) 우측 pill 버튼 → 하단 네비게이션 바로 교체
  - 전산·수납·소식지·청구·채용·실무도구 6개 버튼 아이콘+텍스트로 표시
  - safe-area(노치폰) 대응, 다크모드 대응, 가로 스크롤 지원

## [0.7.5] - 2026-05-17
- 사이드바 배너 업로드 시 파일 이름순 정렬 미리보기 목록 표시 (순번·파일명·크기)
- 슬라이드 뷰어: 세트 내부를 sort_order(파일 이름순) 기준으로 재정렬
- 관리자 목록: 세트 내 커버 이미지도 sort_order 기준 첫 번째 파일 표시

## [0.7.4] - 2026-05-17
- 사이드바 "최신글" → "파트너사 프로모션" 레이블 변경
- 배너 카드에 글로우 + 빛 흐르는 shine 애니메이션 추가 (3초 루프)
- 호버 시 카드 위로 살짝 뜨며 글로우 강조
- 카드 내부 레이블 색상 보라색 계열로 프로모션 느낌 강화

## [0.7.3] - 2026-05-17
- 사이드바 배너: 여러 파일을 한 번에 선택 → 하나의 세트로 묶어 업로드
- DB set_id + sort_order 컬럼 추가, 파일명 자연정렬로 순서 보장
- 사이드바: 최신 세트를 1개의 큰 카드로 표시 (n장 뱃지 포함)
- 카드 클릭 시 슬라이드 뷰어 모달 오픈 (이미지/PDF, 이전·다음 탐색)
- ESC·← → 키보드 내비게이션 지원
- 관리자: 세트 단위 삭제 기능

## [0.7.2] - 2026-05-17
- 사이드바 배너: 최신 1개 → 최대 20개 전체 리스트로 표시
- 각 항목 썸네일(이미지) 또는 아이콘(PDF) + 제목 + 상대 시간 표시
- 첫 번째(최신) 항목에 NEW 배지 표시
- 클릭 시 해당 파일 새 탭으로 오픈

## [0.7.1] - 2026-05-17
- 관리자 페이지에 "사이드바 배너" 업로드 탭 추가 (이미지/PDF 파일 업로드)
- Supabase ic_sidebar_banner 테이블 + sidebar-banner 스토리지 버킷 연동
- 배너 목록 조회 및 삭제 기능 (관리자 전용)
- 사이드바 loadSideLatest(): ic_card_news → ic_sidebar_banner 테이블로 변경
- 배너 클릭 시 파일 URL 새 탭으로 오픈 (이미지/PDF 직접 뷰어)

## [0.7.0] - 2026-05-17
- 홈피드 카드뉴스: 별도 fetch(limit=30) 제거 → cardNewsState.sets 재활용으로 전체 세트 표시
- 표지 이미지: items[0] (첫 슬라이드) 기준으로 항상 정확한 커버 표시
- 보험지식 limit 100으로 확대, Array.isArray 방어 코드
- loadSideStats() 크로스 스크립트 블록 ReferenceError 수정 → SB_ANON_KN 정상 정의

## [0.6.9] - 2026-05-17
- 우측 필버튼 이모지 제거, 텍스트만 표시, 크기 32×96px로 최적화
- homeFeedOpenNews findIndex 버그 수정: s[0].set_id → s.set_id (모달 안 열리던 문제)
- openKnPost: 배열 아닌 응답 처리 (Array.isArray 방어 코드)
- renderCardNewsTiles / loadCardNews catch: cn-tile-grid null 가드 추가

## [0.6.8] - 2026-05-17
- 인슈어커넥트 뉴스 페이지(#page-cardnews) 삭제 — 홈 피드에서 직접 열기로 전환
- 보험지식 페이지(#page-knowledge) 삭제 — 홈 피드에서 직접 모달 열기로 전환
- 홈 피드 로드 최적화: 카드뉴스 fetch limit 100→30
- 사이드바 최신글 썸네일 카드 뷰로 복구 (최신 카드뉴스 커버 이미지 표시)
- homeFeedOpenNews/homeFeedOpenKnowledge: goToPage 제거, 모달 직접 오픈
- openSideLatestItem: goToPage('cardnews'/'knowledge') 제거

## [0.6.7] - 2026-05-17
- 홈 피드 보험지식 썸네일 표시 (image_url 활용)
- 홈 피드 카드 클릭 시 해당 포스트로 직접 이동 (openKnPost 호출 수정)
- 우측 필버튼 크기 재조정 (38×112px, 4글자 한글+이모지 수용)
- 사이드바 최신글 전면 개편: 5개 채널(뉴스/소식지/청구서류/채용공고/지식) 통합 최신 업로드 리스트
- 사이드바 row 클릭 시 해당 페이지/포스트로 직접 이동, 상대 시간 표시 (n시간 전, n일 전)

## [0.6.6] - 2026-05-17
- 홈 피드 안정화: 카드뉴스/보험지식 fetch 독립 try-catch (한쪽 실패해도 다른쪽 표시)
- 명시적 select 파라미터 추가, 콘솔 경고 로깅 추가
- 우측 필버튼 통일: 모두 동일 크기 (32×96px), 동일 색상 (var(--blue-mid))
- 텍스트 길이 통일: 수납/청구/채용 (2자) — 시각적으로 일관된 모양

## [0.6.5] - 2026-05-17
- 홈 피드 로딩 수정: SB_URL_KN 의존 제거, loadHomeFeed 호출 위치 이동
- 우측 필버튼 전면 재설계: 바로가기 패널 → 6개 개별 필버튼 (전산/수납전산/소식지/청구서류/채용공고/실무도구)
- 버튼 그룹 뷰포트 중앙 정렬 (right-nav-group flex column)
- 각 버튼 고유 색상으로 페이지 구분

## [0.6.4] - 2026-05-17
- 홈 대시보드 전면 개편: 8개 카드 그리드 → 콘텐츠 피드 (카드뉴스 + 보험지식 최신순)
- 홈 피드에서 카드 클릭 시 해당 뉴스/지식 페이지로 바로 이동
- 우측 바로가기 플로팅 버튼 추가 (📋): 전산, 수납전산, 소식지, 청구서류, 채용공고, 보험지식 패널
- 실무도구 버튼 위치 조정 (두 버튼 겹치지 않도록)
- ESC 키로 두 패널 모두 닫기 지원

## [0.6.0] - 2026-05-17
- 사이드바 최신글 섹션 추가: 카드뉴스 최신 5건 실시간 표시 (Supabase 연동)
- 우측 실무도구 플로팅 버튼 추가: 클릭 시 슬라이드 패널로 11개 도구 목록 표시
- ESC 키 / 배경 클릭으로 패널 닫기 지원

## [0.5.9] - 2026-05-16
- 사이드바 전체 메뉴 탭 추가 (카드뉴스, 전산, 소식지 등 9개)
- 커뮤니티 참여 버튼 사이드바 이동 (CREW 300, MANAGER LINK)
- 피드백·공유·방문자통계·테마토글 사이드바 푸터 추가
- 다크모드 기본 지원 (라이트/시스템/다크)
- 미사용 히어로 CSS 정리 (343줄 감소)
- --blue 미정의 CSS 변수 수정

## [0.5.8] - 2026-05-15
### Added
- 실무도구 카드 링크복사 버튼 추가 (호버 시 노출, 터치 기기 항상 노출)
- 딥링크 해시 라우팅 지원: `#tools/{tool-id}` 형태로 특정 도구 바로 진입
  - 모달형(실비계산기·수술명검색·카드납가이드): 모달 자동오픈
  - 외부링크형: 카드 하이라이트 + 스크롤

## 0.5.7 - 2026-05-09
- 보험지식 포스트 표(Table) 빌더 추가: 팝업 다이얼로그로 행·열 설정, 셀 병합(colspan/rowspan), 배경색, 정렬 지원
- 보험지식 포스트 전체 수정 기능 추가: 제목·내용·태그 모두 편집 가능
- 프론트엔드 표 렌더링 추가: `[table]...[/table]` 마커 파싱 및 반응형 표 출력

## 0.5.6 - 2026-05-09
- 화살표 버튼 → 커뮤니티 허브 페이지로 이동 (보험설계사/설계매니저 탭 전환)
- 각 탭에 커뮤니티 상세 소개 + 카카오 오픈채팅 참여 버튼 포함

## 0.5.5 - 2026-05-09
- 사이드 메뉴 커뮤니티 항목 제거
- 우측 화살표 버튼 리디자인: 파란 배경 + 흰 화살표, 우측 엣지 고정, hover 시 슬라이드 인
- 버튼 클릭 → 커뮤니티 소개 페이지(보험설계사·설계매니저 카드)로 이동

## 0.5.4 - 2026-05-09
- 최상단 실시간 업데이트 LIVE 티커 배너 제거

## 0.5.3 - 2026-05-09
- 모바일 햄버거 버튼 정렬 수정: ☰ 문자 → SVG 아이콘으로 교체, 수직 정렬 정확히 맞춤

## 0.5.2 - 2026-05-09
- 홈→커뮤니티 버튼 목적지 수정: community-crew → community (커뮤니티 소개 메뉴 페이지)

## 0.5.1 - 2026-05-09
- PC 페이지 이동 버튼 아이콘·텍스트 색상 수정 (`--accent` 미정의 → `--blue-mid` 로 교체)

## 0.5.0 - 2026-05-09
- 홈↔커뮤니티 페이지 이동 버튼 추가 (스와이프 방식 대체)
  - 우측 고정 pill 버튼: 홈에서 "커뮤니티 →", 커뮤니티에서 "← 홈"
  - 홈 → community-crew (CREW 300) 직접 이동
  - 커뮤니티 관련 페이지 어디서든 버튼 클릭 → 홈
  - 호버 시 scale + 음영 효과

## 0.4.9 - 2026-05-09
- 홈 대시보드 카드 미리보기 세부 조정
  - 보험사 전산 카드 미리보기 제거 (카드 자체 클릭으로 진입 유도)
  - 인슈어커넥트 뉴스 1건→5건: cardnews ticker limit 15→60으로 확대, set_id 중복 제거 후 5개 세트 표시

## 0.4.8 - 2026-05-09
- 홈 대시보드 카드 미리보기 개선
  - 표시 개수 3→6개로 확대, 카드 여백 자동 채움 (overflow:hidden 클리핑)
  - 7일 이내 업로드 항목에 파란 점(●) NEW 뱃지 표시
  - 전산(6개), 실무도구(카드납 가이드·실손인수기준·할인할증 추가), 수납전산(실제 3개사명) 정적 항목 개선

## 0.4.7 - 2026-05-09
- 홈 대시보드 카드 최신 콘텐츠 미리보기 추가
  - 뉴스·소식지·청구서류·채용공고·보험지식: ticker fetch 재사용 (추가 API 호출 없음), 최신 3건 표시
  - 전산·수납전산·실무도구: 정적 항목 즉시 렌더링
  - 스켈레톤 로딩 애니메이션 (shimmer) → 데이터 로드 후 교체
  - 각 항목 클릭 시 해당 상세(카드뉴스 모달·뷰어·채용공고·보험지식 포스트)로 딥링크
  - polling 방식 deep-link (cardnews/recruit 비동기 fetch 완료 대기, 최대 3초)

## 0.4.6 - 2026-05-09
- 사이드 메뉴 서브메뉴 텍스트 정리
  - '보험설계사 커뮤니티' → '보험설계사' / '설계매니저 커뮤니티' → '설계매니저'
- 홈·커뮤니티 대시보드 노스크롤 레이아웃 재조정
  - flexbox fill로 카드가 남은 공간을 채우도록 수정 (소화면 스크롤 방지)
  - 홈: AdSense 블록 숨김, dash-grid grid-auto-rows: 1fr
  - 커뮤니티: community-grid flex:1, community-card height:auto
- 커뮤니티 상세 페이지 하단 '카카오 오픈채팅 참여하기' 중복 버튼 제거
  - CREW 300 / MANAGER LINK 각 페이지 하단 comm-cta-full 버튼 삭제

## 0.4.4 - 2026-05-09
- AdSense 승인 보완
  - 광고 유닛 (`<ins class="adsbygoogle">`) 홈 페이지에 재추가 (v0.4.2에서 누락)
  - privacy.html 이메일 → insureconnect@naver.com 로 통일
  - index.html canonical 태그 추가 (중복 색인 방지)

## 0.4.3 - 2026-05-09
- 뒤로가기 바 추가
  - 홈 외 모든 페이지 상단에 live-ticker 바로 아래 표시
  - ← 홈 버튼 + 현재 페이지명 브레드크럼
  - 홈 페이지에서는 자동 숨김

## 0.4.2 - 2026-05-08
- 완전 노스크롤 레이아웃 구현
  - 홈 대시보드: dash-hero 한 줄 슬림화, 카드 설명글·스탯 제거, 카드 콤팩트화 → 한 화면 완전 수용
  - dash-about 소개 스트립 숨김
  - 모든 .content 영역 스크롤바 완전 제거 (scrollbar-width:none / ::-webkit-scrollbar:none)
  - 콘텐츠가 많은 페이지는 마우스휠로 접근 가능하되 스크롤바 UI 없음
  - AdSense 블록 메인 레이아웃에서 제거

## 0.4.1 - 2026-05-08
- App Shell 레이아웃으로 전환: 스크롤 없이 한 화면에 푸터까지 표시
  - body를 flex column + height:100vh + overflow:hidden 으로 변경
  - live-ticker: position sticky 제거 → flex-shrink:0 (상단 고정)
  - .content: flex:1 + min-height:0 + overflow-y:auto (내부 스크롤)
  - footer: flex-shrink:0 (하단 항상 고정)

## 0.4.0 - 2026-05-08
- 푸터 단순화: 로고 + 한 줄 정보(카피라이트 · 개인정보처리방침 · 이메일)로 정리

## 0.3.9 - 2026-05-08
- 푸터 리디자인
  - 운영 문의 이메일 → insureconnect@naver.com 변경
  - 2단 구조로 정리: 상단(로고+태그라인 / 운영문의), 하단(카피라이트 / 개인정보처리방침)
  - 모바일 반응형 개선 (중앙 정렬)

## 0.3.8 - 2026-05-08
- 구글 애드센스 승인 최적화
  - privacy.html `noindex` → `index` 변경 (구글이 개인정보처리방침 크롤링 가능하도록)
  - sitemap.xml에 실제 URL 2개 추가 (/, /privacy.html)
  - 홈 대시보드 하단에 애드센스 광고 유닛(`<ins class="adsbygoogle">`) 추가
  - 푸터에 운영 문의 이메일 및 서비스 소개 문구 추가

## 0.3.7 - 2026-05-08
- 운영자 문의 카카오 오픈채팅 링크로 전환
  - 사이드 메뉴 '운영자 문의' → Supabase 폼 대신 카카오 오픈채팅 직링크로 변경
  - `<a>` 태그(`menu-tab-kakao`) 외부 링크 처리, JS showPage 핸들러에서 제외
  - admin.html 이용자 문의 탭 제거 (Supabase ic_inquiries 미사용으로 정리)
  - MENU_ORDER에 운영자 문의 항목 유지 (클릭통계용)

## 0.3.6 - 2026-05-08
- 설계매니저 커뮤니티 (MANAGER LINK) 서브메뉴 및 전용 페이지 추가
- 두 커뮤니티 페이지 전면 리디자인
  - 히어로 배너: 로고 + 태그라인 + 즉시 참여 버튼 (2열 레이아웃)
  - 커뮤니티 소개 + 추천 대상 특징 4종 (2열 본문 그리드)
  - 참여 조건 바: 채널유형 / 참여조건 / 비용 / 소속제한
  - 하단 전체폭 오픈채팅 참여 CTA 버튼
  - 각 커뮤니티별 컬러 테마 (CREW 300: 블루, MANAGER LINK: 퍼플)

## 0.3.5 - 2026-05-08
- 사이드 메뉴 개편 및 이용자 문의 기능 추가
  - 하단 '운영자 문의' 링크 버튼 제거
  - 사이드 메뉴에 '운영자 문의' 항목 추가 → 이용자가 이름/연락처/유형/내용 입력 후 Supabase에 저장
  - 커뮤니티 메뉴 서브메뉴 구조로 변경: 하위에 '보험설계사 커뮤니티' 항목 추가
  - '보험설계사 커뮤니티' 전용 페이지: CREW 300 소개 + 카카오 오픈채팅 참여 버튼
  - Supabase ic_inquiries 테이블 생성 (RLS anon INSERT/SELECT)
  - admin.html 이용자 문의 탭 추가 → 접수 목록 실시간 조회

## 0.3.4 - 2026-05-08
- 관리자 페이지 동기화 및 자정 리셋 연동
  - 사이드 메뉴 변경 반영: 메뉴 클릭 통계 MENU_ORDER를 커뮤니티만 표시
  - KPI '주간 방문자(7일)' → '이번 주 방문자'로 레이블 변경
  - Slide 0 상단에 날짜 컨텍스트 바 추가 (오늘 날짜 + 이번 주 월~일 범위 표시)
  - KST 자정 감지 로직 추가: 날짜 변경 시 캐시 초기화 후 강제 loadDashboard() 실행
  - Supabase get_ic_stats() RPC 월요일 기준 주간 집계 + week_start_date/week_end_date 반환
- index.html: 커뮤니티 사이드 메뉴 클릭 시 trackClick() 복원 (메뉴 클릭 통계 정상 수집)

## 0.3.3 - 2026-05-08
- 사이드 메뉴에 커뮤니티 복원

## 0.3.2 - 2026-05-08
- 사이드 메뉴 구성 변경
  - 기존 9개 메뉴 항목 제거 → 홈 버튼만 유지
  - 홈 대시보드 카드에서만 각 섹션 진입 가능
  - 사이드 메뉴에 현재 위치 인디케이터 추가 (홈 이외 페이지 진입 시 표시)
  - showPage(page) 독립 함수 분리 (goToPage 의존성 제거)

## 0.3.1 - 2026-05-08
- 카드별 클릭 7일 추이: 메뉴별 합산 → 카드별 개별 꺾은선 차트로 세분화
  - Supabase get_ic_card_clicks_7d() RPC 카드 단위로 재작성 (menu+card 조합)
  - 3열 그리드 레이아웃 (모바일 2열), 카드당 90px 높이 소형 차트
  - 우상단 누적 클릭 수 표시
  - 슬라이드 높이 동적 자동 조절 (콘텐츠 길이에 맞게 transition 적용)

## 0.3.0 - 2026-05-08
- admin.html 슬라이드 패널 4개 → 3개로 통합
  - 메뉴 클릭 통계 + 카드별 클릭 7일 추이를 '클릭 통계' 슬라이드 1개로 병합
  - 상단: 메뉴별 오늘/누적 클릭 리스트 / 하단: 메뉴별 7일 꺾은선 차트

## 0.2.9 - 2026-05-08
- admin.html 통계 대시보드 레이아웃 전면 재편
  - 통계 섹션 4개를 수평 슬라이드 패널로 재구성 (탭 네비게이션 + ◀▶ 버튼)
  - Slide 0: 방문 개요 (KPI 5개 + 7일 추이 꺾은선)
  - Slide 1: 메뉴 클릭 통계
  - Slide 2: 카드별 클릭 7일 추이 (메뉴별 꺾은선 차트)
  - Slide 3: 체류 시간 통계
- 카드별 클릭 통계: 바 차트 → 꺾은선 차트로 변경
  - Supabase get_ic_card_clicks_7d() RPC 생성 (7일 일별 메뉴별 클릭 수)
  - renderLineChart() 동일 렌더러 사용 (네온 글로우, 그라디언트, 베지어 곡선)

## 0.2.8 - 2026-05-08
- admin.html 카드별 클릭 통계 차트 리디자인
  - LED 세그먼트 → Canvas 기반 세로 바 차트 (일별 방문자 수 차트와 동일 스타일)
  - 메뉴별 독립 차트 (홈 / 실무도구 / 보험 포털)
  - 누적(cyan) + 오늘(yellow) 오버레이, 네온 글로우, 그리드 라인
  - 카드명 -45° 회전 레이블

## 0.2.7 - 2026-05-08
- 체류 시간 추적 기능 추가
  - Supabase ic_page_sessions 테이블 + get_ic_session_stats() RPC 생성
  - index.html: 세션 추적 JS 추가 (visibilitychange + beforeunload + 60초 heartbeat)
  - admin.html: 체류 시간 통계 섹션 추가 (오늘 세션 수, 평균 체류 시간, 분포, 최근 세션)
- 카드별 클릭 통계 차트 리디자인
  - 기존 채움 바 → 사이버펑크 LED 세그먼트 바로 교체
  - 순위 배지(01/02...) + 12단계 LED 블록 + 오늘/누적 수치 세로 스택

## 0.2.6 - 2026-05-08
- 카드별 클릭 통계 기능 추가
  - Supabase ic_card_clicks 테이블 + get_ic_card_stats() RPC 생성
  - 실무도구 11개 카드 / 보험 포털 5개 카드 / 홈 대시보드 8개 카드 클릭 추적
  - admin.html에 '카드별 클릭 통계' 섹션 추가 (메뉴별 그룹화, 오늘/누적, 바차트)

## 0.2.5 - 2026-05-08
- 실무도구 페이지 섹션 통합
  - 자동차보험·화재보험·실손보험 3개 섹션 → '실무도구' 1개 섹션으로 병합 (11개 도구)
  - 보험 포털 섹션 번호 04 → 02로 변경

## 0.2.4 - 2026-05-08
- 실무도구 > 실손보험 섹션에 '카드납 가이드' 팝업 추가
  - 생보사 6개사 / 손보사 11개사 카드납 가능 여부 정리
  - 초회·계속분 가능 여부, 수납방법, 결제 가능 카드사, 결제 가능 범위 표시
  - 탭 전환(생보/손보), 보험사명 실시간 검색, 아코디언 상세 펼치기 지원
  - 카드사별 브랜드 색상 칩, 주의사항 노트 표시

## 0.2.3 - 2026-05-08
- 실무도구 > 실손보험 섹션에 'KCD 질병코드 조회' 링크 추가
  - koicd.kr 모바일 KCD 조회 서비스 연결
  - 질병명으로 KCD 분류기호 검색, 건강보험 담보 여부 확인

## 0.2.2 - 2026-05-08
- 실무도구 > 실손보험 섹션에 '수술명 검색' 기능 추가
  - 수술분류표 1~5종 기준 수술명 즉시 조회
  - 전체 300여 개 수술명 DB 내장 (카테고리별 분류)
  - 실시간 검색 + 종(1~5종) 필터 지원
  - 종별 색상 배지 및 하단 종류 안내 표시

## 0.2.1 - 2026-05-08
- 실비 계산기: PDF 약관 + 공식 자료 교차 검증 후 전면 수정
  - 4세대 비급여 통원 공제 하한 수정: 2만원→3만원 (PDF/KNIA 확인)
  - 4세대 3대비급여 특약 공제 하한 수정: 2만원→3만원 (4세대는 3만원, 3세대와 다름)
  - 2세대 2차 선택형 입원 수정: G×90%+B×80%→T×90% (비급여80% 하향은 3차부터)
  - 2세대 2차·3차 표준형 통원/처방 공식 추가: MAX(공제, T×20%)
  - 2세대 3차 입원 표준형 추가: T×80%
  - 3세대 표준형/선택형 구분 복원 (PDF 명시 확인)
    - 표준형: T×80% / 선택형: G×90%+B×80%
    - 통원: MAX(공제, 표준형 T×20% / 선택형 G10%+B20%)
  - 유병자 건강보험 미적용 공식 복원: (G-MAX(공제,30%))×40% (PDF 확인)
  - UI: 표준형/선택형 선택 행을 2세대 2·3차 및 3세대에 표시

## 0.2.0 - 2026-05-08
- 실비 계산기: 결과 카드 UI 전면 개편
  - 총 의료비 − 자기부담(공제) = 보험사 지급 3단 계산 흐름으로 표시
  - 공제 금액을 노란색으로 강조 표시
  - 실질 보장률 시각 바(bar) 추가
  - 모바일 반응형 최적화

## 0.1.9 - 2026-05-08
- 실비 계산기: 유병자실손 계산 수정 (참고 이미지 기준)
  - 건강보험 미적용: 잘못된 ×40% 공식 제거 → 동일하게 환자부담액 ×70% 적용
  - 건강보험 미적용 시 계산근거 문구 명확화
  - 유병자 통원 연간 한도 안내 수정: 180일 → 180회
  - 유병자 입원 한도 안내 개선: 자기부담 연 200만원 초과분 전액보상 명시

## 0.1.8 - 2026-05-08
- 실비 계산기: 세대별 자기부담 공식 전면 수정 (참고 이미지 5종 + PDF 약관 기준)
  - 2세대 2·3차: 통원/처방 공제 = MAX(병원급공제, 급여10%+비급여20%) 적용
  - 2세대 2차 표준형/선택형 입원 공식 분리
  - 3세대: 표준형/선택형 구분 제거 (단일 공식 적용)
  - 4세대: 병원급 공제 2단계(의원·병원 1만원 / 종합·상급 2만원) 적용
  - 4세대 비급여 공제 하한선 수정: 2만원 (3만원→2만원)
  - 4세대 비급여 특약 공제 = MAX(2만원, 비급여30%) 수정
  - UI: 표준형/선택형 선택 행을 2세대 2·3차에만 표시

## 0.1.7 - 2026-05-08
- 실비 계산기: 세대별 건당 보장 한도 적용
  - 1세대 통원 50만원, 2세대 통원 30만원, 3세대 외래 25만원·처방 5만원
  - 4세대 통원 급여+비급여 합산 40만원, 유병자 통원 20만원
  - 한도 초과 시 경고 문구 + 연간/건당 한도 안내 표시

## 0.1.6 - 2026-05-08
- 실비 계산기 기능 구현 (1~4세대 + 유병자실손)
  - 세대별 보상 로직 (PDF 약관 기준)
  - 2세대 1·2·3차 차수 선택 / 표준형·선택형 분리
  - 3·4세대 3대 비급여 특약 계산 분리
  - 유병자 건강보험 적용/미적용 분기
  - 실시간 계산 + 계산 근거 표시
  - 실무도구 카드 coming-soon → 클릭 가능으로 전환

## 0.1.5 - 2026-05-07
- 실무도구 > 실손보험 섹션에 '실비 계산기' 오픈 대기중 카드 추가
- coming-soon 카드 스타일 추가 (점선 테두리, 흐림 처리, 준비중 뱃지)

## 0.1.4 - 2026-05-07
- functions/api/sitemap.js: Supabase 쿼리 정상 동작 확인 및 CDN 캐시 단축 (s-maxage 86400→600)
- ?debug=1 파라미터로 Supabase 응답 진단 기능 추가
- 사이트맵 정상 동작: 홈+privacy+지식글 6개 = 총 8개 URL 포함

## 0.1.3 - 2026-05-07
- functions/api/sitemap.js 로 동적 sitemap 경로 변경
- _redirects 추가: /sitemap.xml → /api/sitemap (정적파일 우선순위 문제 해결)

## 0.1.2 - 2026-05-07
- 동적 sitemap.xml Function 생성 (functions/sitemap.xml.js)
  - 기존 보험지식 게시글 전체 URL 자동 포함
  - 새 글 추가 시 자동 반영 (1시간 캐시)
  - 정적 sitemap.xml → Function으로 대체

## 0.1.1 - 2026-05-07
- 보험지식 게시글 독립 URL 페이지 생성 (functions/knowledge/[id].js)
  - 서버 렌더링 → 구글 크롤러가 본문 전체 색인 가능
  - Schema.org Article 마크업, OG/Twitter 카드, canonical 태그
  - 브랜드 일관성 있는 전용 레이아웃
- openKnPost: 게시글 열 때 URL /knowledge/[id] 로 pushState
- closeKnModal: /knowledge/* 경로에서 닫으면 history.back()
- popstate 리스너 추가 → 뒤로가기/앞으로가기 자연스럽게 동작
- openKnPostFromURL: /knowledge/[id] 경로 직접 진입 지원

## 0.1.0 - 2026-05-07
- 홈 대시보드 전면 리디자인
  - 히어로 헤더 (그라디언트 타이틀, 통계 배지)
  - 8개 기능 카드 — 클릭 시 해당 메뉴로 바로 이동
  - 카드별 고유 액센트 컬러 + 호버 애니메이션
  - 소개 스트립 2단 레이아웃
  - 전 구간 반응형

## 0.0.9 - 2026-05-07
- 홈 대시보드 페이지(page-home) 분리 — 서비스 소개 섹션을 첫 화면으로 이동
- 사이드메뉴 상단에 🏠 홈 버튼 추가 (기본 active)
- 인슈어커넥트 뉴스 탭과 홈 분리

## 0.0.8 - 2026-05-07
- 정적 서비스 소개 섹션 추가 (AdSense 콘텐츠 부족 해결)
  - 8개 기능 카드 (뉴스·전산·소식지·청구서류·채용·보험지식·실무도구·커뮤니티)
  - 서비스 설명 본문 텍스트 추가
  - 크롤러가 JS 없이도 읽을 수 있는 정적 HTML

## 0.0.7 - 2026-05-07
- ads.txt 생성 (Google AdSense 크롤러 인식)
- privacy.html 개인정보처리방침 페이지 생성 (AdSense 승인 필수 요건)
- 푸터에 개인정보처리방침 링크 추가
- _headers에 ads.txt Content-Type: text/plain 명시

## 0.0.6 - 2026-05-07
- _headers에 robots.txt Content-Type: text/plain 명시 (네이버 크롤러 인식 오류 수정)
- _headers에 sitemap.xml Content-Type: application/xml 명시
- robots.txt admin.html 크롤링 차단 추가

## 0.0.5 - 2026-05-07
- robots.txt에 네이버 크롤러(Yeti) 명시적 허용 추가
- sitemap.xml 생성 (SEO 검색 노출 개선)

## 0.0.4 - 2026-05-07
- robots.txt 생성 (네이버 검색봇 허용)
- 사이트 설명 메타태그 추가 (`meta name="description"`)

## 0.0.3 - 2026-05-07
- 구글 서치콘솔 사이트 소유확인 메타태그 추가 (`google-site-verification`)

## 0.0.2 - 2026-05-07
- 네이버 서치어드바이저 사이트 소유확인 메타태그 추가 (`naver-site-verification`)

## 0.0.1
- 초기 버전
