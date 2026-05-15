# 실무도구 링크복사 기능 설계

**날짜:** 2026-05-15  
**대상 파일:** `index.html`

---

## 개요

실무도구 페이지의 각 카드에 딥링크 복사 버튼을 추가한다. 공유받은 사람이 링크를 클릭하면 앱이 해당 도구로 바로 진입한다.

---

## 도구 ID 체계

각 카드에 `data-tool-id` 속성을 부여한다. 딥링크 형태: `https://insureconnect.co.kr/#tools/{tool-id}`

| 도구명 | tool-id | 타입 |
|---|---|---|
| 할인 할증요인 조회 | `kidi-discount` | 외부링크 |
| 보험개발원 등록포털 | `kidi-portal` | 외부링크 |
| 과실비율 정보포털 | `fault-ratio` | 외부링크 |
| 카드할부 안내 | `card-installment` | 외부링크 |
| 건축물 대장 조회 | `building-ledger` | 외부링크 |
| 승강기 정보 열람 | `elevator` | 외부링크 |
| 실손보험 인수기준 확인 | `silson-underwrite` | 외부링크 |
| KCD 질병코드 조회 | `kcd` | 외부링크 |
| 실비 계산기 | `shilbi` | 모달 |
| 수술명 검색 | `surgery` | 모달 |
| 카드납 가이드 | `cardpay` | 모달 |

---

## 해시 라우팅

### 파싱 규칙

`index.html` 로드 시 `initHashRouting()` 함수를 호출한다.

```
location.hash = "#tools"         → goToPage('tools')
location.hash = "#tools/shilbi"  → goToPage('tools') + openShilbi()
location.hash = "#tools/kcd"     → goToPage('tools') + highlightToolCard('kcd')
```

### 처리 흐름

1. `DOMContentLoaded` 이후 `initHashRouting()` 실행
2. `location.hash`를 `#page/tool-id` 형태로 파싱
3. page가 `tools`이면 `goToPage('tools')` 호출
4. tool-id가 있으면 타입에 따라 분기:
   - **모달형**: 해당 모달 오픈 함수 호출
   - **외부링크형**: `highlightToolCard(toolId)` 호출
5. 모달형은 `setTimeout(fn, 100)`으로 페이지 전환 후 오픈

### 모달 tool-id → 함수 매핑

```js
const TOOL_MODAL_MAP = {
  shilbi:  () => openShilbi(),
  surgery: () => openSurg(),
  cardpay: () => openCardGuide(),
};
```

---

## 복사 버튼 UI

### HTML 구조

기존 카드 구조에 `.tool-card-copy` 버튼을 `.tool-card-arrow` 앞에 삽입:

```html
<a class="tool-card" data-tool-id="kcd" href="..." target="_blank" ...>
  <div class="tool-card-icon">🩺</div>
  <div class="tool-card-body">...</div>
  <button class="tool-card-copy" onclick="copyToolLink(event,'kcd')" aria-label="링크 복사" title="링크 복사">
    <svg .../>
  </button>
  <div class="tool-card-arrow">→</div>
</a>
```

### 동작

- 클릭 시 `event.preventDefault()` + `event.stopPropagation()` (카드 링크 이동 차단)
- `navigator.clipboard.writeText(url)` 로 클립보드 복사
- 성공: 버튼 아이콘을 `✓`(체크 SVG)로 교체 → 1.5초 후 원복
- 실패: 콘솔 경고만 출력 (사용자 흐름 중단 없음)

### CSS

```css
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
}
.tool-card:hover .tool-card-copy {
  opacity: 1;
}
.tool-card-copy:hover {
  color: var(--blue-light);
  background: rgba(26,61,232,0.07);
}
.tool-card-copy.copied {
  color: #059669;
  opacity: 1;
}
```

카드 호버 시에만 버튼이 나타나 평소엔 깔끔한 UI 유지. 모바일(터치)에서는 항상 표시.

---

## 하이라이트 효과 (외부링크 도구)

딥링크로 진입한 외부링크 카드를 시각적으로 강조:

1. `scrollIntoView({ behavior: 'smooth', block: 'center' })`
2. 카드에 `.tool-card-highlight` 클래스 추가
3. 2초 후 클래스 제거

```css
@keyframes toolHighlight {
  0%, 100% { box-shadow: var(--sh-sm); border-color: rgba(26,61,232,0.12); }
  30%       { box-shadow: 0 0 0 3px rgba(26,61,232,0.3); border-color: rgba(26,61,232,0.6); }
}
.tool-card-highlight {
  animation: toolHighlight 2s ease-out forwards;
}
```

---

## 구현 범위 (index.html만 수정)

1. **CSS 추가**: `.tool-card-copy`, `.tool-card-highlight`, `@keyframes toolHighlight`
2. **HTML 수정**: 11개 카드 각각에 `data-tool-id` 속성 + `.tool-card-copy` 버튼 삽입
3. **JS 추가**:
   - `copyToolLink(event, toolId)` 함수
   - `highlightToolCard(toolId)` 함수
   - `initHashRouting()` 함수
   - `DOMContentLoaded` 에서 `initHashRouting()` 호출

---

## 변경하지 않는 것

- `showPage()` / `goToPage()` 함수 — 수정 없음
- 기존 `trackCardClick()` 호출 — 그대로 유지
- 보험 포털(02 섹션) 카드 — 이번 범위 외

---

## 완료 기준

- 각 실무도구 카드 호버 시 복사 버튼 노출
- 복사 클릭 → 클립보드에 `https://insureconnect.co.kr/#tools/{id}` 저장
- 복사된 URL 브라우저에서 열면 tools 페이지 + 해당 도구 자동 진입
- 모달형 딥링크: 모달 자동오픈
- 외부링크형 딥링크: 카드 하이라이트 + 스크롤
