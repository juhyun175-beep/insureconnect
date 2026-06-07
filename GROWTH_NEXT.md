# 성장 백로그 핸드오프 (8) — 마지막 1개, 새 세션에서 이어가기

> 현재 배포 버전: **v2.21.0**. 작업 전 `node scripts/release.mjs --dry`로 보안/버전 확인. (v2.20.1 = 내부문서 노출차단 미들웨어 `functions/_middleware.js` — 별도 보안패치)
> 배포: `node scripts/release.mjs` (보안 HIGH 0 게이트 → wrangler --branch=main → 커밋). CHANGELOG 최상단에 버전 먼저 작성.
> DB: `npx wrangler d1 execute insureconnect-d1 --remote --command "..."`.
> 듀얼 홈: `#page-home`(데스크톱) / `#page-home-mobile`(모바일). `ic-mobile` = 폭≤768 or 모바일 UA(_isMobile, ~15328).

## ✅ 완료 (이번 세션)
- **1/8 AI 답변 공유 = 추천 바이럴**: `functions/a/[id].js`에 공유자 추천코드를 `ic_ref` 쿠키로 심음 → 공유 카드로 가입 시 공유자 +50P. (v2.18.0)
- **2/8 견적 부가수익 CTA**: 모바일 홈(`#page-home-mobile`, 계정카드↔빠른메뉴 사이)에 `.m-quote-cta`, `trackCardClick('홈배너','고객견적연결')`→`goToPage('partner')`. (v2.18.1)
- **3/8 사용자용 담보 빠른조회**: 실무도구에 `data-tool-id="coverage-lookup"` 카드 + `openCoverage` 모달(`#cov-overlay`). 공개 `/api/coverages`(approved, `q` 검색) 라이브. 즐겨찾기/링크복사/빠른검색/딥링크(TOOL_MODAL_MAP) 자동 통합. 백엔드 변경 0. (v2.19.0)
- **4/8 사례 기여 리더보드**: 신규 `GET /api/cases/contributors`(`referral/leaderboard` 미러). 삼따AI 홈 섹션에 `#home-clb` 패널(`loadCaseContributors`, `.clb-*`) — 상위 기여자+등급 배지+내 순위, 비면 자동 숨김. (v2.20.0)
  - 참고: 현재 승인사례 중 `submitter_id` 있는 건 1명(시드)뿐 → 기여 늘면 노출 확대. **마이페이지에도 "내 기여 N건/순위" 노출은 미구현**(원하면 추가): mypage stats 영역에 `/api/cases/contributors`의 `me` 재사용.

## ✅ 5/8 — 채용공고 Google Jobs SEO (감사결과 이미 구현·라이브)
- 동적 `functions/sitemap.xml.js`가 승인 공고 `/og/recruit/{id}`(status='approved') 포함(priority 0.9). 라이브 `/sitemap.xml` = **165 URL**(정적 sitemap.xml은 함수에 가려 무시됨).
- JobPosting 스키마 완비(`functions/og/[type]/[id].js`): title·description·datePosted·**validThrough(요청시각+90일=항상 신선)**·employmentType(CONTRACTOR)·hiringOrganization·jobLocation(KR)·본문 H1. robots `Sitemap:` 지시어 + `/llms.txt`(200) 정상.
- 잔재: 죽은 정적 `sitemap.xml`(2 URL, lastmod 없음) 제거 권장(섀도잉).

## ✅ 6/8 — 보험지식·인기글 SEO (감사결과 이미 구현·라이브)
- 동적 sitemap에 `/knowledge/{id}`(Supabase) + 인기 board `/og/board/{id}`(`view_count>=20 AND LENGTH(content)>=150`) 포함. 현재 인기 board 1건·승인공고 4건.
- 남은 여지(선택): 홈/허브에서 개별 knowledge·인기글로의 내부 링크 보강(소프트 SEO).

## ✅ 7/8 — 주간 다이제스트 / 알림 (인프라 완료, 발송 게이트 OFF)
- 신규 `POST /api/cron/weekly-digest`(`functions/api/cron/weekly-digest.js`): 새 채용·강의·사례+인기글 요약 → 카톡 메모(`sendMemoToMember`)+웹푸시(`sendWebPush`). **기본 DRY** — `DIGEST_SEND_ENABLED='1'`일 때만 실제 발송. 인증=관리자(x-admin-secret) 또는 `CRON_SECRET`(x-cron-secret). 빈도 가드=6일 내 send 생략(`ic_digest_runs`). (v2.21.0)
- **실제 발송 활성화(미실시)**: ① `wrangler pages secret put CRON_SECRET` ② 외부 cron 등록(Pages 네이티브 cron 없음 — Worker cron/GitHub Actions/cron-job.org가 주1회 POST) ③ DRY 미리보기 검증 ④ `DIGEST_SEND_ENABLED=1` 설정. 현재 수신자 카톡 옵트인 87·푸시 5.
- 미구현(선택): 개인화("내 질문 답변") — 현재는 공용 플랫폼 다이제스트.

## ⬜ 8/8 — 북극성 지표 대시보드
- 데이터: `/api/admin/metrics`(회원·방문·AI사용 14일 시리즈), `rental/telecom-stats`(전환율), `referral/leaderboard`.
- TODO: 관리자에 **가입전환율 · 추천율(현 15%) · 견적전환율 · AI재방문율**을 한 화면(통합 기록지표 슬라이드 추가). 기존 데이터 조합 — 신규 쿼리 최소.
