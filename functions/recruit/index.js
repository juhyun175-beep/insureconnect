/**
 * v2.8.11: 보험설계사 채용 허브 (SSR) — GET /recruit
 *   타깃 검색: "보험설계사 채용", "보험 구인공고", "지점 리크루팅", "GA 설계사 모집"
 *   승인된 채용공고를 집계 → 개별 JobPosting 페이지(/og/recruit/{id})로 내부링크
 *   유입 양면: 구직 설계사(→회원) + 구인 지점/GA(→공고 무료등록)
 */
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';

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
  const url = `${SITE}/recruit`;

  let jobs = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, title, company_name, description, created_at
       FROM ic_recruitments WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`
    ).all();
    jobs = rs.results || [];
  } catch (_) {}

  const cards = jobs.map(j => {
    const isNew = daysAgo(j.created_at) <= 7;
    const excerpt = (j.description || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    return `
    <a class="job" href="/og/recruit/${esc(j.id)}">
      <div class="job-top">
        ${j.company_name ? `<span class="job-co">${esc(j.company_name)}</span>` : '<span class="job-co job-co-na">채용</span>'}
        ${isNew ? '<span class="job-new">NEW</span>' : ''}
      </div>
      <div class="job-title">${esc(j.title)}</div>
      ${excerpt ? `<div class="job-desc">${esc(excerpt)}${(j.description || '').length > 90 ? '…' : ''}</div>` : ''}
      <span class="job-cta">상세보기 →</span>
    </a>`;
  }).join('');

  const title = '보험설계사 채용·구인공고 모음 | InsureConnect';
  const desc = `보험설계사·GA 법인대리점 채용/리크루팅 공고 ${jobs.length}건을 한 곳에서. 지점 모집·정착지원·교육 정보를 확인하고 바로 지원하세요. 구인 담당자는 무료로 공고를 등록할 수 있습니다.`;

  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '보험설계사 채용·구인공고 모음', url,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: jobs.slice(0, 50).map((j, idx) => ({
        '@type': 'ListItem', position: idx + 1, url: `${SITE}/og/recruit/${j.id}`, name: j.title,
      })),
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '채용공고', item: url },
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
header.h{max-width:1000px;margin:0 auto 18px;padding:30px 28px;background:linear-gradient(135deg,#0b6b3a,#16a34a);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:27px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.94;font-size:14px}
.h-cta{display:inline-block;margin-top:14px;background:#fff;color:#0b6b3a;text-decoration:none;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px}
.sec{max-width:1000px;margin:0 auto;padding:0 16px}.sec h2{font-size:18px;color:#0f172a;margin:18px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.job{display:flex;flex-direction:column;gap:7px;background:#fff;border-radius:13px;padding:18px 18px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.05);border-top:3px solid #16a34a;transition:transform .15s,box-shadow .15s}
.job:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(22,163,74,0.15)}
.job-top{display:flex;align-items:center;gap:7px}
.job-co{font-size:11.5px;font-weight:800;color:#0b6b3a;background:#dcfce7;padding:2px 9px;border-radius:999px}
.job-co-na{color:#64748b;background:#f1f5f9}
.job-new{font-size:10px;font-weight:900;color:#fff;background:#ef4444;padding:2px 7px;border-radius:5px;letter-spacing:.03em}
.job-title{font-size:16px;font-weight:800;color:#0f172a;line-height:1.35;letter-spacing:-0.01em}
.job-desc{font-size:13px;color:#64748b;line-height:1.5}
.job-cta{margin-top:auto;font-size:13px;font-weight:700;color:#16a34a}
.empty{max-width:1000px;margin:0 auto;padding:0 16px}
.empty-box{background:#fff;border-radius:14px;padding:40px 24px;text-align:center;color:#64748b;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
@media(max-width:640px){header.h{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>채용공고</span></nav>
<header class="h">
  <h1>보험설계사 채용 · 구인공고</h1>
  <p>지점 리크루팅 · GA 법인대리점 모집 · 정착지원·교육 정보를 한 곳에서. 현재 ${jobs.length}건의 공고가 등록되어 있습니다.</p>
  <a class="h-cta" href="/api/auth/kakao/login">＋ 구인 담당자세요? 무료로 공고 등록 →</a>
</header>
${jobs.length
  ? `<div class="sec"><div class="grid">${cards}</div></div>`
  : `<div class="empty"><div class="empty-box">현재 등록된 채용공고가 없습니다. 잠시 후 다시 확인해주세요.<br><br><a href="/api/auth/kakao/login" style="color:#16a34a;font-weight:700;text-decoration:none">구인 공고 무료 등록하기 →</a></div></div>`}
<div class="sec" style="margin-top:16px">
  ${seoShareBar(url, '보험설계사 채용·구인공고 모음', '지점 리크루팅·GA 모집·정착지원 공고를 한 곳에서', `${SITE}/logo-full.png`)}
</div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=1800' },
  });
};
