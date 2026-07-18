# 홈 대시보드 새로운 공고 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 대시보드의 채용·강의·모임 공고를 캐시 기반 단일 섹션과 카테고리 칩으로 통합하고, 관련 회귀 테스트·모바일 dead fetch 제거·릴리스 기록을 완료한다.

**Architecture:** 기존 `index.html`의 홈 공고 IIFE 안에서 세 API 응답을 `kind`가 포함된 배열로 정규화하고, 순수 정렬/선택 helper가 전체·개별 탭 결과를 결정한다. 렌더러는 캐시 결과만 받아 기존 카드 열기·공유 함수와 카드 보조 helper를 계속 사용하며, 기존 로더 이름은 `loadHomePosts()`의 호환 별칭으로 남긴다.

**Tech Stack:** 정적 HTML/CSS/브라우저 JavaScript, Node.js built-in `node:test`, `vm`, PowerShell, Git.

## Global Constraints

- `#home-featured`와 `loadHomeFeatured()`는 수정하지 않는다.
- `/api/recruitments`, `/api/lectures`, `/api/meetings` 서버 코드는 수정하지 않는다.
- 오픈채팅 대화순위 패널, 홈 배너, 활동 피드는 수정하지 않는다.
- `loadHomeJobs`, `loadHomeLectures`, `loadHomeMeetups` 이름과 기존 열기·공유 함수 시그니처를 유지한다.
- 전체 탭은 최대 8장이고, 원본에 존재하는 각 카테고리를 가능한 한 최소 1장 포함한다. featured 항목은 교체 대상에서 제외한다.
- 모바일에서는 `loadMobileHome()`의 `m-home-jobs`·`m-home-lectures` fetch 블록을 제거하고 `loadMobileStats()` 등 나머지 로직은 유지한다.
- 실제 배포는 하지 않고 `node scripts/release.mjs --dry`까지만 실행한다.

---

### Task 1: SEO 회귀 테스트 하니스 수리

**Files:**
- Modify: `tests/seo-internal-links.test.js:177-198` 회사 route `loadRoute()` globals

**Interfaces:**
- Consumes: 기존 `companyRoute.onRequestGet()`와 테스트용 route globals
- Produces: `renderPage` mock이 포함된 회사 route 테스트

- [ ] **Step 1: 기존 실패를 재현한다**

Run:

```powershell
node --test tests/seo-internal-links.test.js
```

Expected: `ReferenceError: renderPage is not defined` at `functions/company/[slug].js`.

- [ ] **Step 2: 회사 route globals에 최소 문서 셸 mock을 추가한다**

`loadRoute(companyRel, { ... })`의 globals 객체에 다음 항목을 추가한다. 기존 mock과 호출 기록은 그대로 둔다.

```js
renderPage: ({ bodyHtml }) => '<!doctype html><html><body>' + bodyHtml + '</body></html>',
```

- [ ] **Step 3: SEO 회귀 테스트를 통과시킨다**

Run:

```powershell
node --test tests/seo-internal-links.test.js
```

Expected: `1 pass`, `0 fail`.

- [ ] **Step 4: 변경을 커밋한다**

```powershell
git add tests/seo-internal-links.test.js
git commit -m "test: mock shared SSR shell in SEO route harness"
```

### Task 2: 통합 공고 회귀 테스트 작성

**Files:**
- Create: `tests/home-posts-merged.test.js`
- Test source: `index.html`

**Interfaces:**
- Consumes: `HOME_POST_SELECTION_START`/`HOME_POST_SELECTION_END` 사이의 순수 helper 블록
- Produces: 실제 `index.html` 구조·로더·모바일 소스와 선택 규칙을 검증하는 Node test

- [ ] **Step 1: 실패하는 구조 테스트를 작성한다**

Create `tests/home-posts-merged.test.js` with this complete initial structure test:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const marker of [
  'id="home-posts-grid"',
  'data-kind="all"',
  'data-kind="recruit"',
  'data-kind="lecture"',
  'data-kind="meetup"',
  'async function loadHomePosts()',
  '/api/recruitments?limit=8',
  '/api/lectures?limit=8',
  '/api/meetings?limit=8',
  'async function loadHomeMeetups()',
]) {
  assert(indexHtml.includes(marker), `home posts source should include: ${marker}`);
}

