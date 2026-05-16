# 사이드바 레이아웃 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 히어로 영역 제거 + 사이드바에 전체 메뉴·커뮤니티 버튼·부가 기능 통합

**Architecture:** 순수 HTML/CSS/JS 단일 파일(`index.html`) 직접 수정. 프레임워크/빌드 도구 없음. CSS는 `<style>` 블록에, JS는 `<script>` 블록에, HTML은 `<body>` 안에 모두 집중되어 있다. 변경은 4단계(CSS 정리 → 사이드바 HTML 확장 → 커뮤니티/푸터 추가 → 다크테마 구현)로 진행한다.

**Tech Stack:** 바닐라 HTML/CSS/JS, Pretendard 폰트, localStorage (테마 저장)

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `index.html` | 유일한 변경 대상. CSS `<style>`, HTML `<body>`, JS `<script>` 모두 포함 |

---

## 사전 파악 사항

- **사이드바**: `<aside class="side-nav" id="side-nav">` (line ~3397) — 현재 메뉴 2개만 있음
- **사이드바 너비**: `--side-w: 240px` (line 918), `body { padding-left: var(--side-w) }` (line 919)
- **모바일 분기**: `@media (max-width: 900px)` — `body { padding-left: 0 }`, `.side-nav { transform: translateX(-100%) }`
- **페이지 전환**: `goToPage(page)` → `showPage(page)` 호출 → `.menu-tab[data-page=page]`에 `.active` 자동 적용
- **히어로 CSS는 HTML에 미사용**: `.hero`, `.comm-section`, `.contact-card` CSS가 존재하지만 HTML body에 대응하는 요소가 없음 — 삭제해도 안전
- **커뮤니티 링크**:
  - CREW 300: `https://open.kakao.com/o/gSN4EEoh`
  - MANAGER LINK: `https://open.kakao.com/o/gka8SGqi`
- **운영자 문의**: `https://open.kakao.com/o/sAZWQ7pi` (현재 메뉴에 있음 → 사이드 푸터로 이동)

---

## Task 1: 미사용 CSS 제거

**Files:**
- Modify: `index.html` — CSS `<style>` 블록 (lines 31~3386)

히어로 관련 CSS가 HTML에서 쓰이지 않아 안전하게 삭제 가능. 삭제 후 브라우저에서 페이지를 열어 레이아웃이 동일한지 확인.

- [ ] **Step 1: 삭제 대상 CSS 블록 확인**

아래 클래스 선택자 블록을 grep으로 정확한 line 범위 확인:
```bash
grep -n "\.hero\b\|\.comm-section\|\.contact-card\|\.comm-label-top\|\.hero-strip\|\.hero-badge\|\.hero-inner\|\.hero-main-row\|\.hero-divider\|\.hero-glow\|\.comm-card\b\|\.comm-card-" index.html | head -60
```

- [ ] **Step 2: 아래 CSS 블록 삭제**

`index.html`에서 다음 CSS 규칙들을 모두 삭제 (내용이 길어 범위 grep 후 Edit 도구 사용):
- `.hero { ... }` 및 `.hero::before { ... }`, `.hero-glow { ... }`, `.hero-inner { ... }`
- `.hero-badge { ... }`, `.pulse-dot { ... }`, `@keyframes blink { ... }`
- `.hero-main-row { ... }`, `.hero-divider { ... }`
- `.contact-card { ... }`, `.contact-card:hover { ... }`, `.contact-card-label { ... }`, `.contact-card-title { ... }`, `.contact-card-cta { ... }`
- `.comm-section { ... }`, `.comm-label-top { ... }`, `.comm-card { ... }`, `.comm-card:hover { ... }`, `.comm-card-inner { ... }`, `.comm-card-icon { ... }`, `.comm-card-icon img { ... }`, `.comm-card-body { ... }`, `.comm-card-name { ... }`, `.comm-card-sub { ... }`, `.comm-card-cta { ... }`, `.comm-card.kakao { ... }`, `.comm-card.gmconnect { ... }`, `.comm-card.managerlink { ... }`
- `.hero-strip { ... }`
- 모바일 미디어쿼리 안의 `.hero { padding-top: 64px; }` (line ~1244)

