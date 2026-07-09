/**
 * v2.8.12: 보험설계사 교육·강의 허브 (SSR) — GET /lecture
 *   타깃 검색: "보험설계사 교육", "보험영업 강의", "보험 세미나", "GA 교육 일정"
 *   승인된 강의공고를 집계 → 개별 Course 페이지(/og/lecture/{id})로 내부링크
 *   유입 양면: 수강 설계사(→회원) + 강사/교육기관(→강의 무료등록)
 */
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';
import { getPromoRemaining } from '../_lib/promo.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const daysAgo = (iso) => {
  if (!iso) return 999;
  const t = Date.parse(String(iso).replace(' ', 'T'));
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : 999;
};

export const onRequestGet = async ({ env }) => {
  const url = `${SITE}/lecture`;
  const promo = await getPromoRemaining(env);
  const promoRemaining = promo.enabled ? Math.max(0, Number(promo.remaining || 0)) : 0;
  const submitCta = promoRemaining > 0
    ? `＋ 강사·교육기관이세요? 등록비 0원 · 선착순 ${promoRemaining}건 남음 →`
    : '＋ 강사·교육기관이세요? 강의 공고 등록하기 →';

  let items = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, title, instructor, description, created_at
       FROM ic_lectures WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`
    ).all();
    items = rs.results || [];
  } catch (_) {}

  const cards = items.map(it => {
    const isNew = daysAgo(it.created_at) <= 7;
    const excerpt = (it.description || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    return `
    <a class="lec" href="/og/lecture/${esc(it.id)}">
      <div class="lec-top">
        ${it.instructor ? `<span class="lec-by">강사 ${esc(it.instructor)}</span>` : '<span class="lec-by lec-by-na">교육</span>'}
        ${isNew ? '<span class="lec-new">NEW</span>' : ''}
      </div>
      <div class="lec-title">${esc(it.title)}</div>
      ${excerpt ? `<div class="lec-desc">${esc(excerpt)}${(it.description || '').length > 90 ? '…' : ''}</div>` : ''}
      <span class="lec-cta">강의 상세 →</span>
    </a>`;
  }).join('');

  const title = '보험설계사 교육·강의·세미나 일정 모음 | InsureConnect';
  const desc = `보험설계사 영업교육·상품교육·세미나·웨비나 강의 ${items.length}건을 한 곳에서. 강사·일정·신청 정보를 확인하고 바로 신청하세요. 강사·교육기관은 직접 강의를 등록할 수 있습니다.`;

  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '보험설계사 교육·강의 모음', url,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.slice(0, 50).map((it, idx) => ({
        '@type': 'ListItem', position: idx + 1, url: `${SITE}/og/lecture/${it.id}`, name: it.title,
      })),
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '교육·강의', item: url },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${url}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/logo-full.png">
${ld(itemListLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:1000px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.h{max-width:1000px;margin:0 auto 18px;padding:30px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:27px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.94;font-size:14px}
.h-cta{display:inline-block;margin-top:14px;background:#fff;color:#4f46e5;text-decoration:none;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px}
.sec{max-width:1000px;margin:0 auto;padding:0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.lec{display:flex;flex-direction:column;gap:7px;background:#fff;border-radius:13px;padding:18px 18px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.05);border-top:3px solid #7c3aed;transition:transform .15s,box-shadow .15s}
.lec:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(124,58,237,0.15)}
.lec-top{display:flex;align-items:center;gap:7px}
.lec-by{font-size:11.5px;font-weight:800;color:#5b21b6;background:#ede9fe;padding:2px 9px;border-radius:999px}
.lec-by-na{color:#64748b;background:#f1f5f9}
.lec-new{font-size:10px;font-weight:900;color:#fff;background:#ef4444;padding:2px 7px;border-radius:5px;letter-spacing:.03em}
.lec-title{font-size:16px;font-weight:800;color:#0f172a;line-height:1.35;letter-spacing:-0.01em}
.lec-desc{font-size:13px;color:#64748b;line-height:1.5}
.lec-cta{margin-top:auto;font-size:13px;font-weight:700;color:#7c3aed}
.empty{max-width:1000px;margin:0 auto;padding:0 16px}
.empty-box{background:#fff;border-radius:14px;padding:40px 24px;text-align:center;color:#64748b;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
@media(max-width:640px){header.h{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>교육·강의</span></nav>
<header class="h">
  <h1>보험설계사 교육 · 강의 · 세미나</h1>
  <p>영업교육 · 상품교육 · 세미나 · 웨비나 일정을 한 곳에서. 현재 ${items.length}건의 강의가 등록되어 있습니다.</p>
  <a class="h-cta" href="/?post=lecture">${submitCta}</a>
</header>
${items.length
  ? `<div class="sec"><div class="grid">${cards}</div></div>`
  : `<div class="empty"><div class="empty-box">현재 등록된 강의가 없습니다. 잠시 후 다시 확인해주세요.<br><br><a href="/?post=lecture" style="color:#7c3aed;font-weight:700;text-decoration:none">${submitCta}</a></div></div>`}
<div class="sec" style="margin-top:16px">
  ${seoShareBar(url, '보험설계사 교육·강의 모음', '영업교육·세미나·웨비나 일정을 한 곳에서', `${SITE}/logo-full.png`)}
</div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=1800' },
  });
};
