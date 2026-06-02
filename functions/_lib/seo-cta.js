/**
 * v2.1.61: SEO 게시판(SSR) 공통 전환 푸터 + 공유 바
 *   - seoCtaFooter: 검색 유입 방문자를 InsureConnect 본 서비스/커뮤니티로 유도 (전환)
 *   - seoShareBar: 카카오톡 등으로 공유 유도 (바이럴 유입)
 *   - v2.1.66: Kakao JS SDK 리치 공유 (앱키 설정 시) — 데스크톱 원탭 + 맞춤 카드
 */

/* ── Kakao JavaScript 앱키 ──────────────────────────────────────
 * developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키
 * 플랫폼 → Web → 사이트 도메인에 https://insureconnect-hub.pages.dev 등록 필요
 * 키가 비어있으면 SDK 미로드 → 기존 Web Share/복사로 자동 폴백 (안전) */
const KAKAO_JS_KEY = 'ca87154629fc282e5202c66822514bd4'; // Kakao JavaScript 키 (클라이언트 공개키)

const sesc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** 공유 바 (페이지 prime 위치에 1회). url/title/desc/image 는 raw. */
export function seoShareBar(url, title, desc, image) {
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
<div class="seo-share" data-url="${sesc(url)}" data-title="${sesc(title)}" data-desc="${sesc(desc)}" data-image="${sesc(image)}">
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
.seo-hubnav{max-width:760px;margin:0 auto 14px;padding:0 16px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.seo-hubnav a{font-size:12.5px;font-weight:700;color:#475569;text-decoration:none;background:#fff;border:1px solid #e5e7eb;padding:7px 13px;border-radius:999px;transition:border-color .15s,color .15s}
.seo-hubnav a:hover{border-color:#1a3de8;color:#1a3de8}
.seo-foot{max-width:760px;margin:0 auto 32px;padding:0 16px;text-align:center;font-size:12px;color:#9ca3af}
.seo-foot a{color:#6b7280;text-decoration:none}
@media(max-width:640px){.seo-cta{padding:0}.seo-cta-inner{border-radius:0}}
</style>
<footer class="seo-cta" aria-label="InsureConnect 바로가기">
  <div class="seo-cta-inner">
    <div class="seo-cta-title">무료 회원가입하고 전부 이용하세요</div>
    <div class="seo-cta-desc">보험사 전산·청구서류·소식지·실무도구·채용공고 + 설계사 커뮤니티까지.<br>카카오로 1초 가입하면 자주 쓰는 전산을 즐겨찾기·알림으로 더 빠르게 쓸 수 있어요.</div>
    <div class="seo-cta-links">
      <a class="primary" href="/api/auth/kakao/login">💬 카카오로 1초 가입 →</a>
      <a href="/company">🖥 보험사 전산·청구</a>
      <a href="/insurance">📚 보험 정보</a>
      <a href="https://open.kakao.com/o/gSN4EEoh" target="_blank" rel="noopener nofollow">💬 오픈채팅</a>
    </div>
  </div>
</footer>
<nav class="seo-hubnav" aria-label="InsureConnect 서비스 바로가기">
  <a href="/company">🖥 보험사 전산</a>
  <a href="/insurance">📚 보험 정보</a>
  <a href="/recruit">🟢 채용공고</a>
  <a href="/lecture">🎓 교육·강의</a>
  <a href="/newsletter">🗞 소식·자료</a>
  <a href="/community">💬 커뮤니티</a>
  <a href="/rental">🚗 렌트카·리스</a>
  <a href="/telecom">📱 휴대폰·통신</a>
  <a href="/ga">🏢 GA 전산</a>
</nav>
<div class="seo-foot">
  © InsureConnect · <a href="/about.html">서비스 소개</a> · <a href="/disclaimer.html">면책조항</a> · <a href="/privacy.html">개인정보처리방침</a>
</div>
${KAKAO_JS_KEY ? `<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" crossorigin="anonymous"></script>
<script>try{if(window.Kakao&&!window.Kakao.isInitialized()){window.Kakao.init('${KAKAO_JS_KEY}');}}catch(e){}</script>` : ''}
<script>
(function(){
  function w(b){return b.closest('.seo-share');}
  window.seoShare=function(b){var x=w(b),u=x.getAttribute('data-url'),t=x.getAttribute('data-title')||document.title;
    if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});}else{window.seoCopy(b);}};
  window.seoCopy=function(b){var x=w(b),u=x.getAttribute('data-url');var ok=function(){var s=b.innerHTML;b.innerHTML='✅ 복사됨';setTimeout(function(){b.innerHTML=s;},1500);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok,function(){window.prompt('아래 링크를 복사하세요',u);});}else{window.prompt('아래 링크를 복사하세요',u);}};
  window.seoKakao=function(b){var x=w(b),u=x.getAttribute('data-url'),t=x.getAttribute('data-title')||document.title,d=x.getAttribute('data-desc')||'',img=x.getAttribute('data-image')||'';
    // 1) Kakao SDK(앱키 설정 시): 데스크톱·모바일 원탭 리치 카드
    if(window.Kakao&&window.Kakao.Share){
      try{ window.Kakao.Share.sendDefault({objectType:'feed',
        content:{title:t,description:d,imageUrl:img,link:{mobileWebUrl:u,webUrl:u}},
        buttons:[{title:'자세히 보기',link:{mobileWebUrl:u,webUrl:u}}]}); return; }catch(e){}
    }
    // 2) 폴백: 모바일 네이티브 공유(카카오톡 선택), 데스크톱 링크 복사
    if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});}
    else{window.seoCopy(b);b.innerHTML='🔗 링크복사됨';setTimeout(function(){b.innerHTML='💬 카카오톡';},1500);}};
  /* 유입 경로 추적 — 세션당 1회 (랜딩페이지 + referrer) */
  try{ if(!sessionStorage.getItem('ic_ent')){ sessionStorage.setItem('ic_ent','1');
    var _q=new URLSearchParams(location.search);
    fetch('/api/track/hit',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({path:location.pathname,ref:document.referrer,utm:(function(){var s=_q.get('utm_source'),c=_q.get('utm_campaign');return c?(s?s+':'+c:c):s;})()})}).catch(function(){});
  } }catch(e){}
})();
</script>`;
}
