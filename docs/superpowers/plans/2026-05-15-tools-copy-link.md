# 실무도구 링크복사 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실무도구 페이지의 11개 카드 각각에 딥링크 복사 버튼을 추가하고, `#tools/{tool-id}` 해시로 접근 시 해당 도구로 자동 진입한다.

**Architecture:** `index.html` 단일 파일만 수정한다. CSS 블록에 복사 버튼 스타일과 하이라이트 애니메이션을 추가하고, HTML의 11개 카드에 `data-tool-id`와 복사 버튼을 삽입하며, 기존 인라인 스크립트 하단에 3개 함수(`copyToolLink`, `highlightToolCard`, `initHashRouting`)를 추가한다.

**Tech Stack:** Vanilla HTML/CSS/JS, Clipboard API (`navigator.clipboard.writeText`)

---

## 파일 변경 범위

- **Modify:** `index.html`
  - CSS (약 line 2235 이후 `.tool-card.coming-soon` 블록 뒤): 복사 버튼 CSS + 하이라이트 CSS 추가
  - HTML (line 4041~4128): 11개 카드에 `data-tool-id` 속성 + `<button class="tool-card-copy">` 삽입
  - JS (line 6975 `</script>` 직전, 마지막 스크립트 블록 내부): 3개 함수 + `initHashRouting()` 호출 추가

---

## Task 1: CSS — 복사 버튼 + 하이라이트 스타일 추가

**Files:**
- Modify: `index.html` (CSS 섹션, line ~2234 `.tool-card.coming-soon .tool-card-icon` 블록 직후)

- [ ] **Step 1: 복사 버튼 CSS와 하이라이트 CSS를 삽입한다**

`index.html`에서 아래 문자열을 찾는다:
```css
    .tool-card.coming-soon .tool-card-icon {
      background: #eef0f6;
      filter: grayscale(0.3);
    }
```

그 직후에 다음 CSS 블록을 삽입한다:

```css
    /* ── 링크복사 버튼 ── */
    .tool-card-copy {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--txt-mid);
      border-radius: 6px;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.2s, color 0.2s, background 0.2s;
      padding: 0;
    }
    .tool-card:hover .tool-card-copy {
      opacity: 1;
    }
    @media (hover: none), (pointer: coarse) {
      .tool-card-copy { opacity: 1; }
    }
    .tool-card-copy:hover {
      color: var(--blue-light);
      background: rgba(26,61,232,0.07);
    }
    .tool-card-copy.copied {
      color: #059669;
      opacity: 1;
    }
    /* ── 딥링크 하이라이트 ── */
    @keyframes toolHighlight {
      0%   { box-shadow: var(--sh-sm); border-color: rgba(26,61,232,0.12); }
      30%  { box-shadow: 0 0 0 3px rgba(26,61,232,0.3); border-color: rgba(26,61,232,0.6); }
      100% { box-shadow: var(--sh-sm); border-color: rgba(26,61,232,0.12); }
    }
    .tool-card-highlight {
      animation: toolHighlight 2s ease-out forwards;
    }
```

- [ ] **Step 2: 브라우저에서 index.html을 열어 실무도구 페이지로 이동한다**

빌드 불필요. 브라우저에서 파일을 직접 열거나 로컬 서버를 사용한다.
DevTools → Elements에서 `.tool-card-copy` 규칙이 존재하는지 확인한다.

- [ ] **Step 3: 커밋한다**

```bash
git add index.html
git commit -m "style: add tool-card-copy and toolHighlight CSS"
```

---

## Task 2: HTML — 11개 카드에 data-tool-id + 복사 버튼 삽입

**Files:**
- Modify: `index.html` (line 4041~4128)

복사 버튼 공통 마크업 (아이콘은 클립보드 SVG):

```html
<button class="tool-card-copy" onclick="copyToolLink(event,'TOOL_ID')" aria-label="링크 복사" title="링크 복사">
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
</button>
```

각 카드의 `.tool-card-arrow` 바로 앞에 위 버튼을 삽입하고, 카드 엘리먼트에 `data-tool-id` 속성을 추가한다.

- [ ] **Step 4: 외부링크 카드 7개 수정 (할인할증 ~ 실손보험)**

아래 각각의 `old` → `new` 패턴으로 수정한다 (Edit 도구 사용).

