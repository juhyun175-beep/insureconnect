/**
 * v2.1.61: SEO 게시판(SSR) 공통 전환 푸터 + 공유 바
 *   - seoCtaFooter: 검색 유입 방문자를 InsureConnect 본 서비스/커뮤니티로 유도 (전환)
 *   - seoShareBar: 카카오톡 등으로 공유 유도 (바이럴 유입)
 *   - v2.1.66: Kakao JS SDK 리치 공유 (앱키 설정 시) — 데스크톱 원탭 + 맞춤 카드
 */

/* ── Kakao JavaScript 앱키 ──────────────────────────────────────
 * developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키
 * 플랫폼 → Web → 사이트 도메인에 https://insureconnect.co.kr 등록 필요
 * 키가 비어있으면 SDK 미로드 → 기존 Web Share/복사로 자동 폴백 (안전) */
import { coupangModal } from './coupang.js';

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
/* v2.138.0: SEO 랜딩 제휴 파트너 스트립 (라이트 고정) */
.spx{max-width:760px;margin:0 auto 20px;padding:0 16px}
.spx-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.spx-t{font-size:14px;font-weight:800;color:#0f172a}
.spx-ad{font-size:9px;font-weight:800;letter-spacing:.04em;color:#fff;background:#94a3b8;padding:2px 7px;border-radius:5px;margin-left:auto}
.spx-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.spx-card{position:relative;display:flex;flex-direction:column;gap:7px;text-decoration:none;color:inherit;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:13px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:transform .12s,box-shadow .12s,border-color .12s}
.spx-card:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(12,31,184,0.10);border-color:#c7d2fe}
.spx-card-ad{position:absolute;top:8px;right:8px;font-size:8.5px;font-weight:800;color:#fff;background:rgba(15,23,42,.6);padding:1px 5px;border-radius:4px}
.spx-thumb{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;overflow:hidden;background:#fff;border:1px solid #e5e7eb;font-size:18px;font-weight:800;color:#1a3de8;text-transform:uppercase;flex-shrink:0}
.spx-thumb img{width:100%;height:100%;object-fit:contain;display:block}
.spx-thumb-fb{background:linear-gradient(135deg,rgba(26,61,232,0.10),rgba(0,200,238,0.08))}
.spx-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.spx-name{font-size:13px;font-weight:800;color:#0f172a;line-height:1.3;word-break:break-word;overflow-wrap:anywhere}
.spx-tag{font-size:11.5px;color:#475569;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.spx-chip{align-self:flex-start;font-size:10px;font-weight:700;color:#1a3de8;background:rgba(26,61,232,0.08);border:1px solid rgba(26,61,232,0.18);border-radius:999px;padding:1px 8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spx-note{margin:9px 2px 0;font-size:11px;color:#9ca3af;line-height:1.45}
@media(max-width:640px){.spx-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:400px){.spx-row{grid-template-columns:1fr}}
</style>
<div id="seo-partner-strip" class="spx" style="display:none"></div>
<footer class="seo-cta" aria-label="InsureConnect 바로가기">
  <div class="seo-cta-inner">
    <div class="seo-cta-title">무료 회원가입하고 전부 이용하세요</div>
    <div class="seo-cta-desc">보험사 전산·청구서류·소식지·실무도구·채용공고 + 설계사 커뮤니티까지.<br>카카오로 1초 가입하면 자주 쓰는 전산을 즐겨찾기·알림으로 더 빠르게 쓸 수 있어요.</div>
    <div class="seo-cta-links">
      <a class="primary" href="/api/auth/kakao/login">💬 카카오로 1초 가입 →</a>
      <a href="/?post=recruit">📤 공고 등록</a>
      <a href="/company">🖥 보험사 전산·청구</a>
      <a href="/insurance">📚 보험 정보</a>
      <a href="https://open.kakao.com/o/gSN4EEoh" target="_blank" rel="noopener nofollow">💬 오픈채팅</a>
    </div>
  </div>
</footer>
${coupangModal()}
<nav class="seo-hubnav" aria-label="InsureConnect 서비스 바로가기">
  <a href="/company">🖥 보험사 전산</a>
  <a href="/insurance">📚 보험 정보</a>
  <a href="/recruit">🟢 채용공고</a>
  <a href="/lecture">🎓 교육·강의</a>
  <a href="/newsletter">🗞 소식·자료</a>
  <a href="/community">💬 커뮤니티</a>
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
  /* v2.29.0: 방문 집계 — 기기당 하루 1회(홈 trackVisit과 동일 ic_visited_date dedup).
     이전엔 검색/직접 착지하는 SSR 콘텐츠 페이지(/insurance·/company 등)가 방문수에 집계 안 돼 누락(특히 네이버 검색유입). */
  try{
    var _bot=/bot|crawler|spider|scrap|preview|kakaotalk-scrap|kakao-link|naverbot|yeti|googlebot|bingbot|facebookexternalhit|line\/|headless/i.test(navigator.userAgent||'');
    var _td=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
    if(!_bot && localStorage.getItem('ic_visited_date')!==_td){
      localStorage.setItem('ic_visited_date',_td);
      fetch('/api/track/visit',{method:'POST',keepalive:true}).catch(function(){});
    }
  }catch(e){}
})();
</script>
<style>
.ic-adpop{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(8,15,48,0.55);backdrop-filter:blur(2px);padding:16px}
.ic-adpop.show{display:flex}
.ic-adpop-card{position:relative;max-width:520px;width:100%}
.ic-adpop-img{display:block;width:100%;height:auto;max-height:82vh;object-fit:contain;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.45);cursor:pointer;background:#0b1020}
.ic-adpop-x{position:absolute;top:-13px;right:-9px;width:34px;height:34px;border-radius:50%;border:none;background:#fff;color:#333;font-size:17px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);z-index:2;line-height:1}
.ic-adpop-hint{position:absolute;left:0;right:0;bottom:12px;text-align:center;font-size:12.5px;font-weight:800;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.75);pointer-events:none}
@media(max-width:640px){.ic-adpop{align-items:flex-end;padding:0}.ic-adpop-card{max-width:100%}.ic-adpop-img{max-height:80vh;border-radius:16px 16px 0 0}.ic-adpop-x{top:9px;right:9px}}
</style>
<div id="ic-adpop" class="ic-adpop" role="dialog" aria-label="제휴상품 안내" aria-modal="true">
  <div class="ic-adpop-card">
    <button type="button" class="ic-adpop-x" aria-label="닫기">✕</button>
    <a class="ic-adpop-link" href="#" target="_blank" rel="noopener noreferrer">
      <img class="ic-adpop-img" alt="제휴상품 안내 — 자세히 보기" loading="lazy">
      <span class="ic-adpop-hint">👆 눌러서 자세히 보기</span>
    </a>
  </div>
</div>
<script>
/* v2.31.0: 광고 팝업(제휴상품) — SEO 랜딩 전 페이지. 봇제외, 노출/클릭 추적
   v2.64.0: 하드코딩 제거 — 관리자 업로드 배너(/api/home-ad)로 매번 교체. 설정 없으면 광고 미표시.
   v2.135.0: 홈 광고 정책과 통일 — 하드코딩 5초 딜레이·기기당 3일 쿨다운(전용 localStorage 키) 제거.
   popup.delay_ms/frequency 준수(session·once_day 스토리지 키는 홈과 공유), 캠페인 로테이션 적용.
   스토리지 마킹은 gate 판정이 아닌 실제 show() 시점 — 딜레이 전 이탈해도 노출 기회 미소진. */
(function(){
  if(/bot|crawler|spider|scrap|preview|naverbot|yeti|googlebot|bingbot|headless/i.test(navigator.userAgent||'')) return;
  function track(card){ try{ fetch('/api/track/card-click',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({menu:'홈광고',card:card})}); }catch(e){} }
  function kstToday(){ return new Date(Date.now()+9*3600*1000).toISOString().slice(0,10); }
  /* index.html 홈 home-ad 스크립트의 pickCampaign 복제본 (홈은 인라인 스크립트라 import 공유 불가). 로직 수정 시 양쪽 동기화 */
  function pickCampaign(cfg){
    var arr=(cfg.campaigns||[]).filter(function(c){ return c && c.images && c.images.length; });
    if(!arr.length) return null;
    if(arr.length===1) return arr[0];
    var rot=cfg.rotation||'sequential', i;
    if(rot==='random'){ return arr[Math.floor(Math.random()*arr.length)]; }
    if(rot==='weight'){
      var tot=0; for(i=0;i<arr.length;i++) tot+=Math.max(1,arr[i].weight||1);
      var r=Math.random()*tot;
      for(i=0;i<arr.length;i++){ r-=Math.max(1,arr[i].weight||1); if(r<=0) return arr[i]; }
      return arr[arr.length-1];
    }
    var n=0; try{ n=parseInt(localStorage.getItem('ic_homead_seq')||'0',10)||0; localStorage.setItem('ic_homead_seq', String((n+1)%100000)); }catch(_){}
    return arr[n % arr.length];
  }
  /* 홈 popupAllowed와 동일 판정 기준 — 마킹만 markShown(show 시점)으로 분리 */
  function freqAllowed(popup){
    if(!popup || popup.enabled===false) return false;
    var freq=popup.frequency||'once_day';
    if(freq==='off') return false;
    if(freq==='always') return true;
    try{
      if(freq==='session') return !sessionStorage.getItem('ic_homead_pop');
      if(freq==='once_day') return localStorage.getItem('ic_homead_pop_day')!==kstToday();
    }catch(_){ return true; }
    return true;
  }
  function markShown(popup){
    var freq=(popup&&popup.frequency)||'once_day';
    try{
      if(freq==='session') sessionStorage.setItem('ic_homead_pop','1');
      if(freq==='once_day') localStorage.setItem('ic_homead_pop_day', kstToday());
    }catch(_){}
  }
  fetch('/api/home-ad').then(function(r){return r.json();}).then(function(d){
    if(!d||!d.ok||!d.config) return;
    var cfg=d.config;
    if(!freqAllowed(cfg.popup)) return;
    var c=pickCampaign(cfg);
    if(!c) return;
    var imgs=(c.images||[]).filter(Boolean);
    if(!imgs.length) return;
    var el=document.getElementById('ic-adpop'); if(!el) return;
    var img=el.querySelector('.ic-adpop-img'); if(img){ img.setAttribute('src', imgs[0]); if(c.alt) img.setAttribute('alt', c.alt); }
    var lk=el.querySelector('.ic-adpop-link'); if(lk){ if(c.link_url){ lk.setAttribute('href', c.link_url); } else { lk.removeAttribute('target'); lk.setAttribute('href','#'); } }
    var shown=false;
    function show(){
      if(shown) return; shown=true;
      el.classList.add('show'); document.body.style.overflow='hidden';
      markShown(cfg.popup);
      track('popimp:'+c.id);
      function close(){ el.classList.remove('show'); document.body.style.overflow=''; }
      var x=el.querySelector('.ic-adpop-x'); if(x) x.addEventListener('click',close);
      el.addEventListener('click',function(e){ if(e.target===el) close(); });
      if(lk) lk.addEventListener('click',function(){ track('click:'+c.id); });
    }
    var delay=(cfg.popup && cfg.popup.delay_ms!=null)?cfg.popup.delay_ms:900;
    setTimeout(show, delay);
    if(!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||'')){
      document.addEventListener('mouseout',function(e){ if((e.clientY||0)<=0 && !e.relatedTarget) show(); });
    }
  }).catch(function(){});
})();
/* SEO_PARTNER_STRIP_START — v2.138.0: SEO 랜딩 제휴 파트너 스트립 + viewable 임프레션.
   API 데이터 불신: name/tagline/category 는 textContent, href/img 는 https? 만 허용(서버 검증 이중화).
   노출은 카드가 화면 50% 이상 진입한 뷰어블 기준만 인정(단순 페이지로드 카운트 금지).
   IntersectionObserver 미지원 시 페이지로드 임프레션으로 폴백하지 않음(클릭 시 imp 보정만). */
(function(){
  if(window.__seoPartnerBound) return; window.__seoPartnerBound=1;
  var PARTNER_BOT_RE=/bot|crawler|spider|scrap|preview|facebookexternalhit|twitterbot|slackbot|telegrambot|whatsapp|line\\/|kakaotalk-scrap|kakao-link|naverbot|yeti|googlebot|bingbot|duckduck|baidu|yandex|applebot|embedly|outbrain|pinterest|discordbot|skypeuripreview|chatgpt|gptbot|claudebot|perplexitybot|headless/i;
  if(PARTNER_BOT_RE.test(navigator.userAgent||'')) return;
  var box=document.getElementById('seo-partner-strip');
  if(!box) return;
  var HTTP_RE=/^https?:\\/\\//i;
  var sentImp={};                          // partner_id -> 1 (Set 대용, 카드별 1회 dedupe)
  function track(card){
    try{ fetch('/api/track/card-click',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({menu:'제휴파트너',card:card})}); }catch(_){}
  }
  function sendImp(pid){ if(sentImp[pid]) return; sentImp[pid]=1; track('imp:'+pid); }
  function initial(name){ var s=String(name==null?'':name).trim(); return s?Array.from(s)[0]:'\\u00b7'; }
  fetch('/api/partners?active=1').then(function(r){ return r.json(); }).then(function(list){
    if(!Array.isArray(list)||!list.length) return;   // 활성 0개 → placeholder 숨김 유지
    var cards=list.filter(function(p){ return p && p.id!=null && HTTP_RE.test(String(p.href||'')); }).slice(0,4);
    if(!cards.length) return;
    var head=document.createElement('div'); head.className='spx-head';
    var t=document.createElement('span'); t.className='spx-t'; t.textContent='제휴 서비스'; head.appendChild(t);
    var ad=document.createElement('span'); ad.className='spx-ad'; ad.textContent='AD'; head.appendChild(ad);
    box.appendChild(head);
    var row=document.createElement('div'); row.className='spx-row';
    // 카드별 뷰어블 노출 관측(threshold 0.5) — 화면 50% 진입 카드만 imp 1회, 이후 unobserve
    var io=('IntersectionObserver' in window) ? new IntersectionObserver(function(entries, obs){
      for(var i=0;i<entries.length;i++){
        var e=entries[i];
        if(e.isIntersecting && e.intersectionRatio>=0.5){
          sendImp(e.target.getAttribute('data-partner-id'));
          obs.unobserve(e.target);
        }
      }
    }, { threshold: 0.5 }) : null;
    cards.forEach(function(p){
      var pid=String(p.id);
      var nm=String(p.name==null?'':p.name).trim();
      var a=document.createElement('a'); a.className='spx-card';
      a.href=p.href; a.target='_blank'; a.rel='noopener noreferrer nofollow sponsored';
      a.setAttribute('data-partner-id', pid);
      var adb=document.createElement('span'); adb.className='spx-card-ad'; adb.textContent='AD'; a.appendChild(adb);
      var thumb=document.createElement('span'); thumb.className='spx-thumb';
      if(p.img && HTTP_RE.test(String(p.img))){
        var img=document.createElement('img'); img.src=p.img; img.alt=nm?(nm+' 로고'):'파트너 로고';
        img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer';
        img.addEventListener('error', function(){ thumb.textContent=initial(nm); thumb.className='spx-thumb spx-thumb-fb'; });
        thumb.appendChild(img);
      } else { thumb.textContent=initial(nm); thumb.className='spx-thumb spx-thumb-fb'; }
      a.appendChild(thumb);
      var body=document.createElement('span'); body.className='spx-body';
      var nb=document.createElement('b'); nb.className='spx-name'; nb.textContent=nm; body.appendChild(nb);
      if(p.tagline){ var tg=document.createElement('span'); tg.className='spx-tag'; tg.textContent=String(p.tagline); body.appendChild(tg); }
      if(p.category){ var ch=document.createElement('span'); ch.className='spx-chip'; ch.textContent=String(p.category); body.appendChild(ch); }
      a.appendChild(body);
      a.addEventListener('click', function(){
        sendImp(pid);           // 관측 콜백 전 빠른 클릭 시 imp 먼저(클릭>노출 역전 방지)
        track('click:'+pid);
      });
      row.appendChild(a);
      if(io) io.observe(a);
    });
    box.appendChild(row);
    var note=document.createElement('p'); note.className='spx-note';
    note.textContent='제휴 파트너 광고 · 신청·상담·계약은 각 파트너사에서 직접 진행됩니다.';
    box.appendChild(note);
    box.style.display='';
  }).catch(function(){});   // fetch/JSON 오류 → placeholder 숨김 유지
})();
/* SEO_PARTNER_STRIP_END */
</script>`;
}
