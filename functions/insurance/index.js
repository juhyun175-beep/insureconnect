/**
 * v2.0.0 (master): SEO 게시판 진입 페이지
 *   GET /insurance
 */
import { SEO_CATEGORIES } from '../_lib/seo-categories.js';
import { seoCtaFooter } from '../_lib/seo-cta.js';
import { seoPostingWidget } from '../_lib/posting-widget.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const onRequestGet = async ({ env }) => {
  const postingWidget = await seoPostingWidget(env);
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

  // 허브 FAQ — 원본 콘텐츠(소비자·설계사 공통 질문) + FAQPage 스키마
  const hubFaqs = [
    {
      q: '보험 정보는 로그인 없이도 볼 수 있나요?',
      a: '네. 보험금청구·실손·암·자동차·종신보험 등 핵심 정보 글은 로그인 없이 누구나 읽을 수 있습니다. 보험사 전산 즐겨찾기·알림 같은 설계사 전용 기능은 카카오 로그인이 필요합니다.',
    },
    {
      q: '여기 있는 글은 어디서 가져온 내용인가요?',
      a: 'InsureConnect가 직접 작성한 원본 정보입니다. 약관·법령·금융감독원 및 각 보험사 공시 자료를 토대로 현장 설계사가 실무 관점에서 풀어 정리했으며, 특정 보험사나 상품을 추천하지 않는 중립 정보를 지향합니다.',
    },
    {
      q: '소비자도 도움이 되나요, 아니면 설계사 전용인가요?',
      a: '둘 다입니다. 청구 서류·소멸시효·과실비율처럼 소비자가 바로 활용할 수 있는 생활 정보와, 인수심사·약관 해설·수술/질병코드처럼 설계사 실무에 필요한 정보를 함께 다룹니다.',
    },
    {
      q: '내용을 그대로 믿고 보험금을 청구해도 되나요?',
      a: '일반적인 정보 제공 목적의 글이므로, 구체적인 보장 여부는 가입한 상품의 약관과 보험사 안내가 기준입니다. 중요한 청구는 본인 증권과 약관을 확인하거나 담당 설계사·보험사 고객센터에 문의하시기 바랍니다.',
    },
  ];
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: hubFaqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
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
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
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
.hub-intro{max-width:1080px;margin:0 auto 24px;padding:0 16px}
.hub-intro-in{background:#fff;border-radius:14px;padding:24px 26px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.hub-intro h2{margin:0 0 10px;font-size:19px;color:#0f172a}
.hub-intro p{margin:0 0 10px;font-size:14.5px;line-height:1.75;color:#374151}
.hub-intro p:last-child{margin-bottom:0}
.hub-faq{max-width:1080px;margin:28px auto 8px;padding:0 16px}
.hub-faq h2{font-size:20px;color:#0f172a;margin:0 0 14px;padding-left:2px}
.hub-faq details{background:#fff;border-radius:12px;padding:16px 20px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.hub-faq summary{font-size:15.5px;font-weight:700;color:#0f172a;cursor:pointer;list-style:none}
.hub-faq summary::-webkit-details-marker{display:none}
.hub-faq summary::before{content:'Q. ';color:#1a3de8;font-weight:800}
.hub-faq p{margin:12px 0 0;font-size:14px;line-height:1.75;color:#374151}
@media(max-width:640px){header.b-head{padding:24px 20px;border-radius:0;margin-bottom:16px}.crumb{padding:12px 16px}.cat-grid{padding:0;gap:0;border-radius:0}.cat-card{border-radius:0;border-left:none;border-bottom:1px solid #e5e7eb}.hub-intro-in{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>보험</span></nav>
<header class="b-head">
  <h1>보험 정보 게시판</h1>
  <p>보험설계사를 위한 ${visibleCats.length}개 카테고리 · 총 ${totalPosts.toLocaleString()}편의 전문 정보</p>
</header>
<section class="hub-intro">
  <div class="hub-intro-in">
    <h2>흩어진 보험 정보를 한곳에서, 쉽게</h2>
    <p>보험은 약관 한 줄, 코드 하나로 보장 여부가 갈리지만 정작 정확한 정보를 찾기는 어렵습니다. InsureConnect 보험 정보 게시판은 <strong>보험금 청구 방법부터 실손·암·자동차·종신보험의 보장 구조, 약관 해설, 수술·질병코드(KCD)까지</strong> 현장에서 자주 부딪히는 주제를 직접 정리해 무료로 공개합니다.</p>
    <p>모든 글은 약관·법령과 각 보험사 공시 자료를 토대로, 실제 상담·청구·인수심사를 경험한 관점에서 풀어 썼습니다. 특정 보험사나 상품을 추천하지 않고 <strong>중립적인 정보 제공</strong>을 원칙으로 하며, 소비자가 바로 활용할 수 있는 생활 정보와 설계사 실무에 필요한 전문 정보를 함께 담았습니다.</p>
    <p>아래 ${visibleCats.length}개 카테고리에서 관심 있는 주제를 선택하면 관련 글을 모아 볼 수 있습니다. 핵심 정보는 로그인 없이 누구나 읽을 수 있습니다.</p>
  </div>
</section>
<div class="cat-grid">${gridHtml}</div>
<section class="hub-faq" aria-label="자주 묻는 질문">
  <h2>자주 묻는 질문</h2>
  ${hubFaqs.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
</section>
${postingWidget}
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
