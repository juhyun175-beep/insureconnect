/**
 * v2.7.4: 마이페이지 — GET /me (로그인 필수)
 *   내 정보·등급 / 카톡 알림 on·off / 내 글·댓글
 */
import { getUserFromRequest } from './_lib/auth.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmt = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const k = new Date(d.getTime() + 9 * 3600000); return `${k.getUTCFullYear()}.${String(k.getUTCMonth() + 1).padStart(2, '0')}.${String(k.getUTCDate()).padStart(2, '0')}`; };
const roleInfo = (role) => role === 'admin' ? { t: '운영자', c: '#dc2626', b: '#fee2e2' }
  : role === 'premium' ? { t: '프리미엄', c: '#b45309', b: '#fef3c7' }
  : role === 'certified' ? { t: '인증설계사', c: '#1a3de8', b: '#dbeafe' }
  : { t: '일반회원', c: '#475569', b: '#f1f5f9' };

const shell = (inner) => `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8"><meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>마이페이지 | InsureConnect</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#0f172a;background:#f9fafb;margin:0;line-height:1.6}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:760px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:0 16px 60px}
.card{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.04);padding:22px 22px;margin-bottom:16px}
.card h2{font-size:15px;margin:0 0 14px;color:#334155}
.prof{display:flex;align-items:center;gap:14px}
.prof-img{width:60px;height:60px;border-radius:50%;object-fit:cover;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:28px}
.prof-name{font-size:19px;font-weight:800}
.bdg{display:inline-block;font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px;margin-left:6px;vertical-align:middle}
.prof-sub{font-size:12.5px;color:#94a3b8;margin-top:3px}
.tg{display:flex;align-items:center;justify-content:space-between;gap:12px}
.tg-label{font-size:14px;font-weight:700}.tg-desc{font-size:12px;color:#94a3b8;margin-top:2px}
.switch{position:relative;width:50px;height:28px;flex-shrink:0}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;inset:0;background:#cbd5e1;border-radius:999px;transition:.2s;cursor:pointer}
.slider::before{content:"";position:absolute;width:22px;height:22px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
input:checked + .slider{background:#1a3de8}
input:checked + .slider::before{transform:translateX(22px)}
.lst{display:flex;flex-direction:column}
.row{display:flex;align-items:center;gap:8px;padding:11px 2px;border-bottom:1px solid #f1f5f9;text-decoration:none;color:#1f2937}
.row:last-child{border-bottom:none}
.row-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600}
.row-m{font-size:11px;color:#94a3b8;white-space:nowrap}
.empty{color:#94a3b8;font-size:13px;padding:12px 2px}
.back{display:inline-block;color:#1a3de8;text-decoration:none;font-weight:700;font-size:14px}
.tabs{display:flex;gap:8px;margin-bottom:12px}
.tab{flex:1;text-align:center;padding:9px;border-radius:9px;background:#f1f5f9;color:#475569;font-weight:700;font-size:13px;cursor:pointer;border:none}
.tab.active{background:#1a3de8;color:#fff}
.login-cta{display:block;text-align:center;background:#FEE500;color:#191600;padding:13px;border-radius:11px;font-weight:800;text-decoration:none}
.note{font-size:11.5px;color:#94a3b8;margin-top:10px}
@media(max-width:640px){.wrap{padding:0 12px 50px}}
</style></head>
<body>
<nav class="crumb"><a href="/">← 홈</a> &raquo; <span>마이페이지</span></nav>
<div class="wrap">${inner}</div>
<script async src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" crossorigin="anonymous" onload="try{if(window.Kakao&&!window.Kakao.isInitialized())window.Kakao.init('ca87154629fc282e5202c66822514bd4');}catch(e){}"></script>
</body></html>`;

