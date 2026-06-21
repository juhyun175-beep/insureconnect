/**
 * v2.0.0 (master): SEO 게시판 진입 페이지
 *   GET /insurance
 */
import { SEO_CATEGORIES } from '../_lib/seo-categories.js';
import { seoCtaFooter } from '../_lib/seo-cta.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const onRequestGet = async ({ env }) => {
  // 카테고리별 글 수
  const counts = await env.DB.prepare(
    `SELECT category, COUNT(*) AS n FROM ic_seo_posts WHERE status='published' GROUP BY category`
  ).all().catch(() => ({ results: [] }));
  const countMap = Object.fromEntries((counts.results || []).map(r => [r.category, r.n]));

  // 글이 있는 카테고리만 노출 (빈 카테고리 = soft-404 방지)
  const visibleCats = SEO_CATEGORIES.filter(cat => (countMap[cat.slug] || 0) > 0);
  const totalPosts = visibleCats.reduce((s, c) => s + (countMap[c.slug] || 0), 0);

  const gridHtml = visibleCats.map(cat => `
    <a class="cat-card" href="/insurance/${cat.slug}">
      <div class="cat-label">${esc(cat.label)}</div>
      <div class="cat-desc">${esc(cat.desc)}</div>
      <div class="cat-count">${(countMap[cat.slug] || 0).toLocaleString()}건</div>
    </a>`).join('');

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '보험 정보 게시판',
    description: '보험금청구·실손·종신·암·자동차·실무 등 보험 전문 정보',
    url: `${SITE}/insurance`,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: visibleCats.map((cat, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: `${SITE}/insurance/${cat.slug}`, name: cat.label,
      })),
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈',   item: SITE },
      { '@type': 'ListItem', position: 2, name: '보험', item: `${SITE}/insurance` },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>보험 정보 게시판 | InsureConnect</title>
<meta name="description" content="보험금청구·실손·종신·암·자동차·실무 등 12개 카테고리의 보험 전문 정보">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${SITE}/insurance">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:title" content="보험 정보 게시판 | InsureConnect">
<meta property="og:description" content="보험설계사를 위한 보험 전문 정보 게시판">
<meta property="og:url" content="${SITE}/insurance">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:image" content="${SITE}/logo-full.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="보험 정보 게시판 | InsureConnect">
<script type="application/ld+json">${JSON.stringify(itemListLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:1080px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.b-head{max-width:1080px;margin:0 auto 24px;padding:32px 28px;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border-radius:16px}
header.b-head h1{margin:0 0 8px;font-size:30px;letter-spacing:-0.02em}
header.b-head p{margin:0;opacity:.9;font-size:15px}
.cat-grid{max-width:1080px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.cat-card{display:block;background:#fff;border-radius:12px;padding:20px 22px;text-decoration:none;color:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:transform .15s,box-shadow .15s;border-left:4px solid #1a3de8}
.cat-card:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(26,61,232,0.15);border-left-color:#4a70f5}
.cat-label{font-size:17px;font-weight:800;color:#0f172a;margin-bottom:6px}
.cat-desc{font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:10px;min-height:38px}
.cat-count{display:inline-block;background:#eff6ff;color:#1a3de8;padding:2px 10px;border-radius:999px;font-size:11.5px;font-weight:700}
@media(max-width:640px){header.b-head{padding:24px 20px;border-radius:0;margin-bottom:16px}.crumb{padding:12px 16px}.cat-grid{padding:0;gap:0;border-radius:0}.cat-card{border-radius:0;border-left:none;border-bottom:1px solid #e5e7eb}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>보험</span></nav>
<header class="b-head">
  <h1>보험 정보 게시판</h1>
  <p>보험설계사를 위한 ${visibleCats.length}개 카테고리 · 총 ${totalPosts.toLocaleString()}편의 전문 정보</p>
</header>
<div class="cat-grid">${gridHtml}</div>
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
