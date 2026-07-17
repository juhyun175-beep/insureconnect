import { caseDiseaseUrl, CASES_INDEX_WHERE } from '../_lib/cases-seo.js';
import { loadCaseContributors, mask } from '../_lib/contributors.js';
import { renderPage } from '../_lib/ssr-shell.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export async function onRequestGet({ env }) {
  const rs = await env.DB.prepare(`SELECT TRIM(COALESCE(disease,'')) disease, COUNT(*) count,
    SUM(CASE WHEN category IN ('underwrite','disclosure') THEN 1 ELSE 0 END) underwriting
    FROM ic_insurance_cases WHERE ${CASES_INDEX_WHERE} GROUP BY TRIM(COALESCE(disease,''))
    HAVING COUNT(*) >= 3 AND SUM(CASE WHEN category IN ('underwrite','disclosure') THEN 1 ELSE 0 END) >= 1
    ORDER BY count DESC, disease`).all();
  const diseases = rs.results || [];
  const items = diseases.map((d) => `<li><a href="${caseDiseaseUrl(d.disease)}">${esc(d.disease)}</a> <span>${d.count}건</span></li>`).join('');
  const contributors = await loadCaseContributors(env, null, 5);
  const contributorHtml = contributors.length
    ? `<section class="card"><h2>사례 기여 TOP 5</h2><ol>${contributors.map((r) => `<li>${esc(mask(r.nickname))} · ${esc(r.n)}건</li>`).join('')}</ol><p>실제 사례를 제출하면 질병별 페이지에 게시되고 포인트를 받을 수 있습니다.</p><a href="/?case_submit=1">사례 제출하기: 제출 +10P · 승인 +20P · 우수 사례 +50P</a></section>`
    : `<section class="card"><h2>사례 기여</h2><p>사례를 제출하면 질병별 페이지에 게시되고 포인트를 받을 수 있습니다.</p><a href="/?case_submit=1">사례 제출하기: 제출 +10P · 승인 +20P · 우수 사례 +50P</a></section>`;
  const title = '질병별 보험 가입·고지·보상 사례 | InsureConnect';
  const description = '질병별 보험 가입, 고지, 보상 사례를 확인하세요.';
  const url = `${SITE}/cases`;
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '질병별 사례', item: url },
    ],
  };
  const html = renderPage({
    title,
    description,
    robots: 'index,follow',
    canonical: url,
    jsonLd: [breadcrumbLd],
    breadcrumb: [
      { label: '홈', href: '/' },
      { label: '질병별 사례' },
    ],
    headerHtml: `<span class="badge">질병별 사례</span><h1>질병별 보험 가입·고지·보상 사례</h1><p>실제 승인 사례를 질병별로 확인하고 보험 상담에 참고하세요.</p>`,
    bodyHtml: `<section class="card"><h2>질병별 사례 목록</h2><ul class="rel">${items}</ul></section>${contributorHtml}`,
    site: SITE,
  });
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300' },
  });
}