- [ ] **Step 3: 브라우저에서 확인**

`index.html`을 브라우저로 열어 레이아웃이 깨지지 않았는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "style: 미사용 히어로/커뮤니티카드 CSS 제거"
```

---

## Task 2: 사이드바에 전체 메뉴 탭 추가

**Files:**
- Modify: `index.html` — `<aside class="side-nav">` 블록 (line ~3397~3409)

현재 사이드바에 메뉴가 2개뿐(`홈`, `운영자 문의`). 모든 페이지 탭을 추가. `showPage()`가 `data-page` 속성으로 `.active` 자동 처리하므로 `data-page`만 정확히 지정하면 됨.

- [ ] **Step 1: 현재 사이드바 HTML 확인**

```bash
grep -n "side-nav\|menu-tab\|side-cur" index.html | grep "<"
```

- [ ] **Step 2: `<nav class="menu-tabs">` 블록 교체**

아래 내용으로 기존 `<nav class="menu-tabs">...</nav>` 전체를 교체:

```html
<nav class="menu-tabs">
  <button class="menu-tab active" data-page="home">🏠 홈</button>
  <button class="menu-tab" data-page="cardnews">🗞 카드뉴스</button>
  <button class="menu-tab" data-page="jeonsan">🖥 보험사 전산</button>
  <button class="menu-tab" data-page="payment">💳 수납 전산</button>
  <button class="menu-tab" data-page="newsletter">📄 소식지</button>
  <button class="menu-tab" data-page="claimform">📋 청구서류</button>
  <button class="menu-tab" data-page="recruit">💼 채용공고</button>
  <button class="menu-tab" data-page="knowledge">📚 보험지식</button>
  <button class="menu-tab" data-page="tools">🛠 실무도구</button>
  <button class="menu-tab" data-page="community-hub">👥 커뮤니티</button>
  <div class="side-cur-indicator" id="side-cur-indicator" style="display:none">
    <span class="sci-arrow">›</span>
    <span class="sci-label" id="sci-label"></span>
  </div>
</nav>
```

`data-page` 값이 `showPage()` 내 `PAGE_NAMES` 키와 일치해야 함:
- `home`, `cardnews`, `jeonsan`, `payment`, `newsletter`, `claimform`, `recruit`, `knowledge`, `tools`, `community-hub`

- [ ] **Step 3: 브라우저 확인**

`index.html` 열고:
1. 사이드바에 10개 메뉴 탭이 보이는지
2. 각 탭 클릭 시 해당 페이지로 이동하고 탭이 `.active` 강조되는지
3. 페이지 이동 후 다시 홈으로 돌아올 때 홈 탭이 강조되는지

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: 사이드바에 전체 메뉴 탭 추가"
```

---

## Task 3: 사이드바 커뮤니티 참여 버튼 추가

**Files:**
- Modify: `index.html` — `<aside class="side-nav">` 블록 + CSS `<style>` 블록

커뮤니티 버튼을 사이드바 메뉴 아래에 컴팩트한 링크 형태로 추가. GM커넥트는 제외.

- [ ] **Step 1: CSS 추가**

`<style>` 블록 안 `.side-nav-footer { ... }` 규칙 바로 아래에 추가:

