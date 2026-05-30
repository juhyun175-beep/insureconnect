/**
 * v2.1.62: 보험사 전산 인덱스 (SSR) — GET /company
 *   생보/손보 전 보험사 전산·연락처 랜딩으로 연결 (내부링크 허브)
 */
import { INSURERS } from '../_lib/insurers.js';
import { seoCtaFooter } from '../_lib/seo-cta.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

export const onRequestGet = async () => {
  const life = INSURERS.filter(i => i.type === 'life');
  const nonlife = INSURERS.filter(i => i.type === 'nonlife');
  const url = `${SITE}/company`;

  const cardsOf = (arr) => arr.map(i =>
    `<a class="ico" href="/company/${i.slug}"><span class="ico-name">${esc(i.name)}</span><span class="ico-sub">전산·청구·고객센터</span></a>`
  ).join('');

  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '보험사 전산·청구 안내', url,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: INSURERS.map((i, idx) => ({ '@type': 'ListItem', position: idx + 1, url: `${SITE}/company/${i.slug}`, name: i.name })),
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '보험사 전산', item: url },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>보험사 전산 바로가기·고객센터·청구 안내 모음 | InsureConnect</title>
<meta name="description" content="생명보험·손해보험 전 보험사의 설계사 전산(사이버창구) 바로가기, 고객센터 전화, 청구 팩스번호, 상품공시실을 한 곳에서 확인하세요.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${url}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="보험사 전산·고객센터·청구 안내 모음 | InsureConnect">
<meta property="og:description" content="생보·손보 전 보험사 전산 바로가기·고객센터·청구 팩스·상품공시 한 곳에">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/logo-full.png">
${ld(itemListLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:1000px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.h{max-width:1000px;margin:0 auto 22px;padding:30px 28px;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:27px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.92;font-size:14px}
.sec{max-width:1000px;margin:0 auto 8px;padding:0 16px}.sec h2{font-size:18px;color:#0f172a;margin:18px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.ico{display:flex;flex-direction:column;gap:2px;background:#fff;border-radius:11px;padding:14px 16px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.04);border-left:3px solid #1a3de8;transition:transform .15s,box-shadow .15s}
.ico:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(26,61,232,0.14)}
.ico-name{font-size:15px;font-weight:800;color:#0f172a}.ico-sub{font-size:11px;color:#9ca3af}
@media(max-width:640px){header.h{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>보험사 전산</span></nav>
<header class="h">
  <h1>보험사 전산·고객센터·청구 안내</h1>
  <p>생명보험 ${life.length}곳 · 손해보험 ${nonlife.length}곳 — 전산 바로가기, 고객센터, 청구 팩스, 상품공시를 한 곳에서</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">
    <a href="/company/customer-center" style="background:rgba(255,255,255,0.18);color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:8px 14px;border-radius:8px;">📞 고객센터 번호 총정리</a>
    <a href="/company/claim-fax" style="background:rgba(255,255,255,0.18);color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:8px 14px;border-radius:8px;">📠 청구 팩스번호 모음</a>
    <a href="/company/claim-forms" style="background:rgba(255,255,255,0.18);color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:8px 14px;border-radius:8px;">📄 청구서류 양식 다운로드</a>
    <a href="/ga" style="background:rgba(255,255,255,0.18);color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:8px 14px;border-radius:8px;">🏢 GA 법인대리점 전산</a>
  </div>
</header>
<div class="sec"><h2>🟦 생명보험</h2><div class="grid">${cardsOf(life)}</div></div>
<div class="sec"><h2>🟧 손해보험</h2><div class="grid">${cardsOf(nonlife)}</div></div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
};
