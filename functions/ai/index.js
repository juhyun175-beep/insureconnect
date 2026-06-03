/**
 * v2.2.0: AI 보험비서 데모/도구 페이지 — GET /ai
 */
import { AI_MODES, aiProvider } from '../_lib/ai.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const onRequestGet = async ({ env }) => {
  const modes = Object.entries(AI_MODES).map(([id, m]) => ({ id, label: m.label, placeholder: m.placeholder }));
  const ready = !!aiProvider(env);
  const tabsHtml = modes.map((m, i) =>
    `<button class="mode-tab${i === 0 ? ' active' : ''}" data-mode="${m.id}" type="button">${esc(m.label)}</button>`
  ).join('');
  const modeData = JSON.stringify(Object.fromEntries(modes.map(m => [m.id, m.placeholder])));

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>삼따AI — 사례 기반 보험 AI | InsureConnect</title>
<meta name="description" content="삼따AI — 실제 인수·고지·보상 사례를 근거로 답하는 보험설계사 전용 AI. 사례 질문·공유, 상담 스크립트·보장분석까지.">
<meta name="robots" content="noindex,nofollow">
<link rel="canonical" href="${SITE}/ai">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="삼따AI — 사례 기반 보험 AI">
<meta property="og:description" content="실제 보험 사례를 근거로 답하는 보험설계사 전용 AI">
<meta property="og:url" content="${SITE}/ai">
<meta property="og:image" content="${SITE}/logo-full.png">
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#0f172a;background:#0b1020;margin:0;min-height:100vh}
.bg{background:radial-gradient(circle at 20% 0%,rgba(26,61,232,0.25),transparent 55%),radial-gradient(circle at 100% 100%,rgba(0,200,238,0.18),transparent 55%);min-height:100vh;padding:0 0 60px}
.wrap{max-width:760px;margin:0 auto;padding:0 16px}
header.h{text-align:center;padding:40px 16px 24px;color:#fff}
header.h .badge{display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:#bcd0ff;font-size:11px;font-weight:800;letter-spacing:0.08em;padding:4px 12px;border-radius:999px;margin-bottom:14px}
header.h h1{margin:0 0 8px;font-size:30px;letter-spacing:-0.02em;background:linear-gradient(90deg,#fff,#9fc1ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
header.h p{margin:0;color:#9fb0d8;font-size:14px}
.panel{background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,0.4);overflow:hidden}
.modes{display:flex;gap:6px;padding:14px 14px 0;flex-wrap:wrap;background:#f8fafc;border-bottom:1px solid #eef2f7}
.mode-tab{flex:1;min-width:110px;border:none;background:transparent;color:#64748b;font-family:inherit;font-size:13.5px;font-weight:700;padding:11px 8px;border-radius:10px 10px 0 0;cursor:pointer}
.mode-tab.active{background:#fff;color:#1a3de8;box-shadow:0 -2px 0 #1a3de8 inset}
.body{padding:20px 22px 24px}
textarea{width:100%;min-height:120px;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;font-family:inherit;font-size:14.5px;line-height:1.6;resize:vertical;color:#0f172a}
textarea:focus{outline:none;border-color:#1a3de8}
.row{display:flex;align-items:center;gap:10px;margin-top:12px}
.gen-btn{background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:15px;padding:13px 26px;cursor:pointer}
.gen-btn:disabled{opacity:.6;cursor:not-allowed}
.hint{font-size:12px;color:#94a3b8}
.out-wrap{margin-top:18px;display:none}
.out-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.out-head h3{margin:0;font-size:14px;color:#0f172a}
.copy-btn{border:none;background:#eef2ff;color:#1a3de8;font-weight:700;font-size:12.5px;padding:7px 13px;border-radius:8px;cursor:pointer}
.output{white-space:pre-wrap;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:16px;font-size:14.5px;line-height:1.7;color:#1f2937;min-height:40px}
.err{color:#dc2626;font-size:13px;margin-top:10px}
.note{font-size:11.5px;color:#94a3b8;margin-top:16px;line-height:1.6}
.note a{color:#7dd3fc;text-decoration:none}
.foot{text-align:center;margin-top:26px}
.foot a{color:#bcd0ff;text-decoration:none;font-size:13px;font-weight:700;background:rgba(255,255,255,0.08);padding:10px 18px;border-radius:10px}
.spin{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;vertical-align:-2px;margin-right:6px}
@keyframes sp{to{transform:rotate(360deg)}}
@media(max-width:640px){header.h h1{font-size:24px}.wrap{padding:0 12px}}
</style>
</head>
<body>
<div class="bg">
<header class="h">
  <span class="badge">삼따방 전용 · 실제 사례 기반 AI</span>
  <h1>🤖 삼따AI</h1>
  <p>실제 인수·고지·보상 사례로 답하고, 사례를 함께 쌓는 보험설계사 AI</p>
</header>
<div class="wrap">
  <div class="panel" style="margin-bottom:18px;border:2px solid #1a3de8;">
    <div style="padding:14px 18px 0;">
      <div style="font-size:15px;font-weight:800;color:#1a3de8;">💬 사례 기반 질문 <span style="font-size:11px;font-weight:600;color:#64748b;">— 축적된 실제 인수·고지·보상 사례로 답합니다</span></div>
    </div>
    <div class="body">
      <div id="cq-conv" style="display:none;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#1a3de8;font-weight:700;">
        <span id="cq-conv-label">💬 이어지는 대화</span>
        <button type="button" onclick="cqReset()" style="background:none;border:1px solid #cbd5e1;border-radius:8px;color:#64748b;font-size:11.5px;font-weight:700;padding:4px 10px;cursor:pointer;">🆕 새 대화</button>
      </div>
      <textarea id="cq-input" placeholder="예) 갑상선암 진단 후 2년인데 종신보험 가입 될까요? / 디스크 수술 이력 고지하면 부담보 잡히나요?"></textarea>
      <div class="row">
        <button class="gen-btn" id="cq-ask" type="button">🔎 사례로 물어보기</button>
        <span class="hint" id="cq-hint">로그인 필요 · 등급별 일일 한도</span>
      </div>
      <div class="err" id="cq-err"></div>
      <div class="out-wrap" id="cq-out-wrap">
        <div id="cq-evidence" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;"></div>
        <div class="out-head"><h3>답변</h3><button class="copy-btn" id="cq-copy" type="button">📋 복사</button></div>
        <div class="output" id="cq-output"></div>
        <div id="cq-sources" style="margin-top:14px;"></div>
      </div>
    </div>
  </div>
  <div class="panel" style="margin-bottom:18px;">
    <div style="padding:14px 18px 0;">
      <div style="font-size:15px;font-weight:800;color:#b45309;">⭐ 우수 사례 <span style="font-size:11px;font-weight:600;color:#64748b;">— 운영자가 선정한 신뢰도 높은 실제 사례</span></div>
    </div>
    <div class="body">
      <div id="cq-excellent" style="display:flex;flex-direction:column;gap:8px;"><div style="font-size:13px;color:#94a3b8;">불러오는 중…</div></div>
    </div>
  </div>
  <div class="panel" style="margin-bottom:18px;">
    <div style="padding:14px 18px 0;">
      <div style="font-size:15px;font-weight:800;color:#7c3aed;">📝 사례 공유 <span style="font-size:11px;font-weight:600;color:#64748b;">— 실제 인수·고지·보상 사례 등록 시 +10P · 검수 후 삼따AI 답변에 반영됩니다</span></div>
    </div>
    <div class="body">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <select id="sc-category" style="min-width:120px;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;color:#0f172a;"><option value="underwrite">인수심사</option><option value="disclosure">고지</option><option value="claim">보상</option></select>
        <input id="sc-disease" placeholder="질병/사유 (예: 갑상선암)" style="flex:1;min-width:130px;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;">
        <input id="sc-insurer" placeholder="보험사 (예: 삼성생명)" style="flex:1;min-width:120px;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;">
        <input id="sc-result" placeholder="결과 (예: 부담보 5년 / 거절)" style="flex:1;min-width:150px;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;">
      </div>
      <textarea id="sc-summary" placeholder="사례 요약 — 개인정보(이름·연락처 등)는 빼고 작성해주세요."></textarea>
      <div class="row">
        <button class="gen-btn" id="sc-submit" type="button" style="background:linear-gradient(135deg,#7c3aed,#a855f7);">＋ 사례 등록 (+10P)</button>
        <span class="hint" id="sc-hint">로그인 필요</span>
      </div>
      <div class="err" id="sc-err"></div>
    </div>
  </div>
  <div class="panel">
    <div class="modes">${tabsHtml}</div>
    <div class="body">
      <textarea id="ai-input" placeholder="${esc(modes[0].placeholder)}"></textarea>
      <div class="row">
        <button class="gen-btn" id="ai-gen" type="button">✨ 생성하기</button>
        <span class="hint" id="ai-hint">무료 베타 · 1일 20회</span>
      </div>
      <div class="err" id="ai-err"></div>
      <div class="out-wrap" id="ai-out-wrap">
        <div class="out-head"><h3>결과</h3><button class="copy-btn" id="ai-copy" type="button">📋 복사</button></div>
        <div class="output" id="ai-output"></div>
      </div>
      <p class="note">${ready ? '' : '⚠️ 현재 AI 키 설정 대기 중입니다. 설정 완료 후 바로 이용 가능합니다.<br>'}본 도구는 일반 정보·실무 보조용이며, 생성 결과의 정확성을 보장하지 않습니다. 구체적 보장·법률·세무는 약관·전문가 확인이 우선입니다. · <a href="/disclaimer.html">면책조항</a></p>
    </div>
  </div>
  <div class="foot"><a href="/">← InsureConnect 홈</a></div>
</div>
</div>
<script>
(function(){
  var PH=${modeData};
  var mode='${modes[0].id}';
  var input=document.getElementById('ai-input');
  var err=document.getElementById('ai-err');
  var outWrap=document.getElementById('ai-out-wrap');
  var output=document.getElementById('ai-output');
  var gen=document.getElementById('ai-gen');
  var hint=document.getElementById('ai-hint');
  document.querySelectorAll('.mode-tab').forEach(function(t){
    t.addEventListener('click',function(){
      document.querySelectorAll('.mode-tab').forEach(function(x){x.classList.remove('active');});
      t.classList.add('active'); mode=t.dataset.mode; input.placeholder=PH[mode]||''; input.focus();
    });
  });
  document.getElementById('ai-copy').addEventListener('click',function(){
    navigator.clipboard&&navigator.clipboard.writeText(output.textContent).then(function(){
      var b=document.getElementById('ai-copy');var s=b.textContent;b.textContent='✅ 복사됨';setTimeout(function(){b.textContent=s;},1500);
    });
  });
  gen.addEventListener('click',async function(){
    var val=(input.value||'').trim();
    err.textContent='';
    if(!val){err.textContent='내용을 입력해주세요.';return;}
    gen.disabled=true; var orig=gen.innerHTML; gen.innerHTML='<span class="spin"></span>생성 중…';
    try{
      var res=await fetch('/api/ai/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:mode,input:val})});
      var d=await res.json();
      if(!res.ok){ err.textContent=d.error||'생성에 실패했습니다.'; }
      else{ output.textContent=d.text; outWrap.style.display='block'; outWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
        if(typeof d.remaining==='number'){ hint.textContent='무료 베타 · 오늘 '+d.remaining+'회 남음'; } }
    }catch(e){ err.textContent='네트워크 오류입니다. 잠시 후 다시 시도해주세요.'; }
    finally{ gen.disabled=false; gen.innerHTML=orig; }
  });

  // 사례 기반 질문 (RAG)
  var cqAsk=document.getElementById('cq-ask');
  if(cqAsk){
    var cqInput=document.getElementById('cq-input'), cqErr=document.getElementById('cq-err'),
        cqOutWrap=document.getElementById('cq-out-wrap'), cqOut=document.getElementById('cq-output'),
        cqEv=document.getElementById('cq-evidence'), cqHint=document.getElementById('cq-hint'),
        cqSrc=document.getElementById('cq-sources'),
        cqConv=document.getElementById('cq-conv'), cqConvLabel=document.getElementById('cq-conv-label');
    var cqHistory=[], cqLastQ='';
    var _CAT={underwrite:'인수',disclosure:'고지',claim:'보상'};
    function _escc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(x){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]);});}
    function _caseCard(c){return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:var(--bg,#f8fafc);"><div style="font-size:13px;color:var(--txt-hi,#0f172a);"><span style="font-size:10.5px;font-weight:800;color:#1a3de8;background:rgba(26,61,232,0.12);padding:1px 7px;border-radius:999px;">'+(_CAT[c.category]||'사례')+'</span> <b>'+_escc(c.disease||'')+'</b>'+(c.insurer?' · '+_escc(c.insurer):'')+(c.age?' · '+c.age+'세':'')+(c.elapsed_period?' · '+_escc(c.elapsed_period):'')+'</div>'+(c.result?'<div style="font-size:12.5px;color:#16a34a;font-weight:700;margin-top:4px;">→ '+_escc(c.result)+'</div>':'')+(c.summary?'<div style="font-size:12.5px;color:var(--txt-mid,#475569);margin-top:4px;line-height:1.55;">'+_escc(c.summary)+'</div>':'')+'</div>';}
    window.cqReset=function(){ cqHistory=[]; cqLastQ=''; if(cqConv)cqConv.style.display='none'; if(cqOutWrap)cqOutWrap.style.display='none'; if(cqInput){cqInput.value='';cqInput.focus();} };
    window.cqMore=async function(){ if(!cqLastQ)return; var btn=document.getElementById('cq-more-btn'); if(btn){btn.disabled=true;btn.textContent='불러오는 중…';} try{ var r=await fetch('/api/cases?q='+encodeURIComponent(cqLastQ)+'&limit=20'); var j=await r.json(); var arr=(j&&j.cases)||[]; var box=document.getElementById('cq-more-list'); if(box) box.innerHTML=arr.length?arr.map(_caseCard).join(''):'<div style="font-size:12.5px;color:#94a3b8;">관련 사례가 더 없습니다.</div>'; if(btn)btn.style.display='none'; }catch(e){ if(btn){btn.disabled=false;btn.textContent='🔎 관련 사례 더 보기';} } };
    document.getElementById('cq-copy').addEventListener('click',function(){
      navigator.clipboard&&navigator.clipboard.writeText(cqOut.textContent).then(function(){
        var b=document.getElementById('cq-copy');var s=b.textContent;b.textContent='✅ 복사됨';setTimeout(function(){b.textContent=s;},1500);
      });
    });
    function cqChip(label,color){ return '<span style="font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;background:'+color+'1f;color:'+color+';border:1px solid '+color+'55;">'+label+'</span>'; }
    cqAsk.addEventListener('click',async function(){
      var q=(cqInput.value||'').trim(); cqErr.textContent='';
      if(!q){ cqErr.textContent='질문을 입력해주세요.'; return; }
      cqAsk.disabled=true; var o=cqAsk.innerHTML; cqAsk.innerHTML='<span class="spin"></span>사례 검색·분석 중…';
      try{
        var res=await fetch('/api/cases/ask',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({question:q, history:cqHistory.slice(-3)})});
        var d=await res.json();
        if(res.status===401){ cqErr.innerHTML='로그인 후 이용할 수 있어요. <a href="/api/auth/kakao/login" style="color:#1a3de8;font-weight:700;">카카오 로그인 →</a>'; }
        else if(!res.ok){ cqErr.textContent=d.error||'답변 생성 실패'; }
        else{
          cqOut.textContent=d.answer; var ev=d.evidence||{}; var chips=[];
          if(ev.case_count>0) chips.push(cqChip('📚 근거 사례 '+ev.case_count+'건','#1a3de8'));
          if(ev.coverage_count) chips.push(cqChip('📑 담보 '+ev.coverage_count+'건','#0ea5e9'));
          if(ev.approve) chips.push(cqChip('✅ 가입/지급 '+ev.approve,'#16a34a'));
          if(ev.reject) chips.push(cqChip('❌ 거절/제한 '+ev.reject,'#dc2626'));
          if(ev.insurers&&ev.insurers.length) chips.push(cqChip('🏢 '+ev.insurers.slice(0,4).join(', '),'#7c3aed'));
          cqEv.innerHTML=chips.join('');
          if(cqSrc){ var ss=d.sources||[]; if(ss.length){ cqSrc.innerHTML='<div style="font-size:13px;font-weight:800;color:var(--txt-hi,#0f172a);margin-bottom:8px;">📚 이 답변의 근거 사례 '+ss.length+'건</div>'+ss.map(_caseCard).join('')+'<button type="button" id="cq-more-btn" onclick="cqMore()" style="margin-top:4px;background:rgba(26,61,232,0.08);border:1px solid rgba(26,61,232,0.25);color:#1a3de8;font-weight:700;font-size:12.5px;border-radius:9px;padding:8px 12px;cursor:pointer;">🔎 관련 사례 더 보기</button><div id="cq-more-list" style="margin-top:8px;"></div>'; } else { cqSrc.innerHTML=''; } }
          cqOutWrap.style.display='block'; cqOutWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
          if(d.points_used){ cqHint.textContent='⭐ 포인트 '+d.points_used+'P 사용 (무료 한도 초과)'; cqHint.style.color='#b45309'; }
          else if(typeof d.remaining==='number') cqHint.textContent='오늘 '+d.remaining+'회 남음';
          cqHistory.push({q:q, a:d.answer}); if(cqHistory.length>5) cqHistory=cqHistory.slice(-5); cqLastQ=q;
          if(cqConv){ cqConv.style.display='flex'; if(cqConvLabel) cqConvLabel.textContent='💬 이어지는 대화 ('+cqHistory.length+') — 후속 질문을 입력하세요'; }
          cqInput.value='';
        }
      }catch(e){ cqErr.textContent='네트워크 오류입니다. 잠시 후 다시 시도해주세요.'; }
      finally{ cqAsk.disabled=false; cqAsk.innerHTML=o; }
    });
    // v2.12.0: 홈 위젯에서 ?q= 로 들어온 질문 자동 입력·실행 ("바로 이용")
    try{
      var _hq=new URLSearchParams(location.search).get('q');
      if(_hq && _hq.trim()){ cqInput.value=_hq.trim().slice(0,200); setTimeout(function(){ try{ cqAsk.click(); cqInput.scrollIntoView({behavior:'smooth',block:'center'}); }catch(_){} }, 350); }
    }catch(_){}
    // v2.12.5(B): 우수 사례 큐레이션 로드
    (function(){ var box=document.getElementById('cq-excellent'); if(!box) return; fetch('/api/cases?excellent=1&limit=6').then(function(r){return r.json();}).then(function(j){ var arr=(j&&j.cases)||[]; box.innerHTML=arr.length?arr.map(_caseCard).join(''):'<div style="font-size:13px;color:#94a3b8;">아직 선정된 우수 사례가 없습니다. 좋은 사례를 공유해보세요!</div>'; }).catch(function(){ box.innerHTML='<div style="font-size:13px;color:#94a3b8;">불러오지 못했습니다.</div>'; }); })();
  }

  // 사례 공유 (삼따AI 내 등록 → +10P)
  var scSubmit=document.getElementById('sc-submit');
  if(scSubmit){
    scSubmit.addEventListener('click',async function(){
      var get=function(id){return (document.getElementById(id)||{}).value||'';};
      var summary=get('sc-summary').trim(), disease=get('sc-disease').trim();
      var err=document.getElementById('sc-err'), hint=document.getElementById('sc-hint');
      err.textContent='';
      if(!summary&&!disease){ err.textContent='질병/사유 또는 사례 요약을 입력해주세요.'; return; }
      scSubmit.disabled=true; var o=scSubmit.innerHTML; scSubmit.innerHTML='<span class="spin"></span>등록 중…';
      try{
        var res=await fetch('/api/cases',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({category:get('sc-category'),disease:disease,insurer:get('sc-insurer'),result:get('sc-result'),summary:summary})});
        var d=await res.json();
        if(res.status===401){ err.innerHTML='로그인 후 등록할 수 있어요. <a href="/api/auth/kakao/login" style="color:#1a3de8;font-weight:700;">카카오 로그인 →</a>'; }
        else if(!res.ok){ err.textContent=d.error||'등록 실패'; }
        else{ hint.textContent='✅ 접수 — 검수 후 반영 · +10P 지급'; hint.style.color='#16a34a';
          ['sc-disease','sc-insurer','sc-result','sc-summary'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';}); }
      }catch(e){ err.textContent='네트워크 오류입니다. 잠시 후 다시 시도해주세요.'; }
      finally{ scSubmit.disabled=false; scSubmit.innerHTML=o; }
    });
  }
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120, s-maxage=300' },
  });
};