for (const marker of [
  'id="home-jobs-grid"',
  'id="home-lectures-grid"',
  'id="home-meetups-grid"',
]) {
  assert(!indexHtml.includes(marker), `legacy home grid should be removed: ${marker}`);
}

const mobileStart = indexHtml.indexOf('async function loadMobileHome()');
const mobileEnd = indexHtml.indexOf('\n    if (document.readyState', mobileStart);
assert(mobileStart >= 0 && mobileEnd > mobileStart, 'loadMobileHome source should be extractable');
const mobileSource = indexHtml.slice(mobileStart, mobileEnd);
assert(!mobileSource.includes('m-home-jobs'), 'mobile home should not fetch the removed jobs target');
assert(!mobileSource.includes('m-home-lectures'), 'mobile home should not fetch the removed lectures target');

const helperStartMarker = '/* HOME_POST_SELECTION_START */';
const helperEndMarker = '/* HOME_POST_SELECTION_END */';
const helperStart = indexHtml.indexOf(helperStartMarker);
const helperEnd = indexHtml.indexOf(helperEndMarker, helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'home post selection helper markers should exist');
const helperSource = indexHtml.slice(helperStart + helperStartMarker.length, helperEnd);
const sandbox = { Date, Number, Array, Object, Set, String };
vm.createContext(sandbox);
vm.runInContext(`${helperSource}\nthis.__selectHomePosts = _selectHomePosts;`, sandbox, {
  filename: 'index.html#home-post-selection',
});

const fixture = [
  { kind: 'recruit', id: 1, featured: 1, created_at: '2026-07-10T00:00:00Z' },
  { kind: 'recruit', id: 2, created_at: '2026-07-09T00:00:00Z' },
  { kind: 'recruit', id: 3, created_at: '2026-07-08T00:00:00Z' },
  { kind: 'recruit', id: 4, created_at: '2026-07-07T00:00:00Z' },
  { kind: 'recruit', id: 5, created_at: '2026-07-06T00:00:00Z' },
  { kind: 'recruit', id: 6, created_at: '2026-07-05T00:00:00Z' },
  { kind: 'recruit', id: 7, created_at: '2026-07-04T00:00:00Z' },
  { kind: 'lecture', id: 8, created_at: '2026-07-03T00:00:00Z' },
  { kind: 'meetup', id: 9, created_at: '2026-07-02T00:00:00Z' },
];
const all = sandbox.__selectHomePosts(fixture, 'all');
assert.strictEqual(all.length, 8, 'all tab should render at most eight cards');
assert.strictEqual(all[0].id, 1, 'featured card should sort before newer non-featured cards');
assert(all.some((item) => item.kind === 'recruit'), 'all tab should contain recruit');
assert(all.some((item) => item.kind === 'lecture'), 'all tab should contain lecture');
assert(all.some((item) => item.kind === 'meetup'), 'all tab should contain meetup');
assert.strictEqual(sandbox.__selectHomePosts(fixture, 'lecture').length, 1, 'kind filter should use the cache');

console.log('home posts merged tests passed');
```

- [ ] **Step 2: 새 테스트가 통합 marker 누락으로 실패하는지 확인한다**

Run:

```powershell
node --test tests/home-posts-merged.test.js
```

Expected: FAIL because the merged grid, loader, and helper markers do not yet exist.

- [ ] **Step 3: 테스트 파일의 문법을 먼저 확인한다**

Run:

```powershell
node --check tests/home-posts-merged.test.js
```

Expected: no output and exit code `0`.

### Task 3: 새로운 공고 마크업과 최소 CSS 추가

**Files:**
- Modify: `index.html:6103-6118` chip CSS insertion point
- Modify: `index.html:9606-9655` old three-section home markup

**Interfaces:**
- Consumes: existing `.ic-jobs`, `.ic-jobs-grid`, skeleton, card, theme variables
- Produces: `#home-posts-grid` and four `.ic-posts-chip` buttons consumed by `loadHomePosts()`