**할인 할증요인 조회** (`kidi-discount`):
```html
<!-- old -->
<a class="tool-card" href="https://prem.kidi.or.kr:1443/" target="_blank" rel="noopener noreferrer" onclick="trackCardClick('실무도구','할인 할증요인 조회')">
<!-- new -->
<a class="tool-card" data-tool-id="kidi-discount" href="https://prem.kidi.or.kr:1443/" target="_blank" rel="noopener noreferrer" onclick="trackCardClick('실무도구','할인 할증요인 조회')">
```
그리고 해당 카드 안의 `<div class="tool-card-arrow">→</div>` 바로 앞에 복사 버튼 삽입 (TOOL_ID = `kidi-discount`).

**보험개발원 등록포털** (`kidi-portal`):
`<a class="tool-card" href="https://iics.kidi.or.kr/...` → `data-tool-id="kidi-portal"` 추가, 복사 버튼 삽입.

**과실비율 정보포털** (`fault-ratio`):
`<a class="tool-card" href="https://accident.knia.or.kr/...` → `data-tool-id="fault-ratio"` 추가, 복사 버튼 삽입.

**카드할부 안내** (`card-installment`):
`<a class="tool-card" href="https://www.bss-a.co.kr/...` → `data-tool-id="card-installment"` 추가, 복사 버튼 삽입.

**건축물 대장 조회** (`building-ledger`):
`<a class="tool-card" href="https://www.gov.kr/...` → `data-tool-id="building-ledger"` 추가, 복사 버튼 삽입.

**승강기 정보 열람** (`elevator`):
`<a class="tool-card" href="https://www.elevator.go.kr/...` → `data-tool-id="elevator"` 추가, 복사 버튼 삽입.

**실손보험 인수기준 확인** (`silson-underwrite`):
`<a class="tool-card" href="https://kpub.knia.or.kr/...` → `data-tool-id="silson-underwrite"` 추가, 복사 버튼 삽입.

- [ ] **Step 5: 모달 카드 3개 수정**

**실비 계산기** (`shilbi`):
```html
<!-- old -->
<div class="tool-card" onclick="trackCardClick('실무도구','실비 계산기'); openShilbi();" style="cursor:pointer;">
<!-- new -->
<div class="tool-card" data-tool-id="shilbi" onclick="trackCardClick('실무도구','실비 계산기'); openShilbi();" style="cursor:pointer;">
```
복사 버튼 삽입 (TOOL_ID = `shilbi`).

**수술명 검색** (`surgery`):
`<div class="tool-card" onclick="trackCardClick('실무도구','수술명 검색'); openSurg();"...` → `data-tool-id="surgery"` 추가, 복사 버튼 삽입.

**카드납 가이드** (`cardpay`):
`<div class="tool-card" onclick="trackCardClick('실무도구','카드납 가이드'); openCardGuide();"...` → `data-tool-id="cardpay"` 추가, 복사 버튼 삽입.

- [ ] **Step 6: 외부링크형 나머지 1개 수정**

**KCD 질병코드 조회** (`kcd`):
`<a class="tool-card" href="http://www.koicd.kr/...` → `data-tool-id="kcd"` 추가, 복사 버튼 삽입.

- [ ] **Step 7: 브라우저에서 실무도구 페이지를 열어 카드를 호버한다**

각 카드 호버 시 복사 아이콘 버튼이 나타나는지 확인. DevTools Elements에서 `data-tool-id` 속성이 11개 카드 모두에 있는지 확인.

- [ ] **Step 8: 커밋한다**

```bash
git add index.html
git commit -m "feat: add data-tool-id and copy button to 11 tool cards"
```

---

## Task 3: JS — copyToolLink / highlightToolCard / initHashRouting 추가

**Files:**
- Modify: `index.html` (마지막 `<script>` 블록, `</script>` 태그 직전 = line ~6974)

- [ ] **Step 9: 마지막 스크립트 블록(`</script>` 직전)에 다음 코드를 삽입한다**

찾을 문자열:
```js
  })();
  </script>

  <button id="page-nav-btn"
```

삽입할 코드 (위 문자열의 `  </script>` 바로 앞에 추가):

