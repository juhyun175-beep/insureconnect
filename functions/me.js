/**
 * v2.7.4: 마이페이지 — GET /me (로그인 필수)
 *   내 정보·등급 / 카톡 알림 on·off / 내 글·댓글
 */
import { getUserFromRequest } from './_lib/auth.js';

const SITE = 'https://insureconnect-hub.pages.dev';
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
  </script>`;

  return new Response(shell(inner), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};