- [ ] **Step 1: 기존 3개 섹션과 wrapper를 단일 섹션으로 교체한다**

Replace the `.ic-jobs-pair` block with this exact structure:

```html
<!-- ══ 새로운 공고 (채용·강의·모임 통합) ══ -->
<section class="ic-jobs" aria-label="새로운 공고">
  <div class="ic-jobs-head">
    <div class="ic-jobs-title">
      새로운 공고
      <span class="ic-jobs-pill">NEW</span>
    </div>
    <div class="ic-posts-chips" role="tablist" aria-label="공고 카테고리">
      <button type="button" class="ic-posts-chip active" data-kind="all">전체</button>
      <button type="button" class="ic-posts-chip" data-kind="recruit">채용</button>
      <button type="button" class="ic-posts-chip" data-kind="lecture">강의</button>
      <button type="button" class="ic-posts-chip" data-kind="meetup">모임</button>
    </div>
  </div>
  <div class="ic-jobs-grid" id="home-posts-grid" data-tour="jobs">
    <div class="ic-jobs-skel"></div><div class="ic-jobs-skel"></div>
    <div class="ic-jobs-skel"></div><div class="ic-jobs-skel"></div>
    <div class="ic-jobs-skel"></div><div class="ic-jobs-skel"></div>
    <div class="ic-jobs-skel"></div><div class="ic-jobs-skel"></div>
  </div>
</section>
```

- [ ] **Step 2: chip and category badge CSS를 추가한다**

Insert the following near `.ic-jobs-pill` and keep the addition within 20 lines:

```css
    .ic-posts-chips { display:flex; gap:6px; margin-left:auto; }
    .ic-posts-chip { border:1px solid var(--border); border-radius:999px; padding:5px 11px; background:var(--bg-card); color:var(--txt-mid); font:700 12px/1.2 inherit; cursor:pointer; }
    .ic-posts-chip:hover { border-color:var(--blue-mid); color:var(--blue-mid); }
    .ic-posts-chip.active { border-color:transparent; color:#fff; background:linear-gradient(135deg,#1a3de8,#4f46e5); box-shadow:0 3px 10px rgba(26,61,232,.22); }
    [data-theme="dark"] .ic-posts-chip { background:rgba(255,255,255,.06); color:var(--txt-mid); }
    [data-theme="dark"] .ic-posts-chip.active { color:#fff; background:linear-gradient(135deg,#3557f4,#6366f1); }
    .ic-home-category-badge { position:absolute; top:8px; left:8px; z-index:3; padding:3px 8px; border-radius:999px; color:#fff; font-size:9.5px; font-weight:800; box-shadow:0 2px 6px rgba(0,0,0,.2); }
    .ic-home-category-badge--recruit { background:linear-gradient(135deg,#1a3de8,#4f46e5); }
    .ic-home-category-badge--lecture { background:linear-gradient(135deg,#10b981,#059669); }
    .ic-home-category-badge--meetup { background:linear-gradient(135deg,#0d9488,#0ea5e9); }
    @media (max-width:480px) { .ic-jobs-head { align-items:flex-start; flex-wrap:wrap; } .ic-posts-chips { width:100%; margin-left:0; overflow:auto; } }
```

- [ ] **Step 3: structure-only test를 다시 실행한다**

Run:

```powershell
node --test tests/home-posts-merged.test.js
```

Expected: the test progresses past the markup assertions and fails at missing selection helper markers or loader assertions.

### Task 4: 정렬·인터리브 helper와 통합 로더 구현

**Files:**
- Modify: `index.html` home showcase IIFE around `_homeCardThumb`, `loadHomeJobs`, `loadHomeLectures`, and `loadHomeMeetups`

**Interfaces:**
- Consumes: `#home-posts-grid`, `.ic-posts-chip`, `_ensureShareCounts`, `_homeCardThumb`, `_shareBadge`, `_viewsMeta`, existing open/share functions
- Produces: `_selectHomePosts(items, kind)`, `loadHomePosts()`, and three compatibility aliases

- [ ] **Step 1: 순수 selection helper를 marker 사이에 추가한다**

Add this self-contained block before the card rendering functions:

