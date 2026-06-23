/**
 * v2.93.1: 쿠팡 파트너스 제휴 — 단일 출처(SSOT)
 *
 *  전략(플랫폼 가치 훼손 없이 수익화):
 *   1) "광고"가 아니라 "현장 설계사 추천 실무템" 큐레이션으로 프레이밍 → value-add 체감.
 *      5개 품목 전부 설계사 일상과 직결(외근 운전·종일 모바일·고객 미팅·일정관리·상담공간).
 *   2) 법적 필수 고지(공정위 추천·보증 심사지침 + 쿠팡 파트너스 약관)를 항상 표기.
 *   3) ★전산/콘텐츠 화면 "정면"에 광고 섹션 금지. 사용자가 진입한 "콘텐츠 뷰어 안"에서만 노출.
 *        - 홈: 인슈어커넥트 뉴스 카드 뷰어 팝업 하단 스트립(index.html, .cnx)
 *        - SEO/AEO 신규유입 페이지: 본문 끝의 슬림 트리거 → 클릭 시 뷰어 모달(coupangModal)
 *      이 방식은 SSR 크롤 HTML에 광고 배너를 노출하지 않아 애드센스 심사에도 유리.
 *   4) 클릭은 /api/track/card-click(menu='쿠팡추천')로 추적 → 성과 기반 품목 교체.
 *
 *  ※ 상품/링크 교체는 COUPANG_ITEMS 배열만 수정하면 전 노출처에 반영됨.
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
 * SEO/AEO 신규유입 페이지용 — 본문 끝 슬림 트리거 + 사용자가 클릭해 여는 추천 뷰어 모달.
 *  자동 팝업/인터스티셜 아님(사용자 클릭으로만 열림) → UX·애드센스 안전.
 *  seoCtaFooter에 1회 주입되어 전 SSR 콘텐츠 페이지에 일관 적용.
 */
export function coupangModal() {
  const cards = COUPANG_ITEMS.map((it) => `
      <a class="cpm-card" href="${cesc(it.href)}" target="_blank" rel="noopener noreferrer nofollow sponsored"
         referrerpolicy="unsafe-url" data-cp="${cesc(it.label)}">
        <span class="cpm-imgw"><img src="${cesc(it.img)}" alt="${cesc(it.alt)}" width="120" height="240" loading="lazy" decoding="async"></span>
        <span class="cpm-tx"><b>${cesc(it.label)}</b><span>${cesc(it.sub)}</span></span>
      </a>`).join('');

  return `
<div class="cpm-trigger-wrap">
<style>
.cpm-trigger-wrap{max-width:760px;margin:6px auto 26px;padding:0 16px;text-align:center}
.cpm-trigger{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #e5e7eb;border-radius:999px;color:#475569;font-family:inherit;font-size:13px;font-weight:700;padding:9px 16px;cursor:pointer;transition:border-color .15s,color .15s}
.cpm-trigger:hover{border-color:#ff9aa0;color:#ff5a5f}
.cpm-trigger .cpm-badge{font-size:9.5px;font-weight:800;color:#fff;background:#ff5a5f;padding:1px 6px;border-radius:999px}
.cpm-overlay{position:fixed;inset:0;z-index:99992;display:none;align-items:center;justify-content:center;background:rgba(8,15,48,0.55);backdrop-filter:blur(2px);padding:16px}
.cpm-overlay.open{display:flex}
.cpm-card-box{position:relative;background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;padding:20px 20px 16px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
.cpm-x{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;color:#334155;font-size:16px;font-weight:800;cursor:pointer;line-height:1}
.cpm-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:2px 0 3px;padding-right:30px}
.cpm-title{font-size:16px;font-weight:800;color:#0f172a}
.cpm-tag{font-size:10px;font-weight:800;color:#fff;background:#ff5a5f;padding:2px 7px;border-radius:999px}
.cpm-sub{font-size:12.5px;color:#64748b;margin:0 0 14px}
.cpm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.cpm-card{display:flex;flex-direction:column;gap:7px;text-decoration:none;color:inherit;background:#f9fafb;border:1px solid #eef2f7;border-radius:12px;padding:9px;transition:transform .12s,box-shadow .12s,border-color .12s}
.cpm-card:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(0,0,0,0.10);border-color:#ff9aa0}
.cpm-imgw{display:block;aspect-ratio:1/1;border-radius:9px;overflow:hidden;background:#fff}
.cpm-imgw img{width:100%;height:100%;object-fit:cover;display:block}
.cpm-tx{display:flex;flex-direction:column;gap:1px;line-height:1.3}
.cpm-tx b{font-size:12.5px;font-weight:800;color:#0f172a}
.cpm-tx span{font-size:10.5px;color:#94a3b8}
.cpm-disc{margin:13px 2px 0;font-size:10.5px;color:#a0aab8;line-height:1.45}
@media(max-width:560px){.cpm-grid{grid-template-columns:repeat(2,1fr)}}
</style>
  <button type="button" class="cpm-trigger" onclick="cpmOpen()">🛍️ 현장 설계사 추천 아이템 보기 <span class="cpm-badge">광고</span></button>
</div>
<div class="cpm-overlay" id="cpm-overlay" role="dialog" aria-modal="true" aria-label="현장 설계사 추천 아이템">
  <div class="cpm-card-box">
    <button type="button" class="cpm-x" aria-label="닫기" onclick="cpmClose()">✕</button>
    <div class="cpm-head"><span class="cpm-title">🛍️ 현장 설계사 추천 아이템</span><span class="cpm-tag">광고 · 쿠팡파트너스</span></div>
    <p class="cpm-sub">필드에서 자주 쓰는 실무템 — 동료 설계사들이 많이 찾는 픽을 모았어요.</p>
    <div class="cpm-grid" id="cpm-grid">${cards}</div>
    <p class="cpm-disc">이 영역은 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의 수수료를 제공받습니다. 가격·재고는 쿠팡에서 확인하세요. (구매에 추가 비용이 발생하지 않습니다.)</p>
  </div>
</div>
<script>
(function(){
  if(window.__cpmBound) return; window.__cpmBound=1;
  var ov=document.getElementById('cpm-overlay');
  window.cpmOpen=function(){ if(ov){ ov.classList.add('open'); document.body.style.overflow='hidden'; } };
  window.cpmClose=function(){ if(ov){ ov.classList.remove('open'); document.body.style.overflow=''; } };
  if(ov){ ov.addEventListener('click',function(e){ if(e.target===ov) window.cpmClose(); }); }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape' && ov && ov.classList.contains('open')) window.cpmClose(); });
  var grid=document.getElementById('cpm-grid');
  if(grid) grid.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('.cpm-card'); if(!a) return;
    try{ fetch('/api/track/card-click',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({menu:'쿠팡추천',card:a.getAttribute('data-cp')||''})}); }catch(_){}
  });
})();
</script>`;
}
