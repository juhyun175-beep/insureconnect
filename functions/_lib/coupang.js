/**
 * v2.93.0: 쿠팡 파트너스 제휴 위젯 — 단일 출처(SSOT)
 *
 *  전략(플랫폼 가치 훼손 없이 수익화):
 *   1) "광고"가 아니라 "현장 설계사 추천 실무템" 큐레이션으로 프레이밍 → value-add 체감.
 *      5개 품목 전부 설계사 일상과 직결(외근 운전·종일 모바일·고객 미팅·일정관리·상담공간).
 *   2) 법적 필수 고지(공정위 추천·보증 심사지침 + 쿠팡 파트너스 약관)를 항상 표기.
 *   3) 비침입: 팝업·인터스티셜 금지. 콘텐츠/커뮤니티 하단(업무 흐름 종료 지점)에만 1개 섹션.
 *   4) 단일 컴포넌트 → seoCtaFooter(전 SSR 콘텐츠 페이지) + 홈 대시보드에 일관 노출.
 *   5) 클릭은 /api/track/card-click(menu='쿠팡추천')로 추적 → 성과 기반 품목 교체.
 *
 *  ※ 상품/링크 교체는 이 배열만 수정하면 전 노출처에 반영됨.
 */

export const COUPANG_ITEMS = [
  {
    label: '차량용 거치대',
    sub: '외근 운전 필수 · 계기판 거치대',
    href: 'https://link.coupang.com/a/eOTTmWtHhI',
    img: 'https://image14.coupangcdn.com/image/affiliate/banner/c708da1a180df16dd06b78c48c8ec17d@2x.jpg',
    alt: '2in1 차량 계기판 스마트폰 거치대',
  },
  {
    label: '보조배터리',
    sub: '종일 외근 · 맥세이프 10000mAh',
    href: 'https://link.coupang.com/a/eOT86GHbpI',
    img: 'https://img5a.coupangcdn.com/image/affiliate/banner/cba23db3650847ccf6ce310c4c035ab5@2x.jpg',
    alt: '조이트론 맥세이프 울트라 슬림 보조배터리 10000mAh',
  },
  {
    label: '명함 케이스',
    sub: '첫인상 · 가죽 명함 지갑',
    href: 'https://link.coupang.com/a/eOUc4c9XJk',
    img: 'https://image12.coupangcdn.com/image/affiliate/banner/22f2b3425d627289da0754c4ba27e378@2x.jpg',
    alt: '가죽 명함 카드 지갑 케이스',
  },
  {
    label: '다이어리·플래너',
    sub: '고객·일정 관리 · 만년 위클리',
    href: 'https://link.coupang.com/a/eOUgCN2p1U',
    img: 'https://image6.coupangcdn.com/image/affiliate/banner/e8975d8da8bab0de97db972c9513ed8f@2x.jpg',
    alt: '만년 다이어리 위클리 데일리 플래너',
  },
  {
    label: '디퓨저',
    sub: '상담 공간·차량 · 선물세트',
    href: 'https://link.coupang.com/a/eOUjyMY2zk',
    img: 'https://img3c.coupangcdn.com/image/affiliate/banner/f9d7bf152de998312b6283ec855ebaf8@2x.jpg',
    alt: '클래식 디퓨저 선물세트',
  },
];

const cesc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * 추천 아이템 위젯 HTML.
 *  @param {object} [opts]
 *  @param {string} [opts.variant='ssr']  'ssr'(SEO 콘텐츠 푸터) | 'home'(홈 대시보드)
 */
export function coupangWidget(opts = {}) {
  const variant = opts.variant === 'home' ? 'home' : 'ssr';
  const cards = COUPANG_ITEMS.map((it) => `
      <a class="cpx-card" href="${cesc(it.href)}" target="_blank" rel="noopener noreferrer nofollow sponsored"
         referrerpolicy="unsafe-url" data-cp="${cesc(it.label)}">
        <span class="cpx-imgw"><img src="${cesc(it.img)}" alt="${cesc(it.alt)}" width="120" height="240" loading="lazy" decoding="async"></span>
        <span class="cpx-tx"><b>${cesc(it.label)}</b><span>${cesc(it.sub)}</span></span>
      </a>`).join('');

  return `
<section class="cpx cpx-${variant}" aria-label="현장 설계사 추천 아이템">
<style>
.cpx{max-width:900px;margin:18px auto 22px;padding:0 16px}
.cpx-ssr{max-width:760px}
.cpx-box{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:16px;padding:16px 16px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.04)}
[data-theme="dark"] .cpx-box{background:#161b22;border-color:#30363d}
.cpx-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:3px}
.cpx-title{font-size:15px;font-weight:800;color:var(--txt-hi,#0f172a)}
[data-theme="dark"] .cpx-title{color:#e6edf3}
.cpx-tag{font-size:10px;font-weight:800;color:#fff;background:#ff5a5f;padding:2px 7px;border-radius:999px;letter-spacing:.02em}
.cpx-sub{font-size:12px;color:var(--txt-mid,#64748b);margin:0 0 12px}
.cpx-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.cpx-card{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;background:var(--bg,#f9fafb);border:1px solid var(--border,#eef2f7);border-radius:12px;padding:10px;transition:transform .12s,box-shadow .12s,border-color .12s}
[data-theme="dark"] .cpx-card{background:#0d1117;border-color:#30363d}
.cpx-card:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(0,0,0,0.10);border-color:#ff9aa0}
.cpx-imgw{display:block;aspect-ratio:1/1;border-radius:9px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center}
.cpx-imgw img{width:100%;height:100%;object-fit:cover;display:block}
.cpx-tx{display:flex;flex-direction:column;gap:1px;line-height:1.35}
.cpx-tx b{font-size:13px;font-weight:800;color:var(--txt-hi,#0f172a)}
[data-theme="dark"] .cpx-tx b{color:#e6edf3}
.cpx-tx span{font-size:11px;color:var(--txt-mid,#94a3b8)}
.cpx-disc{margin:11px 2px 0;font-size:10.5px;color:#a0aab8;line-height:1.45}
@media(max-width:760px){.cpx-grid{grid-template-columns:repeat(2,1fr)}.cpx-card:nth-child(5){grid-column:span 2;flex-direction:row;align-items:center}.cpx-card:nth-child(5) .cpx-imgw{width:64px;flex-shrink:0;aspect-ratio:1/1}.cpx-card:nth-child(5) .cpx-tx{flex:1}}
</style>
  <div class="cpx-box">
    <div class="cpx-head">
      <span class="cpx-title">🛍️ 현장 설계사 추천 아이템</span>
      <span class="cpx-tag">광고 · 쿠팡파트너스</span>
    </div>
    <p class="cpx-sub">필드에서 자주 쓰는 실무템 — 동료 설계사들이 많이 찾는 픽을 모았어요.</p>
    <div class="cpx-grid">${cards}</div>
    <p class="cpx-disc">이 영역은 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의 수수료를 제공받습니다. 가격·재고는 쿠팡에서 확인하세요. (구매에 추가 비용이 발생하지 않습니다.)</p>
  </div>
<script>
(function(){
  if(window.__cpxBound) return; window.__cpxBound=1;
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('.cpx-card'); if(!a) return;
    try{ fetch('/api/track/card-click',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({menu:'쿠팡추천',card:a.getAttribute('data-cp')||''})}); }catch(_){}
  },true);
})();
</script>
</section>`;
}
