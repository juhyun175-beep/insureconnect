# SSR 공용 셸 및 사례 페이지 디자인

## 목표

검증된 보험사 상세 SSR 페이지의 문서 구조와 스타일을 공용 셸로 추출해 `/cases` 목록·상세 페이지가 같은 레이아웃을 사용하도록 한다. 기존 SEO 게이트, 필드 노출, JSON-LD 종류, 캐시 정책은 유지한다.

## 구조

- `functions/_lib/ssr-shell.js`가 회사 상세 페이지에서 검증된 스타일 문자열을 `shellStyle()`로 제공한다.
- `renderPage({ title, description, robots, canonical, jsonLd, breadcrumb, bodyHtml, site })`가 doctype, head 메타, JSON-LD, 공통 breadcrumb/header/main/footer를 조립한다.
- `company/[slug].js`는 기존 데이터 조회·본문 조립을 유지하고 문서 외곽만 셸에 위임한다.
- `cases/index.js`와 `cases/[disease].js`는 본문을 `.card` 섹션으로 감싸 셸에 위임한다.

## 보안 및 호환성

- HTML 값은 각 페이지의 `esc()`를 사용한다.
- URL은 기존 URL 헬퍼와 encode 규칙을 사용한다.
- JSON-LD는 `JSON.stringify(value).replace(/</g, '\\\\u003c')` 규칙으로 셸에서 처리한다.
- `canonical`은 전달된 경우에만 출력한다. `noindex,follow` 응답에는 canonical을 전달하지 않는다.
- `seoCtaFooter(site)`는 변경하지 않고 셸의 body 끝에서 한 번만 호출한다.

## 검증

`tests/ssr-shell.test.js`가 셸의 완전 문서·viewport·header·style·canonical 게이트·다중 JSON-LD·스크립트 주입 방어를 검증한다. 기존 cases/company 테스트와 보안 스캔 및 `release.mjs --dry`를 함께 실행한다.
