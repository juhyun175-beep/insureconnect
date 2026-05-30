/**
 * v2.1.68: GA(법인대리점) 전산 허브 — GET /ga
 *   타깃: "GA 전산", "법인대리점 전산 바로가기 모음"
 */
import { GA_LIST } from '../_lib/ga-companies.js';
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

export const onRequestGet = async () => {
  const url = `${SITE}/ga`;
  const cards = GA_LIST.map(g =>
    `<a class="ico" href="/ga/${g.slug}"><span class="ico-name">${esc(g.name)}</span><span class="ico-sub">전산 바로가기·로그인</span></a>`
  ).join('');

  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'GA 법인대리점 전산 바로가기', url,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: { '@type': 'ItemList',
      itemListElement: GA_LIST.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/ga/${g.slug}`, name: g.name })) },
  };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'GA 전산', item: url },
    ] };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>GA 법인대리점 전산 바로가기 모음 (17곳) | InsureConnect</title>
<meta name="description" content="에이플러스에셋·지에이코리아·굿리치·프라임에셋 등 주요 GA(법인보험대리점)의 설계사 전산(ERP) 바로가기·로그인 링크를 한 곳에 모았습니다.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${url}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="GA 법인대리점 전산 바로가기 모음 | InsureConnect">
<meta property="og:description" content="주요 GA(법인보험대리점) 설계사 전산 바로가기·로그인 모음">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/logo-full.png">
${ld(itemListLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:1000px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.h{max-width:1000px;margin:0 auto 22px;padding:30px 28px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:26px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.92;font-size:14px}
.sec{max-width:1000px;margin:0 auto;padding:0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.ico{display:flex;flex-direction:column;gap:2px;background:#fff;border-radius:11px;padding:14px 16px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.04);border-left:3px solid #059669;transition:transform .15s,box-shadow .15s}
.ico:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(5,150,105,0.16)}
.ico-name{font-size:15px;font-weight:800;color:#0f172a}.ico-sub{font-size:11px;color:#9ca3af}
.intro{max-width:1000px;margin:18px auto 0;padding:0 16px;color:#6b7280;font-size:13.5px;line-height:1.7}
@media(max-width:640px){header.h{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>GA 전산</span></nav>
<header class="h">
  <h1>GA 법인대리점 전산 바로가기</h1>
  <p>주요 GA(법인보험대리점) ${GA_LIST.length}곳의 설계사 전산(ERP) 바로가기·로그인을 한 곳에서</p>
</header>
<div class="sec"><div class="grid">${cards}</div></div>
<p class="intro">GA(법인보험대리점)는 여러 보험사 상품을 비교·판매하는 대리점입니다. 소속 설계사는 각 GA의 전산(ERP)에서 청약·고객관리·수수료 등을 처리합니다. 보험사 직접 전산은 <a href="/company">보험사 전산·청구 안내</a>에서 확인하세요.</p>
${seoShareBar(url, 'GA 법인대리점 전산 바로가기 모음', '주요 GA 설계사 전산 바로가기·로그인 모음', `${SITE}/logo-full.png`)}
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
};