```js
    /* HOME_POST_SELECTION_START */
    const HOME_POST_KINDS = ['recruit', 'lecture', 'meetup'];
    function _homePostIsFeatured(item) {
      return item && (item.featured === true || Number(item.featured) === 1);
    }
    function _homePostCreatedAt(item) {
      const timestamp = Date.parse(item && item.created_at ? item.created_at : '');
      return Number.isFinite(timestamp) ? timestamp : 0;
    }
    function _homePostSort(items) {
      return items.map((item, index) => ({ item, index })).sort((a, b) => {
        const featuredOrder = Number(_homePostIsFeatured(b.item)) - Number(_homePostIsFeatured(a.item));
        return featuredOrder || (_homePostCreatedAt(b.item) - _homePostCreatedAt(a.item)) || (a.index - b.index);
      }).map(({ item }) => item);
    }
    function _selectHomePosts(items, kind) {
      const sorted = _homePostSort(Array.isArray(items) ? items : []);
      if (kind && kind !== 'all') return sorted.filter((item) => item.kind === kind).slice(0, 8);
      const selected = sorted.slice(0, 8);
      const availableKinds = HOME_POST_KINDS.filter((candidate) => sorted.some((item) => item.kind === candidate));
      const selectedKinds = new Set(selected.map((item) => item.kind));
      const missingKinds = availableKinds.filter((candidate) => !selectedKinds.has(candidate));
      const usedIndexes = new Set();
      for (const missingKind of missingKinds) {
        const replacement = sorted.find((item) => item.kind === missingKind);
        const replacementIndex = selected.map((item, index) => ({ item, index })).reverse().find(({ item, index }) => {
          if (usedIndexes.has(index) || _homePostIsFeatured(item)) return false;
          return selected.filter((selectedItem) => selectedItem.kind === item.kind).length > 1;
        });
        if (!replacement || !replacementIndex) continue;
        usedIndexes.add(replacementIndex.index);
        selected[replacementIndex.index] = replacement;
      }
      return selected;
    }
    /* HOME_POST_SELECTION_END */
```

- [ ] **Step 2: 카드 썸네일에 kind 기반 카테고리 배지를 추가한다**

Keep `_homeCardThumb(it, fallback, label, featured)` signature unchanged and add this helper before it:

```js
    function _homeCategoryBadge(kind) {
      const labels = { recruit: '채용', lecture: '강의', meetup: '모임' };
      return labels[kind] ? `<span class="ic-home-category-badge ic-home-category-badge--${kind}">${labels[kind]}</span>` : '';
    }
```

Inside `_homeCardThumb`, derive `const kind = it.kind || it._homeType;`, render `_homeCategoryBadge(kind)` after the thumbnail, and change the `NEW` badge string to avoid the new top-left label:

```js
const newBadge = isNew(it.created_at) ? '<span class="ic-job-new" style="top:auto;bottom:8px;left:8px;">NEW</span>' : '';
return `${thumb}${_homeCategoryBadge(kind)}${newBadge}${featured ? _homeFeaturedBadge() : ''}${_homeTypeBadge(label, featured)}`;
```

- [ ] **Step 3: kind별 카드 렌더러를 추가한다**

Add one renderer that preserves the existing card and event signatures:

```js
    function _homePostCard(item) {
      const meta = item.kind === 'lecture'
        ? { open: '__openHomeLecture', share: 'shareLecture', fallback: '🎓', label: '강의', sub: item.instructor }
        : item.kind === 'meetup'
        ? { open: '__openHomeMeetup', share: 'shareMeetup', fallback: '🤝', label: '모임', sub: [item.host, item.location].filter(Boolean).join(' · ') }
        : { open: '__openHomeJob', share: 'shareRecruit', fallback: '📝', label: '채용', sub: item.company_name };
      const typeLabel = item.file_url && item.file_type === 'image' ? '🖼 이미지' : (item.file_url && item.file_type === 'pdf' ? '📄 PDF' : `📝 ${meta.label}`);
      const participantMeta = item.kind === 'meetup' && item.participant_count ? ` · <span style="color:#0d9488;font-weight:700;">👥 ${item.participant_count}명</span>` : '';
      return `<button class="ic-job-card${item.featured ? ' rc-featured' : ''}" type="button" onclick="window.${meta.open}(${item.id})">
        <span class="ic-job-copy" role="button" tabindex="0" title="링크 복사" onclick="${meta.share}(${item.id}, event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5"/></svg>
        </span>
        <div class="ic-job-thumb">${_homeCardThumb(item, meta.fallback, typeLabel, !!item.featured)}${_shareBadge(item.kind, item.id)}</div>
        <div class="ic-job-body">
          ${meta.sub ? `<div class="ic-job-company">${esc(meta.sub)}</div>` : ''}
          <div class="ic-job-title">${esc(item.title)}</div>
          <div class="ic-job-date">${fmtDate(item.created_at)} ${_viewsMeta(item.views)}${participantMeta}</div>
        </div>
      </button>`;
    }
```

