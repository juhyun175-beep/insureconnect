/**
 * v2.0.0 (master): SEO 게시글 페이지 (SSR 렌더)
 *
 *   GET /insurance/{category}/{slug}
 *
 * - 게시글 본문을 풀 HTML 로 SSR — SEO 봇 인덱싱 최적화
 * - JSON-LD Article + BreadcrumbList + FAQPage schema 자동 삽입
 * - meta description / canonical / OG 메타 자동 생성
 * - related posts (같은 카테고리 최신 5개) 자동 노출
 * - 봇 아닌 사용자: view_count + 1
 */
import { isBot } from '../../_lib/bot.js';
import { SEO_CATEGORY_MAP } from '../../_lib/seo-categories.js';
import { seoCtaFooter, seoShareBar } from '../../_lib/seo-cta.js';

const SITE = 'https://insureconnect-hub.pages.dev';

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function jsonLdScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

export const onRequestGet = async ({ params, env, request }) => {
  const { category, slug } = params;
  const cat = SEO_CATEGORY_MAP[category];
  if (!cat) return new Response('Not found', { status: 404 });

  const row = await env.DB.prepare(
    `SELECT * FROM ic_seo_posts WHERE category = ? AND slug = ? AND status = 'published'`
  ).bind(category, slug).first();
  if (!row) return new Response('Not found', { status: 404 });

  // view count (봇 제외)
  if (!isBot(request)) {
    env.DB.prepare(`UPDATE ic_seo_posts SET view_count = view_count + 1 WHERE id = ?`)
      .bind(row.id).run().catch(() => {});
  }

  const url = `${SITE}/insurance/${cat.slug}/${row.slug}`;
  const description = row.excerpt
    || String(row.content).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const ogImage = row.cover_image_url || `${SITE}/og-image/news/${row.id}`;

  // related posts (같은 카테고리 최신 5)
  const related = await env.DB.prepare(
    `SELECT slug, title, excerpt FROM ic_seo_posts
     WHERE category = ? AND status = 'published' AND id != ?
     ORDER BY created_at DESC LIMIT 5`
  ).bind(category, row.id).all();

  // JSON-LD
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: row.title,
    description,
    datePublished: row.created_at,
    dateModified: row.updated_at || row.created_at,
    author: { '@type': 'Organization', name: row.author || 'InsureConnect' },
    publisher: {
      '@type': 'Organization', name: 'InsureConnect',
      logo: { '@type': 'ImageObject', url: `${SITE}/logo-full.png` },
    },
    image: ogImage,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈',       item: SITE },
      { '@type': 'ListItem', position: 2, name: '보험',     item: `${SITE}/insurance` },
      { '@type': 'ListItem', position: 3, name: cat.label,  item: `${SITE}/insurance/${cat.slug}` },
      { '@type': 'ListItem', position: 4, name: row.title,  item: url },
    ],
  };

  // FAQ schema (faq_json 이 있으면)
  let faqLd = null;
  let faqHtml = '';
  try {
    if (row.faq_json) {
      const faqs = JSON.parse(row.faq_json);
      if (Array.isArray(faqs) && faqs.length) {
        faqLd = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.q || '',
            acceptedAnswer: { '@type': 'Answer', text: f.a || '' },
          })),
        };
        faqHtml = '<section class="post-faq"><h2>자주 묻는 질문</h2>'
          + faqs.map(f => `<dl><dt>Q. ${esc(f.q)}</dt><dd>${esc(f.a)}</dd></dl>`).join('')
          + '</section>';
      }
    }
  } catch (_) {}

  const relatedHtml = (related.results || []).length
    ? `<section class="post-related"><h2>관련 글</h2><ul>${
        (related.results || []).map(r =>
          `<li><a href="/insurance/${cat.slug}/${r.slug}">${esc(r.title)}</a>${
            r.excerpt ? `<span class="r-exc"> — ${esc(r.excerpt.slice(0, 80))}</span>` : ''
          }</li>`
        ).join('')
      }</ul></section>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(row.title)} · ${esc(cat.label)} | InsureConnect</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${esc(url)}">
<meta name="viewport" content="width=device-width, initial-scale=1">

<meta property="og:type" content="article">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="${esc(row.title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(row.title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">

${jsonLdScript(articleLd)}
${jsonLdScript(breadcrumbLd)}
${faqLd ? jsonLdScript(faqLd) : ''}

<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;line-height:1.7;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:760px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
article.post{max-width:760px;margin:0 auto;background:#fff;padding:32px 28px 48px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.04);margin-bottom:24px}
.post h1{font-size:28px;line-height:1.35;margin:0 0 8px;color:#0f172a;letter-spacing:-0.02em}
.post-meta{font-size:13px;color:#6b7280;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e7eb}
.post-meta .cat{background:#1a3de8;color:#fff;padding:3px 10px;border-radius:6px;font-weight:700;margin-right:8px}
.post-body{font-size:16px;color:#1f2937}
.post-body img{max-width:100%;height:auto;border-radius:8px;margin:16px 0}
.post-body h2{font-size:22px;margin-top:32px;color:#0f172a}
.post-body h3{font-size:18px;margin-top:24px}
.post-faq{max-width:760px;margin:0 auto 24px;background:#eff6ff;padding:24px 28px;border-radius:14px;border-left:4px solid #1a3de8}
.post-faq h2{margin-top:0;font-size:20px;color:#1e3a8a}
.post-faq dl{margin:12px 0}.post-faq dt{font-weight:700;color:#1e3a8a;margin-bottom:4px}.post-faq dd{margin:0 0 12px;color:#374151}
.post-related{max-width:760px;margin:0 auto 32px;background:#fff;padding:24px 28px;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,0.03)}
.post-related h2{margin-top:0;font-size:18px;color:#0f172a}
.post-related ul{list-style:none;padding:0;margin:0}
.post-related li{padding:10px 0;border-bottom:1px solid #f1f5f9}
.post-related a{color:#1a3de8;text-decoration:none;font-weight:600}
.post-related .r-exc{color:#6b7280;font-weight:400;font-size:13px}
.back-link{display:inline-block;margin-top:24px;padding:8px 16px;background:#1a3de8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700}
@media(max-width:640px){article.post{padding:24px 20px;border-radius:0}.post h1{font-size:22px}.crumb{padding:12px 16px}}
</style>
</head>
<body>
<nav class="crumb" aria-label="breadcrumb">
  <a href="/">홈</a> &raquo;
  <a href="/insurance">보험</a> &raquo;
  <a href="/insurance/${cat.slug}">${esc(cat.label)}</a> &raquo;
  <span>${esc(row.title)}</span>
</nav>
<article class="post">
  <header>
    <div class="post-meta">
      <span class="cat">${esc(cat.label)}</span>
      <time>${esc(String(row.created_at).slice(0, 10))}</time>
      ${row.view_count > 0 ? `<span style="margin-left:8px">조회 ${row.view_count.toLocaleString()}회</span>` : ''}
    </div>
    <h1>${esc(row.title)}</h1>
  </header>
  <div class="post-body">${row.content}</div>
  <a class="back-link" href="/insurance/${cat.slug}">← ${esc(cat.label)} 목록으로</a>
</article>
${seoShareBar(url, row.title)}
${faqHtml}
${relatedHtml}
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
