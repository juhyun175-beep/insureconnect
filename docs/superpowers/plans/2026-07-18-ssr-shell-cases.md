# SSR 공용 셸 및 사례 페이지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회사 SSR 페이지의 검증된 스타일·문서 외곽을 공용화하고 `/cases`에 적용한다.

**Architecture:** `ssr-shell.js`가 회사 상세의 현재 스타일과 문서 조립을 소유한다. 회사 페이지는 본문만 셸에 전달하고, cases 목록·상세는 기존 조회/SEO 판정을 유지한 채 `.card` 본문과 메타/JSON-LD를 전달한다.

**Tech Stack:** Cloudflare Pages Functions, JavaScript ES modules, D1, Node built-in test runner.

## Global Constraints

- 회사 페이지 현재 색상·폰트·`.card`·`.c-head`·여백 값은 변경하지 않는다.
- `seo-cta.js`는 수정하지 않는다.
- cases의 0건 404, noindex/index 게이트, 필드 제한, 연령대, 내부링크를 유지한다.
- HTML escape, URL encode, JSON-LD `<` escape를 서로 섞지 않는다.
- `release.mjs --dry` 이후 실제 배포는 수행하지 않는다.

### Task 1: 셸 계약 테스트

**Files:**
- Create: `tests/ssr-shell.test.js`
- Test: `functions/_lib/ssr-shell.js`

- [ ] `renderPage`의 doctype, viewport, `c-head`, style, main, footer를 검증하는 테스트를 작성한다.
- [ ] robots가 `noindex,follow`이면 canonical이 없고, index이면 canonical이 있음을 검증한다.
- [ ] JSON-LD 배열이 각각 삽입되고 `</script>`가 `\\u003c/script>`로 방어됨을 검증한다.
- [ ] `node tests/ssr-shell.test.js`를 실행해 셸 미구현으로 RED를 확인한다.

### Task 2: 공용 셸 구현

**Files:**
- Create: `functions/_lib/ssr-shell.js`

- [ ] company 상세의 기존 style 블록을 값 변경 없이 `shellStyle()`로 이동한다.
- [ ] `renderPage`가 메타·조건부 canonical·JSON-LD·breadcrumb/header/main/body/footer를 조립하도록 구현한다.
- [ ] `node tests/ssr-shell.test.js`를 실행해 GREEN을 확인한다.

### Task 3: SSR 라우트 연결

**Files:**
- Modify: `functions/company/[slug].js`
- Modify: `functions/cases/index.js`
- Modify: `functions/cases/[disease].js`

- [ ] company는 기존 데이터/본문/JSON-LD/응답 헤더를 유지하면서 `renderPage`를 호출한다.
- [ ] cases 목록·상세는 `renderPage`를 호출하고 각 콘텐츠 섹션을 `.card`로 감싼다.
- [ ] disease 페이지는 indexable일 때만 canonical을 전달하고 기존 noindex/404 게이트를 유지한다.
- [ ] cases/company 회귀 테스트를 실행한다.

### Task 4: 릴리즈 검증 및 문서

**Files:**
- Modify: `CHANGELOG.md`

- [ ] 지정 테스트, 보안 스캔, `node scripts/release.mjs --dry`를 순서대로 실행한다.
- [ ] `CHANGELOG.md`에 v2.132.0 변경 요약을 작성한다.
- [ ] `git diff --check`와 작업 트리 상태를 확인하고 실제 배포는 하지 않는다.
