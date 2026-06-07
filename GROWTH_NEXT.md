# 성장 백로그 핸드오프 — 1~8 완료, 다음 후보(9~)부터 이어가기

> 현재 배포 버전: **v2.23.0**. 작업 전 `node scripts/release.mjs --dry`로 보안/버전 확인. (v2.20.1 = 내부문서 노출차단 미들웨어 `functions/_middleware.js` — 별도 보안패치)
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

## ✅ 8/8 — 북극성 지표 대시보드
- `/api/admin/metrics` 확장(`northstar`) + admin.html 「🎯 북극성 지표」 패널(`renderNorthstar`, `#mt-northstar`): 가입전환·추천가입률·견적전환·AI재방문 4 KPI 한 화면. 신규 엔드포인트 0. (v2.22.0)
- 실측: 추천 3.6%(6/166) · 견적 6.4%(3/47) · AI재방문 13.3%(2/15).

---

# 🆕 다음 후보 (9~) — 성장 백로그 v2

> 1~8 완료. 아래는 **데이터 실측 기반** 후속 우선순위. GROWTH.md 5축(유입·전환·측정·재방문·수익) 렌즈.

## ⬜ 9 — 주간 다이제스트 실발송 ON (7/8 후속) · 재방문↑
- 인프라는 v2.21.0 완료(발송 게이트 OFF). 활성화: ① `wrangler pages secret put CRON_SECRET` ② 외부 cron(Worker cron/GitHub Actions/cron-job.org 주1회 POST) ③ DRY 미리보기 ④ `DIGEST_SEND_ENABLED=1`.
- 추가: 개인화("내 질문에 새 답변") — 현재는 공용 다이제스트.

## ✅ 10 — 마이페이지 "내 성장" 패널 · 재방문·기여↑
- `/me`(`functions/me.js`) 프로필 아래 「📈 내 성장」 카드(`#growth-box`): 등급·포인트·다음 등급 진행바(100P/500P) + 사례 기여 건수·순위(`/api/cases/contributors` me). 미기여자 CTA. 신규 엔드포인트 0. (v2.23.0)

## ⬜ 11 — 추천율 개선 (현 3.6%) · 유입↑
- 가입 직후 추천 프롬프트 + 초대 보상/문구 강화. 1/8(공유=추천)·홈 초대 CTA 위에서 전환 최적화.

## ⬜ 12 — 견적 전환율 개선 (현 6.4%) · 수익↑
- 파트너 견적 플로우(클릭→신청) 마찰 감소·신뢰요소·후속 안내. `ic_link_clicks_daily` submit 단계 이탈 분석.

## ⬜ 13 — 담보 비교 표 (3/8 후속) · 실무가치↑
- 같은 담보를 보험사별 가입금액 가로 비교(`/api/coverages`). 관리자 담보 데이터 확충 유도.

## ⬜ 14 — 보험지식·인기글 내부링크 보강 (6/8 후속) · 유입↑
- 홈/허브 → 개별 knowledge·인기 board 링크(소프트 SEO). sitemap은 이미 라이브.

## ⬜ 15 — 북극성 지표 추세·목표 (8/8 후속) · 측정↑
- KPI에 전주 대비 증감(▲▼) + 목표선. `/api/admin/metrics` `northstar`에 직전기간 비교 추가.
