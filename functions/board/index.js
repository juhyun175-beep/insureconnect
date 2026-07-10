/**
 * v2.3.0: 자유게시판 목록 — GET /board
 *   읽기 공개 / 글쓰기 로그인 필수(클라이언트에서 /api/auth/me 확인)
 */
import { seoCtaFooter } from '../_lib/seo-cta.js';
import { seoPostingWidget } from '../_lib/posting-widget.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmt = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const k = new Date(d.getTime() + 9 * 3600000); return `${k.getUTCFullYear()}.${String(k.getUTCMonth() + 1).padStart(2, '0')}.${String(k.getUTCDate()).padStart(2, '0')}`; };
const roleBadge = (role) => role === 'certified' ? '<span class="bdg bdg-cert">인증설계사</span>'
  : role === 'premium' ? '<span class="bdg bdg-prem">프리미엄</span>'
  : role === 'admin' ? '<span class="bdg bdg-admin">운영자</span>' : '';

export const onRequestGet = async ({ env, request }) => {
  const postingWidget = await seoPostingWidget(env);
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const per = 20;
  const offset = (page - 1) * per;

  let posts = [], total = 0;
  try {
    const rs = await env.DB.prepare(
      `SELECT p.id, p.nickname, p.title, p.view_count, p.comment_count, p.created_at, m.role AS author_role
       FROM ic_board_posts p LEFT JOIN ic_members m ON m.id = p.user_id
       WHERE p.deleted = 0 ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(per, offset).all();
    posts = rs.results || [];
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_board_posts WHERE deleted = 0`).first();
    total = c?.n || 0;
  } catch (_) {}

  const rowsHtml = posts.length ? posts.map(p => `
    <a class="row" href="/board/${p.id}">
      <div class="row-main">
        <div class="row-title">${esc(p.title)}${p.comment_count ? `<span class="cc">[${p.comment_count}]</span>` : ''}</div>
        <div class="row-meta">${esc(p.nickname || '회원')}${roleBadge(p.author_role)} · ${fmt(p.created_at)} · 조회 ${p.view_count}</div>
      </div>
    </a>`).join('') : '<div class="empty">아직 글이 없습니다. 첫 글을 남겨보세요!</div>';

  const lastPage = Math.max(1, Math.ceil(total / per));
  const pager = total > per ? `<div class="pager">${page > 1 ? `<a href="/board?page=${page - 1}">‹ 이전</a>` : ''}<span>${page} / ${lastPage}</span>${page < lastPage ? `<a href="/board?page=${page + 1}">다음 ›</a>` : ''}</div>` : '';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>자유게시판 | InsureConnect</title>
<meta name="description" content="보험설계사 자유게시판 — 업계 이야기, 실무 노하우, 질문을 나누는 공간">
<meta name="robots" content="noindex,follow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#0f172a;background:#f9fafb;margin:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:820px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:820px;margin:0 auto;padding:0 16px 60px}
header.h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0 16px;flex-wrap:wrap}
header.h h1{margin:0;font-size:24px;letter-spacing:-0.02em}
.writebar{margin-bottom:14px}
.btn{display:inline-block;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border:none;border-radius:10px;font-weight:800;font-size:14px;padding:11px 18px;cursor:pointer;text-decoration:none}
.login-cta{background:#FEE500;color:#191600;padding:11px 16px;border-radius:10px;font-weight:800;font-size:13.5px;text-decoration:none;display:inline-block}
.list{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.04);overflow:hidden}
.row{display:block;padding:15px 18px;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit}
.row:hover{background:#f8fafc}
.row-title{font-size:15.5px;font-weight:700;color:#0f172a}
.row-title .cc{color:#1a3de8;font-weight:800;margin-left:6px;font-size:13px}
.row-meta{font-size:12.5px;color:#94a3b8;margin-top:4px}
.bdg{display:inline-block;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;margin-left:5px;vertical-align:1px}
.bdg-cert{background:#dbeafe;color:#1a3de8}.bdg-prem{background:#fef3c7;color:#b45309}.bdg-admin{background:#fee2e2;color:#dc2626}
.empty{padding:48px 20px;text-align:center;color:#94a3b8}
.pager{display:flex;gap:14px;justify-content:center;align-items:center;margin-top:18px;color:#64748b;font-size:13px}
.pager a{color:#1a3de8;text-decoration:none;font-weight:700}
.compose{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.04);padding:18px;margin-bottom:14px;display:none}
.compose input,.compose textarea{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;font-family:inherit;font-size:14.5px;margin-bottom:10px}
.compose textarea{min-height:140px;resize:vertical;line-height:1.6}
.compose input:focus,.compose textarea:focus{outline:none;border-color:#1a3de8}
.compose .row2{display:flex;gap:8px;align-items:center}
.muted{font-size:12px;color:#94a3b8}
.err{color:#dc2626;font-size:13px;margin-top:6px}
@media(max-width:640px){.wrap{padding:0 12px 50px}header.h h1{font-size:21px}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>자유게시판</span></nav>
<div class="wrap">
  <header class="h">
    <h1>💬 자유게시판</h1>
    <div id="write-bar" class="writebar"></div>
  </header>

  <div class="compose" id="compose">
    <input type="text" id="c-title" maxlength="100" placeholder="제목 (100자 이내)">
    <textarea id="c-content" maxlength="5000" placeholder="보험 실무, 업계 이야기, 질문 등 자유롭게 나눠주세요. (5000자 이내)"></textarea>
    <div class="row2">
      <button class="btn" id="c-submit" type="button">등록</button>
      <button type="button" id="c-cancel" style="border:none;background:transparent;color:#94a3b8;cursor:pointer;font-size:13px;">취소</button>
      <span class="err" id="c-err"></span>
    </div>
    <div class="muted" style="margin-top:8px;">※ 욕설·광고·개인정보·허위사실 게시는 삭제될 수 있습니다.</div>
  </div>

  <div class="list">${rowsHtml}</div>
  ${pager}
</div>
${postingWidget}
${seoCtaFooter(SITE)}
<script>
(function(){
  var wb=document.getElementById('write-bar');
  var compose=document.getElementById('compose');
  fetch('/api/auth/me',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){
    if(d.user){ wb.innerHTML='<button class="btn" id="open-compose" type="button">✏️ 글쓰기</button>';
      document.getElementById('open-compose').addEventListener('click',function(){ compose.style.display='block'; document.getElementById('c-title').focus(); });
    } else if(d.login_enabled){ wb.innerHTML='<a class="login-cta" href="/api/auth/kakao/login">💬 카카오 로그인 후 글쓰기</a>'; }
  }).catch(function(){});
  document.getElementById('c-cancel').addEventListener('click',function(){compose.style.display='none';});
  document.getElementById('c-submit').addEventListener('click',async function(){
    var t=document.getElementById('c-title').value.trim();
    var c=document.getElementById('c-content').value.trim();
    var err=document.getElementById('c-err'); err.textContent='';
    if(!t||!c){err.textContent='제목과 내용을 입력해주세요.';return;}
    var btn=this; btn.disabled=true;
    try{
      var res=await fetch('/api/board/posts',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({title:t,content:c})});
      var d=await res.json();
      if(!res.ok){ if(d&&d.code==='banned'&&d.contact){ err.innerHTML='이용이 제한된 계정입니다. <a href="'+d.contact+'" target="_blank" rel="noopener noreferrer" style="color:#1a3de8;font-weight:800;text-decoration:underline;">💬 관리자에게 문의하기</a>'; } else { err.textContent=(d&&d.error)||'등록에 실패했습니다.'; } btn.disabled=false; return; }
      location.href='/board/'+d.id;
    }catch(e){ err.textContent='네트워크 오류입니다.'; btn.disabled=false; }
  });
})();
</script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};