export const onRequestGet = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) {
    const inner = `<div class="card" style="text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🔒</div>
      <h2 style="text-align:center">로그인이 필요합니다</h2>
      <p style="color:#64748b;font-size:13.5px;margin:0 0 16px">마이페이지는 로그인 후 이용할 수 있어요.</p>
      <a class="login-cta" href="/api/auth/kakao/login">💬 카카오로 로그인</a>
    </div>`;
    return new Response(shell(inner), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const m = await env.DB.prepare(
    `SELECT nickname, profile_image, role, created_at, last_login, alert_optin FROM ic_members WHERE id = ?`
  ).bind(user.id).first().catch(() => null);
  const ri = roleInfo(m?.role || user.role);
  const optin = (m?.alert_optin === 1);

  const posts = (await env.DB.prepare(
    `SELECT id, title, created_at, comment_count FROM ic_board_posts WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT 30`
  ).bind(user.id).all().catch(() => ({ results: [] }))).results || [];
  const comments = (await env.DB.prepare(
    `SELECT c.id, c.content, c.created_at, c.post_id, p.title AS post_title
     FROM ic_board_comments c LEFT JOIN ic_board_posts p ON p.id = c.post_id
     WHERE c.user_id = ? AND c.deleted = 0 ORDER BY c.created_at DESC LIMIT 30`
  ).bind(user.id).all().catch(() => ({ results: [] }))).results || [];

  const postsHtml = posts.length ? posts.map(p =>
    `<a class="row" href="/board/${p.id}"><span class="row-t">${esc(p.title)}</span>${p.comment_count ? `<span class="row-m" style="color:#f97316;font-weight:800">[${p.comment_count}]</span>` : ''}<span class="row-m">${fmt(p.created_at)}</span></a>`
  ).join('') : '<div class="empty">작성한 글이 없습니다.</div>';

  const commentsHtml = comments.length ? comments.map(c =>
    `<a class="row" href="/board/${c.post_id}"><span class="row-t">${esc((c.content || '').slice(0, 60))}</span><span class="row-m">${esc((c.post_title || '글').slice(0, 14))} · ${fmt(c.created_at)}</span></a>`
  ).join('') : '<div class="empty">작성한 댓글이 없습니다.</div>';

  const inner = `
  <div class="card">
    <div class="prof">
      <div class="prof-img">${m?.profile_image ? `<img src="${esc(m.profile_image)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : '👤'}</div>
      <div>
        <div class="prof-name">${esc(m?.nickname || user.nickname || '회원')}<span class="bdg" style="color:${ri.c};background:${ri.b}">${ri.t}</span></div>
        <div class="prof-sub">가입 ${fmt(m?.created_at)}${m?.last_login ? ` · 최근접속 ${fmt(m.last_login)}` : ''}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>📈 내 성장</h2>
    <div id="growth-box" style="font-size:13px;color:#64748b">불러오는 중…</div>
  </div>

  <div class="card">
    <h2>⭐ 내 포인트</h2>
    <div id="pt-box" style="font-size:13px;color:#64748b">불러오는 중…</div>
    <p class="note">사례 등록 +10 · 승인 +20 · 우수 +50 · 글 +5 · 댓글 +2 · 삼따AI 추가질문 −5 · 공고 상단노출 −50 · 100P 인증설계사 / 500P 프리미엄 자동 승급</p>
  </div>

  <div class="card">
    <h2>🛒 포인트 상점</h2>
    <div id="shop-box" style="font-size:13px;color:#64748b">불러오는 중…</div>
    <p class="note">모은 포인트로 혜택을 교환하세요. 포인트는 사례 공유·승인·게시판 활동·카톡 사례수집으로 쌓입니다.</p>
  </div>

  <div class="card">
    <h2>🎟️ 공고 할인권</h2>
    <div id="coupon-box" style="font-size:13px;color:#64748b">불러오는 중…</div>
    <p class="note">포인트로 공고 등록 할인권을 교환하세요. <b>공고 작성 시 등록가에서 자동 할인</b>됩니다. 유효기간 14일 · 1공고 1장 · 환불·양도 불가.</p>
  </div>

  <div class="card" id="mypost-section">
    <h2>🔝 내 공고 상단노출</h2>
    <div id="mypost-box" style="font-size:13px;color:#64748b">불러오는 중…</div>
    <p class="note">5만원 게시 <b>승인 시 3일간 무료 상단노출</b> 제공 · 이후 <b>50P로 7일씩 연장</b>합니다. 포인트는 삼따AI 사례 공유·승인으로 적립돼요.</p>
  </div>

  <div class="card">
    <h2>🔔 알림 설정</h2>
    <div class="tg">
      <div>
        <div class="tg-label">카카오톡 알림 받기</div>
        <div class="tg-desc">새 공고·소식, 내 글 댓글 알림을 카카오톡으로 받기</div>
      </div>
      <label class="switch"><input type="checkbox" id="optin" ${optin ? 'checked' : ''}><span class="slider"></span></label>
    </div>
    <div class="note" id="optin-note">${optin ? '' : '※ 알림을 받으려면 로그인 시 「카카오톡 메시지」에 동의해야 합니다. 꺼져 있으면 재로그인 후 동의해 주세요.'}</div>
  </div>

  <div class="card">
    <h2>👥 동료 초대 — 가입하면 둘 다 포인트 🎁</h2>
    <div id="ref-box" style="font-size:13px;color:#64748b">불러오는 중…</div>
  </div>

  <div class="card">
    <div class="tabs">
      <button class="tab active" data-t="posts" type="button">내 글 (${posts.length})</button>
      <button class="tab" data-t="comments" type="button">내 댓글 (${comments.length})</button>
    </div>
    <div class="lst" id="lst-posts">${postsHtml}</div>
    <div class="lst" id="lst-comments" style="display:none">${commentsHtml}</div>
  </div>

  <a class="back" href="/board">자유게시판 가기 →</a>

  <script>
  (function(){
    var tabs=document.querySelectorAll('.tab');
    tabs.forEach(function(t){ t.addEventListener('click',function(){
      tabs.forEach(function(x){x.classList.remove('active');}); t.classList.add('active');
      var k=t.dataset.t;
      document.getElementById('lst-posts').style.display = k==='posts'?'':'none';
      document.getElementById('lst-comments').style.display = k==='comments'?'':'none';
    });});
    var opt=document.getElementById('optin'), note=document.getElementById('optin-note');
    opt.addEventListener('change',function(){
      var on=opt.checked; opt.disabled=true;
      fetch('/api/me/alert',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({optin:on})})
        .then(function(r){return r.json();}).then(function(d){
          if(!d||!d.ok){ opt.checked=!on; alert('변경 실패'); }
          else { note.textContent = on ? '✓ 알림을 받습니다.' : '알림을 받지 않습니다.'; }
        }).catch(function(){ opt.checked=!on; alert('네트워크 오류'); })
        .finally(function(){ opt.disabled=false; });
    });
  })();

  // v2.8.0: 추천 초대 현황
  (function(){
    var box=document.getElementById('ref-box'); if(!box) return;
    fetch('/api/me/referral',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){
      if(!d||!d.ok){ box.textContent='추천 정보를 불러오지 못했습니다.'; return; }
      var nextTxt = d.next ? ('<b>'+(d.next.role==='premium'?'프리미엄':'인증설계사')+'</b>까지 <b>'+d.next.need+'명</b> 남음') : '최고 등급 달성 🎉';
      box.innerHTML =
        '<div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #dbeafe;border-radius:10px;padding:9px 11px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#1a3de8;">🎁 친구가 가입하면 <b>나 +50P</b> · <b>친구 +30P</b> 즉시 적립</div>'
        + '<p style="margin:0 0 10px;line-height:1.6">내 초대로 가입한 동료 <b style="color:#1a3de8;font-size:16px">'+(d.count||0)+'명</b><br><span style="font-size:12px">'+nextTxt+'</span></p>'
        + '<div style="display:flex;gap:6px;margin-bottom:8px">'
        + '<input id="ref-link" readonly value="'+d.link+'" style="flex:1;min-width:0;border:1.5px solid #e2e8f0;border-radius:9px;padding:9px 11px;font-size:12.5px;color:#334155">'
        + '<button id="ref-copy" type="button" style="background:#1a3de8;color:#fff;border:none;border-radius:9px;font-weight:800;font-size:13px;padding:0 14px;cursor:pointer">복사</button>'
        + '</div>'
        + '<button id="ref-share" type="button" style="width:100%;background:#FEE500;color:#191600;border:none;border-radius:10px;font-weight:800;font-size:13.5px;padding:11px;cursor:pointer">💬 동료에게 초대 보내기</button>'
        + '<p style="font-size:11px;color:#94a3b8;margin:10px 0 0">적립 포인트는 삼따AI 질문권·공고 상단노출권으로 사용. 추가로 3명 초대 시 인증설계사, 10명 시 프리미엄 자동 승급.</p>';
      var link=d.link;
      document.getElementById('ref-copy').addEventListener('click',function(){
        var b=document.getElementById('ref-copy');
        (navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(function(){ b.textContent='✓'; setTimeout(function(){b.textContent='복사';},1500); }).catch(function(){ var inp=document.getElementById('ref-link'); inp.select(); try{document.execCommand('copy'); b.textContent='✓'; setTimeout(function(){b.textContent='복사';},1500);}catch(e){} });
      });
      document.getElementById('ref-share').addEventListener('click',function(){
        try{
          if(window.Kakao&&window.Kakao.Share&&window.Kakao.isInitialized&&window.Kakao.isInitialized()){
            window.Kakao.Share.sendDefault({objectType:'feed',
              content:{title:'InsureConnect 초대',description:'가입하면 30P 즉시 적립! 사례 기반 삼따AI·보험사 전산·채용까지 — 설계사 통합 허브.',imageUrl:'https://insureconnect.co.kr/logo-full.png',link:{mobileWebUrl:link,webUrl:link}},
              buttons:[{title:'초대 수락하고 시작',link:{mobileWebUrl:link,webUrl:link}}]});
            return;
          }
        }catch(e){}
        if(navigator.share){ navigator.share({title:'InsureConnect 초대', text:'인슈어커넥트 가입하면 30P 적립! 설계사 통합 허브', url:link}).catch(function(){}); }
        else { (navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(function(){alert('초대 링크가 복사되었습니다. 동료에게 공유하세요.');}).catch(function(){ window.prompt('초대 링크', link); }); }
      });
    }).catch(function(){ box.textContent='추천 정보를 불러오지 못했습니다.'; });
  })();

  // 포인트 내역 (window.__reloadPt 로 노출 — 상단노출 결제 후 갱신)
  window.__reloadPt=function(){
    var box=document.getElementById('pt-box'); if(!box) return;
    var RL={case_submit:'사례 등록',case_approve:'사례 승인',case_excellent:'⭐ 우수 사례',case_extract:'🤖 카톡 사례 자동등록',ai_extra:'삼따AI 추가질문',feature_posting:'🔝 공고 상단노출',board_post:'✍️ 글 작성',board_comment:'💬 댓글 작성',shop_ai10:'🛒 질문권 10회 교환',shop_ai30:'🛒 질문권 30회 교환',shop_feature1:'🛒 상단노출권 교환',feature_credit_use:'🔝 상단노출권 사용',referral_invite:'🎁 친구 초대 보상',referral_welcome:'🎁 가입 웰컴'};
    fetch('/api/points/history',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){
      if(!d||d.points==null){ box.textContent='포인트 정보를 불러오지 못했습니다.'; return; }
      var log=(d.log||[]).map(function(l){
        var pos=l.delta>=0; var dt=(l.created_at||'').slice(0,10);
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 2px;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#334155;">'+(RL[l.reason]||(String(l.reason||'').indexOf('shop_coupon_')===0?'🎟️ 공고 할인권 교환':(l.reason||''))) +'</span><span style="font-size:13px;font-weight:800;color:'+(pos?'#16a34a':'#dc2626')+'">'+(pos?'+':'')+l.delta+'P <span style="color:#94a3b8;font-weight:500;font-size:11px;margin-left:4px;">'+dt+'</span></span></div>';
      }).join('');
      box.innerHTML='<div style="font-size:30px;font-weight:900;color:#b45309;margin-bottom:6px;">'+Number(d.points).toLocaleString()+'<span style="font-size:16px;">P</span></div>'
        +(log?'<div style="margin-top:6px;">'+log+'</div>':'<div class="empty">아직 포인트 내역이 없습니다. 삼따AI에서 사례를 공유해보세요.</div>');
    }).catch(function(){ box.textContent='포인트 정보를 불러오지 못했습니다.'; });
  };
  window.__reloadPt();

  // v2.23.0: 내 성장 — 등급 진행 + 사례 기여 순위 (성장 백로그 v2 #10, 4/8 리더보드 개인화 surface)
  (function(){
    var box=document.getElementById('growth-box'); if(!box) return;
    var ROLE='${esc(m?.role || user.role || 'member')}';
    Promise.all([
      fetch('/api/points/history',{credentials:'same-origin'}).then(function(r){return r.json();}).catch(function(){return null;}),
      fetch('/api/cases/contributors',{credentials:'same-origin'}).then(function(r){return r.json();}).catch(function(){return null;})
    ]).then(function(res){
      var pts=(res[0]&&res[0].points)||0;
      var me=(res[1]&&res[1].me)||null;
      var gradeT=ROLE==='admin'?'운영자':ROLE==='premium'?'프리미엄':ROLE==='certified'?'인증설계사':'일반회원';
      var nextTxt, base, target;
      if(ROLE==='premium'||ROLE==='admin'){ nextTxt='최고 등급 달성 🎉'; base=0; target=1; }
      else if(ROLE==='certified'){ nextTxt='프리미엄까지 <b>'+Math.max(0,500-pts)+'P</b>'; base=100; target=500; }
      else { nextTxt='인증설계사까지 <b>'+Math.max(0,100-pts)+'P</b>'; base=0; target=100; }
      var pctw=(ROLE==='premium'||ROLE==='admin')?100:Math.max(0,Math.min(100,Math.round((pts-base)/(target-base)*100)));
      var contrib=(me&&me.n>0)
        ? '📚 사례 기여 <b style="color:#1a3de8">'+me.n+'건</b> · 순위 <b style="color:#1a3de8">'+(me.rank?me.rank+'위':'순위권 밖')+'</b>'
        : '📚 아직 사례 기여가 없어요 — <a href="/ai#share" style="color:#1a3de8;font-weight:700;">삼따AI에서 등록 +10P →</a>';
      box.innerHTML=
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:13.5px;font-weight:800;color:#334155">'+gradeT+'</span><span style="font-size:22px;font-weight:900;color:#b45309;margin-left:auto">'+Number(pts).toLocaleString()+'<span style="font-size:14px">P</span></span></div>'
        +'<div style="height:8px;background:#eef2f7;border-radius:99px;overflow:hidden;margin-bottom:5px"><div style="height:100%;width:'+pctw+'%;background:linear-gradient(90deg,#1a3de8,#7c3aed);transition:width .4s"></div></div>'
        +'<div style="font-size:12px;color:#64748b;margin-bottom:12px">'+nextTxt+'</div>'
        +'<div style="font-size:13px;color:#334155;padding-top:11px;border-top:1px solid #f1f5f9">'+contrib+'</div>';
    }).catch(function(){ box.textContent='성장 정보를 불러오지 못했습니다.'; });
  })();

  // v2.11.0: 내 공고 상단노출 (포인트 사용처)
  (function(){
    var box=document.getElementById('mypost-box'); if(!box) return;
    var ST={pending:['검수중','#b45309','#fef3c7'],approved:['게시중','#16a34a','#dcfce7'],rejected:['반려','#dc2626','#fee2e2']};
    function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]);});}
    function fmtUntil(s){ if(!s) return ''; var d=new Date(String(s).replace(' ','T')+'Z'); if(isNaN(d.getTime())) return ''; return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'); }
    function render(items, cost, credit){
      if(!items.length){ box.innerHTML='<div class="empty">직접 등록한 공고가 없습니다. 홈의 「내 공고 직접 등록」으로 채용·강의 공고를 올려보세요.</div>'; return; }
      box.innerHTML=items.map(function(it){
        var st=ST[it.status]||ST.pending; var typeL=it.type==='lecture'?'🎓':'💼';
        var right;
        if(it.featured){ right='<span style="font-size:11.5px;font-weight:800;color:#1a3de8;white-space:nowrap;flex-shrink:0">🔝 노출중 ~'+fmtUntil(it.featured_until)+'</span>'; }
        else if(it.status==='approved'){ var fl=credit>0?'🔝 노출권 사용':'🔝 상단노출 '+cost+'P'; var fbg=credit>0?'#16a34a':'#1a3de8'; right='<button class="feat-btn" data-type="'+it.type+'" data-id="'+it.id+'" style="background:'+fbg+';color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12px;padding:7px 11px;cursor:pointer;white-space:nowrap;flex-shrink:0">'+fl+'</button>'; }
        else { right='<span style="font-size:11.5px;color:#94a3b8;white-space:nowrap;flex-shrink:0">'+st[0]+'</span>'; }
        return '<div style="padding:9px 2px;border-bottom:1px solid #f1f5f9;"><div style="display:flex;align-items:center;gap:9px;"><span style="font-size:11px;font-weight:800;color:'+st[1]+';background:'+st[2]+';padding:2px 7px;border-radius:999px;white-space:nowrap;flex-shrink:0;">'+st[0]+'</span><span style="flex:1;min-width:0;font-size:13px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+typeL+' '+esc(it.title)+'</span>'+right+'</div><div style="font-size:11px;color:#94a3b8;margin-top:4px;">👁 조회 '+(it.views||0)+' · 📝 폼클릭 '+(it.form_clicks||0)+'</div></div>';
      }).join('');
      box.querySelectorAll('.feat-btn').forEach(function(b){
        b.addEventListener('click',function(){
          if(!confirm(credit>0?'보유한 상단노출권 1장으로 이 공고를 7일간 최상단 노출할까요? (포인트 차감 없음)':cost+'P를 사용해 이 공고를 7일간 목록 맨 위에 노출할까요?')) return;
          b.disabled=true; var old=b.textContent; b.textContent='처리중…';
          fetch('/api/postings/feature',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({type:b.dataset.type,id:+b.dataset.id})})
            .then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});})
            .then(function(o){
              if(o.s===200&&o.j.ok){ alert(o.j.used_credit?'✅ 상단노출권 사용! 7일 노출 · 남은 권 '+(o.j.feature_credit||0)+'장':'✅ 상단노출 적용! 남은 포인트 '+o.j.remaining+'P'); load(); if(window.__reloadPt)window.__reloadPt(); if(window.__reloadShop)window.__reloadShop(); }
              else if(o.s===402){ alert('포인트가 부족합니다. (보유 '+(o.j.points||0)+'P / 필요 '+o.j.need+'P) — 삼따AI에서 사례를 공유하면 적립돼요.'); b.disabled=false; b.textContent=old; }
              else { alert((o.j&&o.j.error)||'처리 실패'); b.disabled=false; b.textContent=old; }
            }).catch(function(){ alert('네트워크 오류'); b.disabled=false; b.textContent=old; });
        });
      });
    }
    function load(){ fetch('/api/postings/mine',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){ if(!d||!d.ok){ box.textContent='공고를 불러오지 못했습니다.'; return; } render(d.items||[], d.cost||50, d.feature_credit||0); }).catch(function(){ box.textContent='공고를 불러오지 못했습니다.'; }); }
    window.__reloadMyPost=load; load();
  })();

  // v2.13.9: 포인트 상점 (확장 — 질문권 10/30회 · 상단노출권)
  (function(){
    var box=document.getElementById('shop-box'); if(!box) return;
    function row(ico,title,desc,right){ return '<div style="display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid #f1f5f9;"><span style="font-size:22px;flex-shrink:0;">'+ico+'</span><div style="flex:1;min-width:0;"><div style="font-size:13.5px;font-weight:800;color:#334155;">'+title+'</div><div style="font-size:11.5px;color:#94a3b8;line-height:1.4;">'+desc+'</div></div>'+right+'</div>'; }
    function buyBtn(it,cost,points){ return points>=cost
      ? '<button class="shop-buy" data-item="'+it+'" data-cost="'+cost+'" style="background:#1a3de8;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12.5px;padding:8px 14px;cursor:pointer;white-space:nowrap;flex-shrink:0;">'+cost+'P 교환</button>'
      : '<button disabled style="background:#cbd5e1;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12.5px;padding:8px 14px;white-space:nowrap;flex-shrink:0;cursor:not-allowed;">'+cost+'P</button>'; }
    function render(points, bonus, credit){
      box.innerHTML =
        '<div style="font-size:12px;color:#475569;margin-bottom:10px;">보유 <b style="color:#b45309;">'+points+'P</b> · 질문권 <b style="color:#1a3de8;">'+bonus+'회</b> · 상단노출권 <b style="color:#1a3de8;">'+credit+'장</b></div>'
        + row('🤖','삼따AI 질문권 10회','무료 한도 초과 시 포인트(5P) 대신 사용',buyBtn('ai10',30,points))
        + row('🚀','삼따AI 질문권 30회 <span style="color:#16a34a;font-size:10.5px;font-weight:800;">특가 -15P</span>','자주 쓰면 더 이득 (10회 3개=90P → 75P)',buyBtn('ai30',75,points))
        + row('🔝','공고 상단노출 7일권 <span style="color:#16a34a;font-size:10.5px;font-weight:800;">특가 -10P</span>','구매 후 「내 공고」에서 무료로 노출(직접 50P → 권 40P)',buyBtn('feature1',40,points))
        + '<div style="opacity:.5;">'+row('⭐','프리미엄 체험 · 프로필 뱃지','곧 추가됩니다','<span style="font-size:11px;color:#94a3b8;white-space:nowrap;">준비중</span>')+'</div>';
      box.querySelectorAll('.shop-buy').forEach(function(b){
        b.addEventListener('click',function(){
          var it=b.dataset.item, cost=+b.dataset.cost, old=b.textContent;
          var nm={ai10:'삼따AI 질문권 10회',ai30:'삼따AI 질문권 30회',feature1:'공고 상단노출 7일권'};
          if(!confirm(cost+'P로 '+(nm[it]||'상품')+'을(를) 교환할까요?')) return;
          b.disabled=true; b.textContent='처리중…';
          fetch('/api/points/redeem',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({item:it})})
            .then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});})
            .then(function(o){
              if(o.s===200&&o.j.ok){ alert('✅ 교환 완료! 남은 '+o.j.remaining+'P · 질문권 '+o.j.ai_bonus+'회 · 상단노출권 '+(o.j.feature_credit||0)+'장'); load(); if(window.__reloadPt)window.__reloadPt(); if(window.__reloadMyPost)window.__reloadMyPost(); }
              else if(o.s===402){ alert('포인트가 부족합니다. (보유 '+(o.j.points||0)+'P / 필요 '+o.j.need+'P)'); b.disabled=false; b.textContent=old; }
              else { alert((o.j&&o.j.error)||'교환 실패'); b.disabled=false; b.textContent=old; }
            }).catch(function(){ alert('네트워크 오류'); b.disabled=false; b.textContent=old; });
        });
      });
    }
    function load(){ fetch('/api/points/history',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){ if(!d){ box.textContent='불러오지 못했습니다.'; return; } render(d.points||0, d.ai_bonus||0, d.feature_credit||0); }).catch(function(){ box.textContent='불러오지 못했습니다.'; }); }
    window.__reloadShop=load; load();
  })();

  // v2.51.0: 공고 할인권 상점 (포인트 → 쿠폰 → 공고 등록 할인)
  (function(){
    var box=document.getElementById('coupon-box'); if(!box) return;
    function won(n){ return Number(n||0).toLocaleString('ko-KR'); }
    function row(ico,title,desc,right){ return '<div style="display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid #f1f5f9;"><span style="font-size:22px;flex-shrink:0;">'+ico+'</span><div style="flex:1;min-width:0;"><div style="font-size:13.5px;font-weight:800;color:#334155;">'+title+'</div><div style="font-size:11.5px;color:#94a3b8;line-height:1.4;">'+desc+'</div></div>'+right+'</div>'; }
    function buyBtn(key,cost,points){ return points>=cost
      ? '<button class="cpn-buy" data-item="'+key+'" data-cost="'+cost+'" style="background:#1a3de8;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12.5px;padding:8px 14px;cursor:pointer;white-space:nowrap;flex-shrink:0;">'+cost+'P 교환</button>'
      : '<button disabled style="background:#cbd5e1;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12.5px;padding:8px 14px;white-space:nowrap;flex-shrink:0;cursor:not-allowed;">'+cost+'P</button>'; }
    var AD_ICO={recruit:'💼',lecture:'🎓',meetup:'👥'};
    function render(d){
      var points=d.points||0;
      var owned=(d.coupons||[]).filter(function(c){return c.status==='active';});
      var sellable=(d.catalog||[]).filter(function(c){return c.ad_type==='recruit'||c.ad_type==='lecture'||c.ad_type==='meetup';}); // v2.58.0: 모임공고 출시 → 모임 할인권 공개
      var shopHtml=sellable.map(function(c){
        var desc='등록가 '+won(c.base)+'원 → <b style="color:#16a34a">'+won(c.final)+'원</b> ('+c.rate+'% 할인)';
        return row(AD_ICO[c.ad_type]||'🎟️', c.ad_label+' '+c.rate+'% 할인권', desc, buyBtn(c.key,c.cost,points));
      }).join('');
      var ownHtml = owned.length
        ? owned.map(function(c){
            var dl=Math.max(0,Math.ceil((new Date(String(c.expires_at).replace(' ','T')+'Z')-new Date())/86400000));
            return '<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-bottom:1px solid #f1f5f9;"><span style="font-size:11.5px;font-weight:800;color:#1a3de8;background:#eef2ff;padding:3px 8px;border-radius:999px;white-space:nowrap;">'+(AD_ICO[c.ad_type]||'🎟️')+' '+c.discount_rate+'%</span><span style="flex:1;min-width:0;font-size:12.5px;color:#334155;">'+((d.adLabel&&d.adLabel[c.ad_type])||c.ad_type)+' 할인권</span><span style="font-size:11px;color:#94a3b8;white-space:nowrap;">D-'+dl+'</span></div>';
          }).join('')
        : '<div class="empty" style="padding:10px 2px;color:#94a3b8;font-size:12.5px;">보유한 할인권이 없습니다.</div>';
      box.innerHTML =
        '<div style="font-size:12px;color:#475569;margin-bottom:10px;">보유 <b style="color:#b45309;">'+won(points)+'P</b></div>'
        + shopHtml
        + '<div style="margin:14px 0 6px;font-size:12.5px;font-weight:800;color:#334155;">🎟️ 보유 할인권 ('+owned.length+')</div>'
        + ownHtml;
      box.querySelectorAll('.cpn-buy').forEach(function(b){
        b.addEventListener('click',function(){
          var it=b.dataset.item, cost=+b.dataset.cost, old=b.textContent;
          if(!confirm(cost+'P로 할인권을 교환할까요? (유효기간 14일·환불 불가)')) return;
          b.disabled=true; b.textContent='처리중…';
          fetch('/api/coupons',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({item:it})})
            .then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});})
            .then(function(o){
              if(o.s===200&&o.j.ok){ alert('✅ 할인권 교환 완료! 남은 '+won(o.j.remaining)+'P. 공고 작성 시 적용하세요.'); load(); if(window.__reloadPt)window.__reloadPt(); }
              else if(o.s===402){ alert('포인트가 부족합니다. (보유 '+(o.j.points||0)+'P / 필요 '+o.j.need+'P)'); b.disabled=false; b.textContent=old; }
              else { alert((o.j&&o.j.error)||'교환 실패'); b.disabled=false; b.textContent=old; }
            }).catch(function(){ alert('네트워크 오류'); b.disabled=false; b.textContent=old; });
        });
      });
    }
    function load(){ fetch('/api/coupons',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){ if(!d||!d.ok){ box.textContent='불러오지 못했습니다.'; return; } render(d); }).catch(function(){ box.textContent='불러오지 못했습니다.'; }); }
    window.__reloadCoupons=load; load();
  })();
  </script>`;

  return new Response(shell(inner), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};
