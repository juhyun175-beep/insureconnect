/**
 * v2.95.0: 쿠팡 파트너스 추천 — SEO/AEO 신규유입 페이지용 뷰어 모달 (관리자 DB 연동)
 *
 *  전략(플랫폼 가치 훼손 없이 수익화):
 *   1) "광고"가 아니라 "현장 설계사 추천 실무템" 큐레이션으로 프레이밍.
 *   2) 법적 필수 고지(공정위 추천·보증 심사지침 + 쿠팡 약관) 항상 표기.
 *   3) 정면 광고 섹션 금지 — 본문 끝 슬림 트리거 → 클릭 시 뷰어 모달.
 *      SSR 크롤 HTML엔 광고 미노출(애드센스 유리). 아이템은 클라이언트가 /api/coupang 로 로드.
 *   4) 아이템은 관리자 페이지에서 추가/수정/활성·비활성/삭제(ic_coupang_items 테이블).
 *      활성 아이템이 0개면 트리거 자체를 숨김.
 *   5) 클릭은 /api/track/card-click(menu='쿠팡추천')로 추적.
 */

/**
 * SEO/AEO 신규유입 페이지용 — 본문 끝 슬림 트리거 + 사용자가 클릭해 여는 추천 뷰어 모달.
 *  자동 팝업 아님(사용자 클릭으로만 열림) → UX·애드센스 안전.
 *  seoCtaFooter에 1회 주입되어 전 SSR 콘텐츠 페이지에 일관 적용.
 */
export function coupangModal() {
  return `
<div class="cpm-trigger-wrap" id="cpm-trigger-wrap" style="display:none">
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
    <div class="cpm-grid" id="cpm-grid"></div>
    <p class="cpm-disc">이 영역은 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의 수수료를 제공받습니다. 가격·재고는 쿠팡에서 확인하세요. (구매에 추가 비용이 발생하지 않습니다.)</p>
  </div>
</div>
<script>
(function(){
  if(window.__cpmBound) return; window.__cpmBound=1;
  var ov=document.getElementById('cpm-overlay');
  var wrap=document.getElementById('cpm-trigger-wrap');
  var grid=document.getElementById('cpm-grid');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]);});}
  // 활성 아이템 로드 — 0개면 트리거 숨김(현재 상태 유지)
  fetch('/api/coupang?active=1').then(function(r){return r.json();}).then(function(items){
    if(!Array.isArray(items)||!items.length){ return; }
    grid.innerHTML=items.map(function(it){
      return '<a class="cpm-card" href="'+esc(it.href)+'" target="_blank" rel="noopener noreferrer nofollow sponsored" referrerpolicy="unsafe-url" data-cp="'+esc(it.label)+'">'
        +'<span class="cpm-imgw"><img src="'+esc(it.img)+'" alt="'+esc(it.label)+'" loading="lazy" decoding="async"></span>'
        +'<span class="cpm-tx"><b>'+esc(it.label)+'</b><span>'+esc(it.sub||'')+'</span></span></a>';
    }).join('');
    if(wrap) wrap.style.display='';
  }).catch(function(){});
  window.cpmOpen=function(){ if(ov){ ov.classList.add('open'); document.body.style.overflow='hidden'; } };
  window.cpmClose=function(){ if(ov){ ov.classList.remove('open'); document.body.style.overflow=''; } };
  if(ov){ ov.addEventListener('click',function(e){ if(e.target===ov) window.cpmClose(); }); }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape' && ov && ov.classList.contains('open')) window.cpmClose(); });
  if(grid) grid.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('.cpm-card'); if(!a) return;
    try{ fetch('/api/track/card-click',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({menu:'쿠팡추천',card:a.getAttribute('data-cp')||''})}); }catch(_){}
  });
})();
</script>`;
}
