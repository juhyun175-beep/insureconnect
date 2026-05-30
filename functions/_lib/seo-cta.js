/**
 * v2.1.61: SEO 게시판(SSR) 공통 전환 푸터 + 공유 바
 *   - seoCtaFooter: 검색 유입 방문자를 InsureConnect 본 서비스/커뮤니티로 유도 (전환)
 *   - seoShareBar: 카카오톡 등으로 공유 유도 (바이럴 유입) — 페이지 OG가 풍부해 미리보기 양호
 *   - 자체 <style>/<script> 포함, 각 SSR 페이지에 1회 삽입
 */
const sesc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** 공유 바 (페이지 prime 위치에 1회). url/title 은 raw 로 받음. */
export function seoShareBar(url, title) {
  return `
<style>
.seo-share{max-width:760px;margin:0 auto 16px;padding:14px 18px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.seo-share-label{font-size:14px;font-weight:700;color:#374151;flex:1;min-width:160px}
.seo-share-btns{display:flex;gap:8px}
.seo-share-btns button{font-family:inherit;cursor:pointer;border:none;border-radius:9px;font-size:13.5px;font-weight:700;padding:9px 14px;transition:filter .15s}
.seo-share-btns button:hover{filter:brightness(0.96)}
.ssb-kakao{background:#FEE500;color:#191600}
.ssb-share{background:#1a3de8;color:#fff}
.ssb-copy{background:#eef2ff;color:#1a3de8}
@media(max-width:640px){.seo-share{margin:0 16px 16px;border-radius:12px}}
</style>
<div class="seo-share" data-url="${sesc(url)}" data-title="${sesc(title)}">
  <span class="seo-share-label">📢 도움이 됐다면 동료·고객에게 공유하세요</span>
  <div class="seo-share-btns">
    <button type="button" class="ssb-kakao" onclick="seoKakao(this)">💬 카카오톡</button>
    <button type="button" class="ssb-share" onclick="seoShare(this)">📤 공유</button>
    <button type="button" class="ssb-copy" onclick="seoCopy(this)">🔗 링크</button>
  </div>
</div>`;
}

export function seoCtaFooter(SITE) {
  return `
<style>
.seo-cta{max-width:760px;margin:0 auto 40px;padding:0 16px}
.seo-cta-inner{background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border-radius:16px;padding:28px 26px;text-align:center}
.seo-cta-title{font-size:19px;font-weight:800;margin-bottom:6px;letter-spacing:-0.02em}
.seo-cta-desc{font-size:14px;opacity:.92;margin-bottom:18px;line-height:1.6}
.seo-cta-links{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.seo-cta-links a{display:inline-block;background:rgba(255,255,255,0.16);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:10px;transition:background .15s}
.seo-cta-links a:hover{background:rgba(255,255,255,0.28)}
.seo-cta-links a.primary{background:#fff;color:#1a3de8}
.seo-foot{max-width:760px;margin:0 auto 32px;padding:0 16px;text-align:center;font-size:12px;color:#9ca3af}
.seo-foot a{color:#6b7280;text-decoration:none}
@media(max-width:640px){.seo-cta{padding:0}.seo-cta-inner{border-radius:0}}
</style>
<footer class="seo-cta" aria-label="InsureConnect 바로가기">
  <div class="seo-cta-inner">
    <div class="seo-cta-title">보험설계사를 위한 통합 정보 허브</div>
    <div class="seo-cta-desc">보험사 전산·청구서류·소식지·실무도구·채용공고를 한 곳에서.<br>InsureConnect에서 실무에 바로 쓰는 정보를 만나보세요.</div>
    <div class="seo-cta-links">
      <a class="primary" href="/">🏠 InsureConnect 홈</a>
      <a href="/company">🖥 보험사 전산·청구</a>
      <a href="/insurance">📚 보험 정보 게시판</a>
      <a href="https://open.kakao.com/o/gSN4EEoh" target="_blank" rel="noopener nofollow">💬 설계사 오픈채팅</a>
    </div>
  </div>
</footer>
<div class="seo-foot">
  © InsureConnect · <a href="/about.html">서비스 소개</a> · <a href="/disclaimer.html">면책조항</a> · <a href="/privacy.html">개인정보처리방침</a>
</div>
<script>
(function(){
  function w(b){return b.closest('.seo-share');}
  window.seoShare=function(b){var x=w(b),u=x.getAttribute('data-url'),t=x.getAttribute('data-title')||document.title;
    if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});}else{window.seoCopy(b);}};
  window.seoCopy=function(b){var x=w(b),u=x.getAttribute('data-url');var ok=function(){var s=b.innerHTML;b.innerHTML='✅ 복사됨';setTimeout(function(){b.innerHTML=s;},1500);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok,function(){window.prompt('아래 링크를 복사하세요',u);});}else{window.prompt('아래 링크를 복사하세요',u);}};
  window.seoKakao=function(b){var x=w(b),u=x.getAttribute('data-url'),t=x.getAttribute('data-title')||document.title;
    /* Kakao JS SDK 미사용 — 모바일은 네이티브 공유(카카오톡 선택), 데스크톱은 링크 복사로 폴백 */
    if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});}
    else{window.seoCopy(b);b.innerHTML='🔗 링크복사됨';setTimeout(function(){b.innerHTML='💬 카카오톡';},1500);}};
})();
</script>`;
}
