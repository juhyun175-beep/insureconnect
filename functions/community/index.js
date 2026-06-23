/**
 * v2.8.13: 커뮤니티 인기글 허브 (SSR) — GET /community
 *   자유게시판은 전수 noindex(UGC 품질·스팸 리스크) 유지하되,
 *   "조회수 + 본문길이" 품질 게이트를 통과한 인기·충실 글만 선별 색인 노출.
 *   타깃: "보험설계사 커뮤니티", "보험영업 노하우", "설계사 후기" 롱테일
 */
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';
import { BOARD_SEO_WHERE } from '../_lib/board-seo.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const fmt = (iso) => (iso ? String(iso).slice(0, 10) : '');

// 색인 품질 게이트는 _lib/board-seo.js(BOARD_SEO_WHERE)로 일원화 — og/board·sitemap과 동일 기준

export const onRequestGet = async ({ env }) => {
  const url = `${SITE}/community`;

  let posts = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, nickname, title, content, view_count, comment_count, created_at
       FROM ic_board_posts
       WHERE deleted = 0 AND ${BOARD_SEO_WHERE}
       ORDER BY (view_count + comment_count * 5) DESC, created_at DESC
       LIMIT 50`
    ).all();
    posts = rs.results || [];
  } catch (_) {}

  const cards = posts.map(p => {
    const excerpt = (p.content || '').replace(/\s+/g, ' ').trim().slice(0, 110);
    return `
    <a class="cm" href="/og/board/${esc(p.id)}">
      <div class="cm-title">${esc(p.title)}</div>
      <div class="cm-ex">${esc(excerpt)}${(p.content || '').length > 110 ? '…' : ''}</div>
      <div class="cm-meta"><span>${esc(p.nickname || '회원')}</span><span>👁 ${esc(p.view_count || 0)} · 💬 ${esc(p.comment_count || 0)}</span></div>
    </a>`;
  }).join('');

  const title = '보험설계사 커뮤니티 인기글 — 영업 노하우·후기 | InsureConnect';
  const desc = `보험설계사들이 직접 쓴 영업 노하우·현장 후기·정보공유 인기글을 모았습니다. 더 많은 이야기는 InsureConnect 커뮤니티에서 함께 나눠보세요.`;

  const collectionLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '보험설계사 커뮤니티 인기글', url,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.slice(0, 40).map((p, idx) => ({
        '@type': 'ListItem', position: idx + 1, url: `${SITE}/og/board/${p.id}`, name: p.title,
      })),
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '커뮤니티 인기글', item: url },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${posts.length ? 'index,follow' : 'noindex,follow'}">
<link rel="canonical" href="${url}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/logo-full.png">
${ld(collectionLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:900px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.h{max-width:900px;margin:0 auto 16px;padding:30px 28px;background:linear-gradient(135deg,#db2777,#e11d48);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:26px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.94;font-size:14px}
.h-cta{display:inline-block;margin-top:14px;background:#fff;color:#db2777;text-decoration:none;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px}
.sec{max-width:900px;margin:0 auto;padding:0 16px}
.list{display:flex;flex-direction:column;gap:10px}
.cm{display:flex;flex-direction:column;gap:5px;background:#fff;border-radius:12px;padding:16px 18px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.05);border-left:3px solid #db2777;transition:transform .12s,box-shadow .12s}
.cm:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(219,39,119,0.13)}
.cm-title{font-size:16px;font-weight:800;color:#0f172a;line-height:1.35}
.cm-ex{font-size:13px;color:#64748b;line-height:1.5}
.cm-meta{display:flex;justify-content:space-between;font-size:11.5px;color:#94a3b8;margin-top:2px}
.empty-box{background:#fff;border-radius:12px;padding:34px;text-align:center;color:#64748b;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
@media(max-width:640px){header.h{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>커뮤니티 인기글</span></nav>
<header class="h">
  <h1>보험설계사 커뮤니티 인기글</h1>
  <p>현장 설계사들이 직접 쓴 영업 노하우·후기·정보공유. 가입하면 댓글·작성에 참여할 수 있어요.</p>
  <a class="h-cta" href="/api/auth/kakao/login">💬 카카오로 커뮤니티 참여 →</a>
</header>
${posts.length
  ? `<div class="sec"><div class="list">${cards}</div></div>`
  : `<div class="sec"><div class="empty-box">아직 선별된 인기글이 없습니다.<br><br><a href="/api/auth/kakao/login" style="color:#db2777;font-weight:700;text-decoration:none">커뮤니티 참여하기 →</a></div></div>`}
<div class="sec" style="margin-top:16px">
  ${seoShareBar(url, '보험설계사 커뮤니티 인기글', '현장 설계사들의 영업 노하우·후기를 모았습니다', `${SITE}/logo-full.png`)}
</div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=1800' },
  });
};