```css
/* 사이드바 커뮤니티 참여 버튼 */
.side-comm-section {
  padding: 8px 12px;
  border-top: 1px solid rgba(12,31,184,0.07);
}
.side-comm-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--txt-lo);
  padding: 6px 4px 4px;
  display: block;
}
.side-comm-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border-radius: 9px;
  border: none;
  background: none;
  cursor: pointer;
  text-decoration: none;
  color: var(--txt-mid);
  font-family: 'Pretendard', sans-serif;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
  text-align: left;
}
.side-comm-btn:hover {
  background: rgba(26,61,232,0.07);
  color: var(--blue-mid);
}
.side-comm-btn .scb-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.side-comm-btn.kakao .scb-icon { background: #FEE500; }
.side-comm-btn.manager .scb-icon { background: rgba(124,58,237,0.10); }
.side-comm-btn .scb-text { flex: 1; line-height: 1.2; }
.side-comm-btn .scb-name { font-size: 12px; font-weight: 700; display: block; }
.side-comm-btn .scb-sub { font-size: 10px; color: var(--txt-lo); display: block; }
.side-comm-btn .scb-arrow {
  font-size: 12px;
  color: var(--txt-lo);
  flex-shrink: 0;
  transition: transform 0.15s;
}
.side-comm-btn:hover .scb-arrow { transform: translateX(2px); color: var(--blue-mid); }
```

- [ ] **Step 2: HTML 추가**

`</nav>` 닫는 태그 바로 뒤, `</aside>` 바로 앞에 삽입:

```html
<!-- 커뮤니티 참여 버튼 -->
<div class="side-comm-section">
  <span class="side-comm-label">커뮤니티 참여</span>
  <a class="side-comm-btn kakao"
     href="https://open.kakao.com/o/gSN4EEoh"
     target="_blank" rel="noopener noreferrer"
     onclick="trackClick('CREW300 오픈채팅 참여','sidebar')">
    <span class="scb-icon">💬</span>
    <span class="scb-text">
      <span class="scb-name">CREW 300</span>
      <span class="scb-sub">보험설계사 커뮤니티</span>
    </span>
    <span class="scb-arrow">›</span>
  </a>
  <a class="side-comm-btn manager"
     href="https://open.kakao.com/o/gka8SGqi"
     target="_blank" rel="noopener noreferrer"
     onclick="trackClick('MANAGERLINK 오픈채팅 참여','sidebar')">
    <span class="scb-icon">🔗</span>
    <span class="scb-text">
      <span class="scb-name">MANAGER LINK</span>
      <span class="scb-sub">설계매니저 커뮤니티</span>
    </span>
    <span class="scb-arrow">›</span>
  </a>
</div>
```

- [ ] **Step 3: 브라우저 확인**

1. 사이드바 메뉴 아래 커뮤니티 섹션이 보이는지
2. 각 버튼 클릭 시 새 탭에서 카카오 오픈채팅 링크가 열리는지
3. 호버 시 스타일 반응이 자연스러운지

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: 사이드바에 커뮤니티 참여 버튼 추가 (CREW300, MANAGERLINK)"
```

---

## Task 4: 사이드바 푸터 영역 추가 (피드백·공유·통계·테마)

**Files:**
- Modify: `index.html` — `<aside class="side-nav">` 블록 + CSS `<style>` 블록

커뮤니티 섹션 아래에 피드백 링크, 공유 버튼, 방문자 통계, 테마 토글을 추가.

- [ ] **Step 1: CSS 추가**

`<style>` 블록에 기존 `.side-comm-section` CSS 아래에 추가:

```css
/* 사이드바 푸터 */
.side-footer {
  padding: 10px 12px 16px;
  border-top: 1px solid rgba(12,31,184,0.07);
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
}
.side-footer-link {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  border-radius: 8px;
  font-family: 'Pretendard', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--txt-mid);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.side-footer-link:hover { background: rgba(26,61,232,0.06); color: var(--blue-mid); }
