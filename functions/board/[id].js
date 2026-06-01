/**
 * v2.3.0: 자유게시판 글 상세 — GET /board/{id}
 *   읽기 공개 / 댓글·삭제는 로그인(클라이언트 확인)
 */
import { seoCtaFooter } from '../_lib/seo-cta.js';
import { isBot } from '../_lib/bot.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmt = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const k = new Date(d.getTime() + 9 * 3600000); return `${k.getUTCFullYear()}.${String(k.getUTCMonth() + 1).padStart(2, '0')}.${String(k.getUTCDate()).padStart(2, '0')} ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`; };
const roleBadge = (role) => role === 'certified' ? '<span class="bdg bdg-cert">인증설계사</span>'
  : role === 'premium' ? '<span class="bdg bdg-prem">프리미엄</span>'
  : role === 'admin' ? '<span class="bdg bdg-admin">운영자</span>' : '';

export const onRequestGet = async ({ env, request, params }) => {
  const id = parseInt(params.id, 10);
  if (!id) return new Response('Not found', { status: 404 });

  const post = await env.DB.prepare(
    `SELECT p.id, p.user_id, p.nickname, p.title, p.content, p.view_count, p.comment_count, p.created_at, m.role AS author_role
     FROM ic_board_posts p LEFT JOIN ic_members m ON m.id = p.user_id
     WHERE p.id = ? AND p.deleted = 0`
  ).bind(id).first();
  if (!post) return new Response('Not found', { status: 404 });

  if (!isBot(request)) {
    env.DB.prepare(`UPDATE ic_board_posts SET view_count = view_count + 1 WHERE id = ?`).bind(id).run().catch(() => {});
  }
  const cs = await env.DB.prepare(
    `SELECT c.id, c.user_id, c.nickname, c.content, c.created_at, m.role AS author_role
     FROM ic_board_comments c LEFT JOIN ic_members m ON m.id = c.user_id
     WHERE c.post_id = ? AND c.deleted = 0 ORDER BY c.created_at ASC`
  ).bind(id).all();
  const comments = cs.results || [];

  const commentsHtml = comments.length ? comments.map(c => `
    <div class="cmt" data-uid="${c.user_id}" data-cid="${c.id}">
      <div class="cmt-head"><b>${esc(c.nickname || '회원')}</b>${roleBadge(c.author_role)}<span>${fmt(c.created_at)}</span><button class="cmt-report" type="button" data-cid="${c.id}">신고</button></div>
      <div class="cmt-body">${esc(c.content)}</div>
    </div>`).join('') : '<div class="cmt-empty">첫 댓글을 남겨보세요.</div>';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(post.title)} | 자유게시판 | InsureConnect</title>