- [ ] **Step 4: cache, fetch, render, and chip handlers를 추가한다**

Place these variables and functions in the same IIFE near the old loaders:

```js
    let homePostsCache = [];
    let homePostsLoaded = false;
    let homePostsAllFailed = false;
    let activeHomePostKind = 'all';
    let homePostsRenderVersion = 0;

    async function _fetchHomePosts(kind, url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`home ${kind} fetch failed`);
      const items = await response.json();
      return (Array.isArray(items) ? items : []).map((item) => ({ kind, ...item }));
    }

    async function _renderHomePosts(kind) {
      const grid = document.getElementById('home-posts-grid');
      if (!grid) return;
      activeHomePostKind = kind || 'all';
      const renderVersion = ++homePostsRenderVersion;
      if (homePostsAllFailed) {
        grid.innerHTML = '<div class="ic-jobs-empty" style="grid-column:1/-1;">공고를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
        return;
      }
      const items = _selectHomePosts(homePostsCache, activeHomePostKind);
      if (!items.length) {
        grid.innerHTML = '<div class="ic-jobs-empty" style="grid-column:1/-1;">현재 등록된 공고가 없습니다.</div>';
        return;
      }
      await _ensureShareCounts();
      if (renderVersion !== homePostsRenderVersion) return;
      grid.innerHTML = items.map(_homePostCard).join('');
    }

    function _bindHomePostChips() {
      document.querySelectorAll('.ic-posts-chip').forEach((chip) => {
        if (chip.dataset.bound === '1') return;
        chip.dataset.bound = '1';
        chip.addEventListener('click', () => {
          document.querySelectorAll('.ic-posts-chip').forEach((candidate) => candidate.classList.toggle('active', candidate === chip));
          _renderHomePosts(chip.dataset.kind);
        });
      });
    }

    async function loadHomePosts() {
      const grid = document.getElementById('home-posts-grid');
      if (!grid) return;
      _bindHomePostChips();
      if (!homePostsLoaded) {
        const results = await Promise.allSettled([
          _fetchHomePosts('recruit', '/api/recruitments?limit=8'),
          _fetchHomePosts('lecture', '/api/lectures?limit=8'),
          _fetchHomePosts('meetup', '/api/meetings?limit=8'),
        ]);
        const successful = results.filter((result) => result.status === 'fulfilled');
        homePostsCache = successful.flatMap((result) => result.value);
        homePostsAllFailed = successful.length === 0;
        homePostsLoaded = true;
      }
      await _renderHomePosts(activeHomePostKind);
    }

    async function loadHomeJobs() { return loadHomePosts(); }
    async function loadHomeLectures() { return loadHomePosts(); }
    async function loadHomeMeetups() { return loadHomePosts(); }
```

- [ ] **Step 5: 기존 3개 로더의 렌더링 본문을 제거한다**

Delete the old fetch/card-rendering bodies for `loadHomeJobs`, `loadHomeLectures`, and `loadHomeMeetups`, while retaining the three aliases from Step 4 and all existing `window.__openHomeJob`, `window.__openHomeLecture`, and `window.__openHomeMeetup` functions.

- [ ] **Step 6: 초기화 호출을 단일 로더로 교체한다**

Change both initialization branches to call `loadHomePosts()` once:

