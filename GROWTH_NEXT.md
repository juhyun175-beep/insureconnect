# 성장 백로그 핸드오프 (4~8) — 새 세션에서 이어가기

> 현재 배포 버전: **v2.19.0**. 작업 전 `node scripts/release.mjs --dry`로 보안/버전 확인.
> 배포: `node scripts/release.mjs` (보안 HIGH 0 게이트 → wrangler --branch=main → 커밋). CHANGELOG 최상단에 버전 먼저 작성.
> DB: `npx wrangler d1 execute insureconnect-d1 --remote --command "..."`.
> 듀얼 홈: `#page-home`(데스크톱) / `#page-home-mobile`(모바일). `ic-mobile` = 폭≤768 or 모바일 UA(_isMobile, ~15328).

## ✅ 완료 (이번 세션)
- **1/8 AI 답변 공유 = 추천 바이럴**: `functions/a/[id].js`에 공유자 추천코드를 `ic_ref` 쿠키로 심음 → 공유 카드로 가입 시 공유자 +50P. (v2.18.0)
- **2/8 견적 부가수익 CTA**: 모바일 홈(`#page-home-mobile`, 계정카드↔빠른메뉴 사이)에 `.m-quote-cta`, `trackCardClick('홈배너','고객견적연결')`→`goToPage('partner')`. (v2.18.1)
- **3/8 사용자용 담보 빠른조회**: 실무도구에 `data-tool-id="coverage-lookup"` 카드 + `openCoverage` 모달(`#cov-overlay`). 공개 `/api/coverages`(approved, `q` 검색) 라이브. 즐겨찾기/링크복사/빠른검색/딥링크(TOOL_MODAL_MAP) 자동 통합. 백엔드 변경 0. (v2.19.0)

## ⬜ 4/8 — 기여 인센티브 게이미피케이션
- 사례 등록: `cases/extract.js`(회원 +10P 추출), `cases/analyze.js`(관리자) → `ic_insurance_cases(submitter_id)`. 승인 시 +20P 흐름 존재.
- 추천 리더보드 패턴(`functions/api/referral/leaderboard.js`) 미러링 → **사례 기여 리더보드**(`/api/cases/contributors` 신규) + 홈/마이페이지 노출 + 배지(등급 member/certified/premium 활용).

## ⬜ 5/8 — 채용공고 Google Jobs SEO
- JobPosting 스키마 **이미 있음**(`functions/og/[type]/[id].js` recruit type, jsonLd). 
- TODO: `sitemap.xml`에 승인 공고 URL 포함 + robots 확인 + `validThrough` 갱신. (sitemap 존재 여부 확인 후 생성/갱신)

## ⬜ 6/8 — 보험지식·인기글 SEO
- `/og/knowledge`, `/og/board`(indexable 조건부: view≥20 & 길이≥150) 존재.
- TODO: sitemap에 knowledge·인기 board 포함, 내부 링크 보강.

## ⬜ 7/8 — 주간 다이제스트 / 알림
- 카톡: `alert_optin`, `kakao_access_token`(공고 알림용), `ic_push_subscriptions`(푸시).
- TODO: 주간 다이제스트(새 공고·내 질문 답변·인기 사례) → 카톡/푸시. Cloudflare scheduled(cron) 또는 별도 트리거. 남용/빈도 가드.

## ⬜ 8/8 — 북극성 지표 대시보드
- 데이터: `/api/admin/metrics`(회원·방문·AI사용 14일 시리즈), `rental/telecom-stats`(전환율), `referral/leaderboard`.
- TODO: 관리자에 **가입전환율 · 추천율(현 15%) · 견적전환율 · AI재방문율**을 한 화면(통합 기록지표 슬라이드 추가). 기존 데이터 조합 — 신규 쿼리 최소.