.side-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--txt-lo);
  font-family: 'Pretendard', sans-serif;
}
.side-stats-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--cyan);
  animation: blink 2.4s ease-in-out infinite;
  flex-shrink: 0;
}
.side-theme-toggle {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
}
.side-theme-btn {
  flex: 1;
  font-family: 'Pretendard', sans-serif;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 4px;
  border-radius: 6px;
  border: 1px solid rgba(12,31,184,0.12);
  background: none;
  color: var(--txt-lo);
  cursor: pointer;
  transition: all 0.15s;
}
.side-theme-btn.active {
  background: var(--blue-mid);
  color: #fff;
  border-color: var(--blue-mid);
}
.side-footer-copy {
  font-size: 10px;
  color: var(--txt-lo);
  padding: 4px 10px 0;
  font-family: 'Pretendard', sans-serif;
}
```

- [ ] **Step 2: HTML 추가**

커뮤니티 섹션(`</div>`) 바로 뒤, `</aside>` 바로 앞에 삽입:

```html
<!-- 사이드바 푸터 -->
<div class="side-footer">
  <a class="side-footer-link"
     href="https://open.kakao.com/o/sAZWQ7pi"
     target="_blank" rel="noopener noreferrer"
     onclick="trackClick('운영자 문의','sidebar-footer')">
    ✏️ 수정요청 / 제안하기
  </a>
  <button class="side-footer-link" onclick="shareApp()" type="button">
    📤 동료에게 공유하기
  </button>
  <div class="side-stats">
    <span class="side-stats-dot"></span>
    오늘 <strong id="side-stat-today" style="color:var(--txt-mid);margin:0 2px">—</strong>명
    &nbsp;·&nbsp;
    누적 <strong id="side-stat-total" style="color:var(--txt-mid);margin:0 2px">—</strong>명
  </div>
  <div class="side-theme-toggle" role="group" aria-label="테마 선택">
    <button class="side-theme-btn active" data-theme-val="light" onclick="setTheme('light')" type="button">라이트</button>
    <button class="side-theme-btn" data-theme-val="system" onclick="setTheme('system')" type="button">시스템</button>
    <button class="side-theme-btn" data-theme-val="dark" onclick="setTheme('dark')" type="button">다크</button>
  </div>
  <p class="side-footer-copy">InsureConnect — 보험으로 연결하다</p>
</div>
```

- [ ] **Step 3: JS에 `shareApp()` 함수 추가**

기존 `<script>` 블록 안에 추가 (다른 함수 정의 근처):

```js
function shareApp() {
  const url = 'https://insureconnect-hub.pages.dev/';
  const text = 'InsureConnect — 보험설계사를 위한 통합 포털';
  if (navigator.share) {
    navigator.share({ title: 'InsureConnect', text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('링크가 복사되었습니다!');
    }).catch(() => {
      prompt('아래 링크를 복사하세요:', url);
    });
  }
}
```

- [ ] **Step 4: 브라우저 확인**

1. 사이드바 하단에 피드백 링크, 공유 버튼, 통계 자리(— 표시), 테마 토글이 보이는지
2. "수정요청 / 제안하기" 클릭 시 카카오 오픈채팅 새 탭 열리는지
3. "동료에게 공유하기" 클릭 시 링크 공유 또는 복사 동작하는지

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: 사이드바 푸터 추가 (피드백·공유·통계·테마 토글)"
```

---

## Task 5: 테마 토글 JS + 다크모드 CSS 구현

**Files:**
- Modify: `index.html` — CSS `<style>` 블록 + JS `<script>` 블록

테마 토글 버튼이 실제로 동작하도록 JS와 기본 다크모드 CSS 변수 추가.

- [ ] **Step 1: CSS — 다크 테마 변수 추가**

`<style>` 블록 `:root { ... }` 바로 아래에 추가:

```css
[data-theme="dark"] {
  --bg:         #0d1117;
  --bg-card:    #161b22;
  --border:     rgba(255,255,255,0.08);
  --txt-hi:     #e6edf3;
  --txt-mid:    #8b949e;
  --txt-lo:     #484f58;
  --sh-sm:      0 2px 12px rgba(0,0,0,0.3);
  --sh-md:      0 8px 32px rgba(0,0,0,0.4);
}
[data-theme="dark"] .side-nav {
  background: #161b22;
  border-right-color: rgba(255,255,255,0.06);
}
[data-theme="dark"] .side-nav-header {
  background: linear-gradient(180deg, #161b22 0%, #0d1117 100%);
  border-bottom-color: rgba(255,255,255,0.06);
}
```

- [ ] **Step 2: JS — `setTheme()` 함수 추가**

`<script>` 블록 안 `shareApp()` 함수 바로 아래에 추가:

```js
function setTheme(val) {
  localStorage.setItem('ic-theme', val);
  applyTheme(val);
}

function applyTheme(val) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = val === 'dark' || (val === 'system' && prefersDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.querySelectorAll('.side-theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeVal === val);
  });
}

// 페이지 로드 시 저장된 테마 적용
(function() {
  const saved = localStorage.getItem('ic-theme') || 'light';
  applyTheme(saved);
})();
```

- [ ] **Step 3: 브라우저 확인**

1. 페이지 로드 시 기본 라이트 모드 적용되는지
2. "다크" 클릭 시 배경이 어두워지고 버튼에 active 강조가 붙는지
3. 페이지 새로고침 후에도 선택한 테마가 유지되는지 (localStorage)
4. "시스템" 클릭 시 OS 다크모드 설정을 따르는지

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: 테마 토글 기능 구현 (라이트/시스템/다크, localStorage 저장)"
```

---

## Task 6: 사이드바 스크롤 + 높이 보정 CSS 다듬기

**Files:**
- Modify: `index.html` — CSS `<style>` 블록

사이드바에 항목이 많아졌으므로 내부 스크롤 및 레이아웃 정렬 보정.

- [ ] **Step 1: `.side-nav` 및 `.menu-tabs` CSS 확인**

```bash
grep -n "\.side-nav\b\|\.menu-tabs\b" index.html | head -20
```

- [ ] **Step 2: `.menu-tabs` flexbox 보정**

기존 `.menu-tabs { flex: 1; }` 에 `overflow-y: auto;` 추가하여 메뉴가 넘칠 경우 스크롤 가능하게:

기존:
```css
.menu-tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 12px;
  flex: 1;
}
```

변경 후:
```css
.menu-tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 12px;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(12,31,184,0.15) transparent;
  min-height: 0;
}
```

- [ ] **Step 3: `.side-nav` flex 구조 확인**

`.side-nav`에 `display: flex; flex-direction: column;`이 있는지 확인. 없으면 추가하여 푸터가 항상 하단에 위치하게.

- [ ] **Step 4: 브라우저 확인 (다양한 높이)**

1. 브라우저 창을 작게 줄였을 때 메뉴 영역만 스크롤되고 커뮤니티 버튼·푸터는 고정되는지
2. 모바일 뷰(900px 이하)에서 사이드바 슬라이드인 후 스크롤이 잘 되는지

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "style: 사이드바 스크롤 및 레이아웃 보정"
```

---

## Task 7: 버전 업 + CHANGELOG + 빌드 & 배포

**Files:**
- Modify: `index.html` — 버전 문자열
- Modify or Create: `CHANGELOG.md`

- [ ] **Step 1: `index.html` 버전 문자열 업데이트**

```bash
grep -n "v0\.\|version\|VERSION" index.html | head -5
```

현재 버전 확인 후 패치 버전 1 올리기 (예: v0.5.8 → v0.5.9).

- [ ] **Step 2: CHANGELOG 업데이트**

`CHANGELOG.md` 상단에 항목 추가:
```markdown
## v0.5.9 — 2026-05-16
- 사이드바 전체 메뉴 탭 추가 (카드뉴스, 전산, 소식지 등 9개)
- 커뮤니티 참여 버튼 사이드바 이동 (CREW 300, MANAGER LINK)
- 피드백·공유·방문자통계·테마토글 사이드바 푸터 추가
- 다크모드 기본 지원 (라이트/시스템/다크)
- 미사용 히어로 CSS 정리
```

- [ ] **Step 3: 최종 커밋**

```bash
git add index.html CHANGELOG.md
git commit -m "v0.5.9: 사이드바 레이아웃 개편 — 전체 메뉴·커뮤니티·다크테마 통합"
```

- [ ] **Step 4: Cloudflare Pages 배포**

```bash
npx wrangler pages deploy . --project-name insureconnect-hub
```

배포 후 `https://insureconnect-hub.pages.dev/` 에서 동작 확인.