```js
document.addEventListener('DOMContentLoaded', () => { loadHomeFeatured(); loadHomePosts(); loadKakaoRank(); loadHomeNotice(); loadMobileHome(); });
```

and:

```js
loadHomeFeatured();
loadHomePosts();
loadKakaoRank();
loadHomeNotice();
loadMobileHome();
```

- [ ] **Step 7: merged test를 실행한다**

Run:

```powershell
node --test tests/home-posts-merged.test.js
```

Expected: `1 pass`, `0 fail`, including the VM selection assertions.

- [ ] **Step 8: 통합 로더 변경을 커밋한다**

```powershell
git add index.html tests/home-posts-merged.test.js
git commit -m "feat: merge home posts into categorized dashboard"
```

### Task 5: 모바일 dead fetch 제거와 릴리스 문서화

**Files:**
- Modify: `index.html:17977-18033` `loadMobileHome()`
- Modify: `CHANGELOG.md:3` add `[2.133.0]`

**Interfaces:**
- Consumes: existing `loadMobileStats()` and `_mApplyThemeActive()` behavior
- Produces: mobile home without nonexistent jobs/lectures fetches and a versioned changelog entry

- [ ] **Step 1: `loadMobileHome()`의 dead blocks를 제거한다**

Keep the function beginning and the remaining initialization:

```js
async function loadMobileHome() {
  if (!document.body.classList.contains('ic-mobile')) return;
  loadMobileStats();
  _mApplyThemeActive();
  // v2.1.26: 모바일 파트너 프로모션 배너 기능 제거 (사이드바 배너 시스템 폐지)
}
```

Remove both `fetch('/api/recruitments?limit=3')` and `fetch('/api/lectures?limit=3')` blocks and their now-unused `escH` helper.

- [ ] **Step 2: 모바일 소스 회귀 테스트를 통과시킨다**

Run:

```powershell
node --test tests/home-posts-merged.test.js
```

Expected: `m-home-jobs` and `m-home-lectures` assertions pass.

- [ ] **Step 3: CHANGELOG에 2.133.0을 추가한다**

Insert immediately below `# Changelog`:

```markdown
## [2.133.0] - 2026-07-18
### Changed (홈 새로운 공고 통합)
- `index.html`: 채용·강의·모임 홈 섹션을 `새로운 공고` 단일 섹션과 카테고리 칩으로 통합.
- `index.html`: featured 우선·최신순 정렬과 카테고리 인터리브 규칙으로 상단노출 가치를 보호하고, 기존 3개 로더 별칭을 호환성 목적으로 유지.
- `index.html`: 실제 모바일 대상이 없는 채용·강의 dead fetch 2건을 제거.
```

- [ ] **Step 4: 문서 변경을 커밋한다**

```powershell
git add index.html CHANGELOG.md
git commit -m "chore: document v2.133.0 home posts merge"
```

### Task 6: 전체 지정 검증과 dry release 확인

**Files:**
- Test: `tests/home-posts-merged.test.js`
- Test: `tests/seo-internal-links.test.js`
- Test: `tests/ssr-shell.test.js`
- Test: `tests/cases-ugc-loop.test.js`
- Test: `tests/cardnews-mobile-viewer.test.js`

**Interfaces:**
- Consumes: all code and tests from Tasks 1–5
- Produces: verified working tree and dry-run release output; no real deployment

- [ ] **Step 1: 통합 테스트를 실행한다**

```powershell
node --test tests/home-posts-merged.test.js tests/seo-internal-links.test.js
```

Expected: both tests pass.

- [ ] **Step 2: 지정 무회귀 테스트를 실행한다**

```powershell
node --test tests/ssr-shell.test.js tests/cases-ugc-loop.test.js tests/cardnews-mobile-viewer.test.js
```

Expected: all three tests pass. Known pre-v2.130 unrelated failures are not part of this command or scope.

- [ ] **Step 3: 변경 diff와 공백 오류를 확인한다**

```powershell
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: no whitespace errors; only intended commits are present; no untracked implementation files remain.

- [ ] **Step 4: release dry run만 실행한다**

```powershell
node scripts/release.mjs --dry
```

Expected: dry-run output completes successfully. Stop after this command; do not publish or deploy.