```js

    /* ══════════════════════════════
       실무도구 링크복사 + 해시 라우팅
    ══════════════════════════════ */
    const TOOL_MODAL_MAP = {
      shilbi:  () => window.openShilbi && window.openShilbi(),
      surgery: () => window.openSurg   && window.openSurg(),
      cardpay: () => window.openCardGuide && window.openCardGuide(),
    };

    function copyToolLink(event, toolId) {
      event.preventDefault();
      event.stopPropagation();
      const url = location.origin + '/#tools/' + toolId;
      const btn = event.currentTarget;
      navigator.clipboard.writeText(url).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        }, 1500);
      }).catch(() => {
        console.warn('[copyToolLink] clipboard write failed');
      });
    }

    function highlightToolCard(toolId) {
      const el = document.querySelector('[data-tool-id="' + toolId + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('tool-card-highlight');
      setTimeout(() => el.classList.remove('tool-card-highlight'), 2000);
    }

    function initHashRouting() {
      const hash = location.hash; // e.g. "#tools/shilbi"
      if (!hash.startsWith('#tools')) return;
      const parts  = hash.slice(1).split('/'); // ["tools", "shilbi"] or ["tools"]
      const page   = parts[0]; // "tools"
      const toolId = parts[1]; // "shilbi" | undefined
      if (page !== 'tools') return;
      goToPage('tools');
      if (!toolId) return;
      if (TOOL_MODAL_MAP[toolId]) {
        setTimeout(TOOL_MODAL_MAP[toolId], 100);
      } else {
        setTimeout(() => highlightToolCard(toolId), 100);
      }
    }

    initHashRouting();
```

- [ ] **Step 10: 브라우저에서 복사 버튼 동작을 확인한다**

1. 실무도구 페이지에서 "실비 계산기" 카드를 호버한다
2. 복사 버튼 클릭 → 체크 아이콘으로 변경되는지 확인
3. `navigator.clipboard.readText()` 를 DevTools 콘솔에 실행해 복사된 URL이 `http://localhost:.../#tools/shilbi` 형태인지 확인

- [ ] **Step 11: 브라우저에서 딥링크 해시 라우팅을 확인한다**

주소창에 다음 URL을 직접 입력해 테스트:

**모달형:**
```
(현재 URL)#tools/shilbi  → tools 페이지 + 실비계산기 모달 자동오픈
(현재 URL)#tools/surgery → tools 페이지 + 수술명 검색 모달 자동오픈
(현재 URL)#tools/cardpay → tools 페이지 + 카드납 가이드 모달 자동오픈
```

**외부링크형:**
```
(현재 URL)#tools/kcd          → tools 페이지 이동 + KCD 카드 파란 테두리 강조
(현재 URL)#tools/kidi-discount→ tools 페이지 이동 + 할인할증 카드 강조
```

**잘못된 ID:**
```
(현재 URL)#tools/unknown → tools 페이지만 이동, 에러 없음
(현재 URL)#other/page   → 아무 동작 없음 (홈 유지)
```

- [ ] **Step 12: 커밋한다**

```bash
git add index.html
git commit -m "feat: add copyToolLink, highlightToolCard, initHashRouting for tool deep links"
```

---

## Task 4: 버전 업 + CHANGELOG + 배포

**Files:**
- Modify: `index.html` (앱 버전 상수)
- Modify: `CHANGELOG.md`

- [ ] **Step 13: 앱 버전을 올린다**

`index.html`에서 현재 버전 상수(예: `v0.5.7`)를 찾아 패치 버전 +1로 올린다.

- [ ] **Step 14: CHANGELOG.md에 항목을 추가한다**

`CHANGELOG.md` 최상단에 추가:

```markdown
## [0.5.8] - 2026-05-15
### Added
- 실무도구 카드 링크복사 버튼 추가 (호버 시 노출, 터치 기기 항상 노출)
- 딥링크 해시 라우팅 지원: `#tools/{tool-id}` 형태로 특정 도구 바로 진입
  - 모달형(실비계산기·수술명검색·카드납가이드): 모달 자동오픈
  - 외부링크형: 카드 하이라이트 + 스크롤
```

- [ ] **Step 15: 커밋 후 푸시한다**

```bash
git add index.html CHANGELOG.md
git commit -m "v0.5.8: 실무도구 링크복사 + 딥링크 해시 라우팅"
git push
```

---

## 검증 체크리스트

- [ ] 11개 카드 모두 `data-tool-id` 속성 존재
- [ ] 카드 호버 시 복사 버튼 표시, 호버 해제 시 숨김
- [ ] 터치 기기(또는 DevTools 모바일 에뮬레이션)에서 복사 버튼 항상 표시
- [ ] 복사 버튼 클릭 시 카드 링크 이동 없음
- [ ] 복사 버튼 클릭 후 1.5초간 체크 아이콘 표시 후 원복
- [ ] `#tools/shilbi` 진입 시 실비계산기 모달 자동오픈
- [ ] `#tools/kcd` 진입 시 KCD 카드 하이라이트 + 스크롤
- [ ] `#tools/unknown` 진입 시 에러 없이 tools 페이지만 표시
- [ ] `#other` 진입 시 아무 동작 없음
