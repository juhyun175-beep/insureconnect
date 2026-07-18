# 홈 대시보드 새로운 공고 통합 설계

## 목적

홈 대시보드의 채용·강의·모임 3개 공고 섹션을 `새로운 공고` 단일 섹션으로 통합한다. 카테고리 칩으로 전체·채용·강의·모임을 전환하고, 강의·모임이 비어 있을 때도 홈 화면이 비어 보이지 않도록 한다. `featured_listing` 상단노출 상품의 가치는 유지하기 위해 featured 우선 정렬과 카테고리 최소 노출 규칙을 적용한다.

## 범위와 불변 조건

- 수정 대상은 프론트엔드 `index.html`, 회귀 테스트, `CHANGELOG.md`다.
- `#home-featured`와 `loadHomeFeatured()`는 수정하지 않는다.
- `/api/recruitments`, `/api/lectures`, `/api/meetings` 서버 코드는 수정하지 않는다.
- 오픈채팅 대화순위, 홈 배너, 활동 피드 등 인접 영역은 수정하지 않는다.
- `loadHomeMeetups()` 별칭은 `mtpToggle()`의 직접 호출을 위해 유지한다.

## UI 구조

기존 `.ic-jobs-pair` 내부의 3개 섹션을 제거하고, 다음 요소를 포함한 단일 `section.ic-jobs`를 배치한다.

- `aria-label="새로운 공고"`
- 제목과 `NEW` pill
- `role="tablist"`인 카테고리 칩 4개(`all`, `recruit`, `lecture`, `meetup`)
- `id="home-posts-grid"`, `data-tour="jobs"`인 공고 그리드
- 초기 로딩용 skeleton 8개

기존 카드 스타일은 유지한다. 카드 썸네일에는 `kind` 기반 카테고리 배지를 좌상단에 추가하고, 채용·강의·모임에 각각 기존 HIRING·LIVE·MEET 색 계열을 사용한다. 기존 썸네일의 `NEW` 표시가 새 카테고리 배지와 겹치지 않도록 배지를 하단 좌측으로 이동한다. 공유 배지는 기존 하단 우측 위치를 유지한다.

칩 CSS는 기존 제목·pill 톤과 맞춰 999px 라운드, 12px대 글꼴, 파랑 계열 active 상태, 다크모드 변형으로 최소 구현한다.

## 데이터 흐름과 상태

홈 공고 스크립트 IIFE 안에 다음 상태를 둔다.

```text
homePostsCache: 정규화된 전체 공고 배열
homePostsLoaded: 최초 로딩 완료 여부
activeHomePostKind: 현재 칩(kind)
```

`loadHomePosts()`는 다음 세 요청을 `Promise.allSettled`로 병렬 실행한다.

- `/api/recruitments?limit=8`
- `/api/lectures?limit=8`
- `/api/meetings?limit=8`

성공한 배열만 `{ kind: 'recruit'|'lecture'|'meetup', ...원본 }`으로 정규화해 캐시한다. 일부 요청 실패 시 성공 카테고리만 렌더링하고, 세 요청이 모두 실패했을 때만 로드 실패 상태를 표시한다. 최초 로딩 이후 칩 전환과 `loadHomeMeetups()` 별칭 호출은 재fetch하지 않는다.

`loadHomeJobs()`, `loadHomeLectures()`, `loadHomeMeetups()`는 삭제하지 않고 `loadHomePosts()`를 호출하는 얇은 별칭으로 유지한다. DOMContentLoaded와 즉시 초기화 경로에서는 기존 3회 호출을 `loadHomePosts()` 1회로 교체한다.

## 정렬과 카테고리 인터리브

정규화된 배열은 다음 비교 순서를 사용한다.

1. `featured` 항목을 먼저 배치한다.
2. 같은 featured 그룹 또는 일반 그룹 안에서는 `created_at` 최신순으로 배치한다.
3. 날짜가 같으면 원래 배열 순서를 유지해 결과를 결정적으로 만든다.

전체 탭은 정렬 결과에서 최대 8개를 먼저 선택한다. 원본 데이터에 존재하지만 선택 결과에서 빠진 카테고리가 있으면, 해당 카테고리의 정렬상 최상위 항목을 선택 결과 뒤쪽의 일반 항목과 교체한다. featured 항목은 교체 대상에서 제외한다. 이 보정은 카테고리 독식을 막으면서 featured 우선순위를 보존한다.

개별 칩은 캐시된 배열에서 해당 `kind`만 필터한 뒤 동일한 정렬 결과의 최대 8개를 렌더한다. 활성 카테고리에 아이템이 없을 때만 `현재 등록된 공고가 없습니다.`를 표시한다.

## 카드 렌더링

kind별 기존 카드 동작을 하나의 렌더러로 합치되, 다음 기존 함수와 시그니처는 유지한다.

- `_homeCardThumb`
- `rc-featured`
- `_shareBadge`
- `_viewsMeta`
- `window.__openHomeJob`
- `window.__openHomeLecture`
- `window.__openHomeMeetup`
- `shareRecruit`, `shareLecture`, `shareMeetup`

kind별로 fallback emoji, 공유 함수, 열기 함수, 부가 정보(company/instructor 또는 host/location), 카테고리 색상만 매핑한다. 카드 클릭 및 공유 클릭의 기존 이벤트 전달 방식은 유지한다.

## 모바일 정리

`loadMobileHome()`에서 실제 마크업 대상이 없는 `m-home-jobs`·`m-home-lectures` fetch와 렌더링 블록을 제거한다. `loadMobileStats()`와 테마 초기화 등 나머지 동작은 유지한다. 제거 후 사용하지 않는 해당 로컬 escape helper도 함께 정리한다.

## 테스트 전략

1. `tests/seo-internal-links.test.js`의 회사 route 하니스에 `renderPage` mock을 주입한다. mock은 `bodyHtml`을 포함한 완성 HTML 문자열을 반환한다.
2. `tests/home-posts-merged.test.js`에서 다음을 검증한다.
   - 통합 그리드와 네 가지 칩 존재
   - 기존 세 그리드 marker 부재
   - `loadHomePosts()`와 세 API 경로 존재
   - `loadHomeMeetups()` 별칭 존재
   - 모바일 dead fetch marker 부재
   - 실제 정렬/카테고리 보정 helper를 격리된 VM에서 실행해 featured 우선, 최신순, 세 카테고리 최소 1개 규칙 검증
3. 다음 지정 테스트를 실행한다.
   - `node --test tests/home-posts-merged.test.js tests/seo-internal-links.test.js`
   - `node --test tests/ssr-shell.test.js tests/cases-ugc-loop.test.js tests/cardnews-mobile-viewer.test.js`
4. `CHANGELOG.md`에 `[2.133.0]` 변경사항을 추가한다.
5. `node scripts/release.mjs --dry`까지만 실행하고 실제 배포는 수행하지 않는다.

## 대안 검토

### A. 통합 로더와 캐시를 새로 구성 — 채택

세 API 요청·정규화·정렬·필터·렌더링의 책임이 명확하고 칩 전환 시 재요청을 막을 수 있다. 기존 별칭을 남겨 기존 호출자와의 호환성도 확보한다.

### B. 기존 세 로더를 유지하고 상위 조정자만 추가

기존 함수 변경량은 줄지만 데이터 캐시와 카드 렌더링이 분산되어 칩 필터와 인터리브 규칙을 일관되게 적용하기 어렵다.

### C. 통합 서버 API 추가

정렬과 인터리브를 서버에서 처리할 수 있지만, 이번 작업의 서버 코드 금지 조건을 위반하고 배포 범위를 불필요하게 넓힌다.
