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
<title>AI 보험비서 — 보험설계사를 위한 AI 도구 | InsureConnect</title>
<meta name="description" content="보험설계사를 위한 AI 도구. 상담 스크립트·마케팅 문구·보장분석 요약·보험 개념 설명을 AI가 즉시 생성합니다.">
<meta name="robots" content="noindex,nofollow">
<link rel="canonical" href="${SITE}/ai">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="AI 보험비서 — 보험설계사를 위한 AI 도구">
<meta property="og:description" content="상담 스크립트·마케팅 문구·보장분석·보험 개념을 AI가 즉시 생성">
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
  <span class="badge">BETA · 보험산업 특화 AI</span>
  <h1>🤖 AI 보험비서</h1>
  <p>상담 스크립트 · 마케팅 문구 · 보장분석 · 보험 개념을 AI가 즉시 생성</p>
</header>
<div class="wrap">
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
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120, s-maxage=300' },
  });
};