<meta name="robots" content="noindex,follow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#0f172a;background:#f9fafb;margin:0;line-height:1.7}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:760px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:0 16px 60px}
article{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.04);padding:26px 24px}
article h1{font-size:22px;margin:0 0 10px;letter-spacing:-0.01em}
.meta{font-size:13px;color:#94a3b8;border-bottom:1px solid #f1f5f9;padding-bottom:14px;margin-bottom:18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.meta .share{margin-left:auto;color:#1a3de8;cursor:pointer;border:none;background:transparent;font-size:12.5px;font-weight:700;padding:0}
.meta .del{margin-left:8px;color:#dc2626;cursor:pointer;border:none;background:transparent;font-size:12.5px;display:none}
.meta .report{margin-left:8px;color:#b45309;cursor:pointer;border:none;background:transparent;font-size:12.5px;font-weight:700;padding:0}
.cmt-report{margin-left:auto;color:#b45309;background:none;border:none;font-size:11.5px;cursor:pointer;padding:0}
.content{white-space:pre-wrap;font-size:15.5px;color:#1f2937;word-break:break-word}
.back{display:inline-block;margin-top:22px;color:#1a3de8;text-decoration:none;font-weight:700}
.cmts{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.04);padding:20px 22px;margin-top:16px}
.cmts h2{font-size:15px;margin:0 0 14px}
.cmt{padding:12px 0;border-bottom:1px solid #f5f7fa}
.cmt-head{display:flex;gap:8px;font-size:12.5px;color:#94a3b8;margin-bottom:4px;align-items:center}.cmt-head b{color:#334155}
.bdg{display:inline-block;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px}
.bdg-cert{background:#dbeafe;color:#1a3de8}.bdg-prem{background:#fef3c7;color:#b45309}.bdg-admin{background:#fee2e2;color:#dc2626}
.cmt-body{white-space:pre-wrap;font-size:14.5px;color:#1f2937;word-break:break-word}
.cmt-empty{color:#94a3b8;font-size:13.5px;padding:8px 0}
.cmt-form{margin-top:16px;display:none}
.cmt-form textarea{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-family:inherit;font-size:14px;min-height:72px;resize:vertical}
.cmt-form textarea:focus{outline:none;border-color:#1a3de8}
.cmt-form .r{display:flex;gap:8px;align-items:center;margin-top:8px}
.btn{background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border:none;border-radius:9px;font-weight:800;font-size:13.5px;padding:9px 16px;cursor:pointer}
.login-cta{display:block;text-align:center;background:#FEE500;color:#191600;padding:11px;border-radius:10px;font-weight:800;font-size:13.5px;text-decoration:none;margin-top:14px}
.err{color:#dc2626;font-size:12.5px}
@media(max-width:640px){.wrap{padding:0 12px 50px}article h1{font-size:19px}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <a href="/board">자유게시판</a> &raquo; <span>글</span></nav>
<div class="wrap">
  <article>
    <h1>${esc(post.title)}</h1>
    <div class="meta">
      <b style="color:#334155">${esc(post.nickname || '회원')}</b>${roleBadge(post.author_role)}
      <span>${fmt(post.created_at)}</span>
      <span>조회 ${post.view_count}</span>
      <button class="share" id="share-btn" type="button">🔗 공유</button>
      <button class="report" id="report-btn" type="button">🚨 신고</button>
      <button class="del" id="del-btn" type="button" data-uid="${post.user_id}">삭제</button>
    </div>
    <div class="content">${esc(post.content)}</div>
    <a class="back" href="/board">← 목록으로</a>
  </article>

  <div class="cmts">
    <h2>댓글 ${comments.length}</h2>
    <div id="cmt-list">${commentsHtml}</div>
    <div id="cmt-area"></div>
    <form class="cmt-form" id="cmt-form">
      <textarea id="cmt-input" maxlength="1000" placeholder="댓글을 입력하세요 (1000자 이내)"></textarea>
      <div class="r"><button class="btn" type="submit">댓글 등록</button><span class="err" id="cmt-err"></span></div>
    </form>
  </div>
</div>
${seoCtaFooter(SITE)}
<script>
(function(){
  var POST_ID=${id};
  var me=null;
  fetch('/api/auth/me',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){
    me=d.user;
    var area=document.getElementById('cmt-area');
    if(d.user){ document.getElementById('cmt-form').style.display='block';
      var delBtn=document.getElementById('del-btn');
      if(String(d.user.id)===delBtn.dataset.uid){ delBtn.style.display='inline'; }
    } else if(d.login_enabled){ area.innerHTML='<a class="login-cta" href="/api/auth/kakao/login">💬 카카오 로그인 후 댓글 작성</a>'; }
  }).catch(function(){});

  var delBtn=document.getElementById('del-btn');
  delBtn.addEventListener('click',function(){
    if(!confirm('이 글을 삭제할까요?'))return;
    fetch('/api/board/posts/'+POST_ID,{method:'DELETE',credentials:'same-origin'}).then(function(r){
      if(r.ok){location.href='/board';}else{alert('삭제 권한이 없거나 실패했습니다.');}
    });
  });

  // v2.7.0: 글 공유 (카톡 등에 붙이면 글 내용 미리보기) — /og/board/{id} 링크
  var shareBtn=document.getElementById('share-btn');
  if(shareBtn){
    var shareUrl=location.origin+'/og/board/'+POST_ID;
    shareBtn.addEventListener('click',async function(){
      var t=(document.querySelector('article h1')||{}).textContent||'InsureConnect 자유게시판';
      try{ if(window.Kakao&&window.Kakao.Share&&window.Kakao.isInitialized&&window.Kakao.isInitialized()){ window.Kakao.Share.sendScrap({requestUrl:shareUrl}); return; } }catch(e){}
      try{ if(navigator.share){ await navigator.share({title:t,url:shareUrl}); return; } }
      catch(e){ if(e&&e.name==='AbortError') return; }
      try{ await navigator.clipboard.writeText(shareUrl); shareBtn.textContent='✓ 링크 복사됨'; setTimeout(function(){shareBtn.textContent='🔗 공유';},1800); }
      catch(e){ window.prompt('아래 링크를 복사해 공유하세요', shareUrl); }
    });
  }

  // v2.7.2: 신고 (글/댓글)
  function reportTarget(type,id){
    if(!id) return;
    if(!confirm('이 '+(type==='post'?'글':'댓글')+'을(를) 신고할까요?')) return;
    fetch('/api/board/report',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
      body:JSON.stringify({target_type:type,target_id:id,post_id:POST_ID})})
      .then(function(r){ if(r.status===401){ alert('로그인 후 신고할 수 있습니다.'); return null; } return r.json(); })
      .then(function(d){ if(d){ alert(d.dup?'이미 신고한 항목입니다.':'신고가 접수되었습니다. 감사합니다.'); } })
      .catch(function(){ alert('신고 처리 중 오류가 발생했습니다.'); });
  }
  var reportBtn=document.getElementById('report-btn');
  if(reportBtn) reportBtn.addEventListener('click',function(){ reportTarget('post',POST_ID); });
  var cmtList=document.getElementById('cmt-list');
  if(cmtList) cmtList.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.cmt-report');
    if(b){ reportTarget('comment', parseInt(b.dataset.cid,10)); }
  });

  document.getElementById('cmt-form').addEventListener('submit',async function(ev){
    ev.preventDefault();
    var c=document.getElementById('cmt-input').value.trim();
    var err=document.getElementById('cmt-err'); err.textContent='';
    if(!c){err.textContent='댓글을 입력해주세요.';return;}
    var btn=this.querySelector('button'); btn.disabled=true;
    try{
      var res=await fetch('/api/board/posts/'+POST_ID+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({content:c})});
      var d=await res.json();
      if(!res.ok){ err.textContent=d.error||'등록 실패'; btn.disabled=false; return; }
      location.reload();
    }catch(e){ err.textContent='네트워크 오류'; btn.disabled=false; }
  });
})();
</script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};
