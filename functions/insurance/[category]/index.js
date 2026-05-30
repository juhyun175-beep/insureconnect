/**
 * v2.0.0 (master): 카테고리 목록 페이지
 *   GET /insurance/{category}
 */
import { SEO_CATEGORY_MAP } from '../../_lib/seo-categories.js';
import { seoCtaFooter } from '../../_lib/seo-cta.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const onRequestGet = async ({ params, env }) => {
  const cat = SEO_CATEGORY_MAP[params.category];
  if (!cat) return new Response('Not found', { status: 404 });

  const rs = await env.DB.prepare(
    `SELECT slug, title, excerpt, cover_image_url, view_count, created_at
     FROM ic_seo_posts WHERE category = ? AND status = 'published'
     ORDER BY created_at DESC LIMIT 50`
  ).bind(params.category).all();

  const items = rs.results || [];
  const url = `${SITE}/insurance/${cat.slug}`;
  const title = `${cat.label} | InsureConnect 보험설계사 게시판`;
  const desc = cat.desc;

  const listHtml = items.length
    ? `<ul class="post-list">${items.map(it => `
        <li class="post-card">
          <a href="/insurance/${cat.slug}/${it.slug}">
            <h3>${esc(it.title)}</h3>
            ${it.excerpt ? `<p>${esc(it.excerpt.slice(0, 120))}</p>` : ''}
            <div class="meta"><time>${esc(String(it.created_at).slice(0, 10))}</time>${it.view_count ? ` · 조회 ${it.view_count.toLocaleString()}` : ''}</div>
          </a>
        </li>`).join('')}</ul>`
    : `<p class="empty">아직 등록된 글이 없습니다.</p>`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${esc(url)}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:image" content="${SITE}/logo-full.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: cat.label,
  description: cat.desc,
  url,
  isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/insurance/${cat.slug}/${it.slug}`,
      name: it.title,
    })),
  },
})}</script>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '홈',      item: SITE },
    { '@type': 'ListItem', position: 2, name: '보험',    item: `${SITE}/insurance` },
    { '@type': 'ListItem', position: 3, name: cat.label, item: url },
  ],
})}</script>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:760px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.cat-head{max-width:760px;margin:0 auto 16px;padding:24px 28px;background:#fff;border-radius:14px}
header.cat-head h1{margin:0 0 6px;font-size:26px;color:#0f172a}
header.cat-head p{margin:0;color:#6b7280}
.post-list{max-width:760px;margin:0 auto;list-style:none;padding:0 16px}
.post-card{background:#fff;padding:0;border-radius:12px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:transform .15s}
.post-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.08)}
.post-card a{display:block;padding:20px 24px;color:inherit;text-decoration:none}
.post-card h3{margin:0 0 6px;font-size:17px;color:#1a3de8}.post-card p{margin:0 0 8px;color:#374151;line-height:1.5}
.post-card .meta{font-size:12px;color:#9ca3af}
.empty{max-width:760px;margin:40px auto;text-align:center;color:#9ca3af;padding:40px}
@media(max-width:640px){.crumb{padding:12px 16px}header.cat-head{padding:20px 18px;border-radius:0}.post-list{padding:0}.post-card{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb" aria-label="breadcrumb"><a href="/">홈</a> &raquo; <a href="/insurance">보험</a> &raquo; <span>${esc(cat.label)}</span></nav>
<header class="cat-head">
  <h1>${esc(cat.label)}</h1>
  <p>${esc(cat.desc)}</p>
</header>
${listHtml}
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=1800',
    },
  });
};
