import { caseDiseaseUrl, CASES_INDEX_WHERE } from '../_lib/cases-seo.js';
import { loadCaseContributors, mask } from '../_lib/contributors.js';
const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`;

export async function onRequestGet({ env }) {
  const rs = await env.DB.prepare(`SELECT TRIM(COALESCE(disease,'')) disease, COUNT(*) count,
    SUM(CASE WHEN category IN ('underwrite','disclosure') THEN 1 ELSE 0 END) underwriting
    FROM ic_insurance_cases WHERE ${CASES_INDEX_WHERE} GROUP BY TRIM(COALESCE(disease,''))
    HAVING COUNT(*) >= 3 AND SUM(CASE WHEN category IN ('underwrite','disclosure') THEN 1 ELSE 0 END) >= 1
    ORDER BY count DESC, disease`).all();
  const diseases = rs.results || [];
  const items = diseases.map((d, i) => `<li><a href="${caseDiseaseUrl(d.disease)}">${esc(d.disease)}</a> <span>${d.count}건</span></li>`).join('');
  const contributors = await loadCaseContributors(env, null, 5);
  const contributorHtml = contributors.length
    ? `<section><h2>사례 기여 TOP 5</h2><ol>${contributors.map((r) => `<li>${esc(mask(r.nickname))} · ${esc(r.n)}건</li>`).join('')}</ol><p>실제 사례를 제출하면 질병별 페이지에 게시되고 포인트를 받을 수 있습니다.</p><a href="/?case_submit=1">사례 제출하기: 제출 +10P · 승인 +20P · 우수 사례 +50P</a></section>`
    : `<section><h2>사례 기여</h2><p>사례를 제출하면 질병별 페이지에 게시되고 포인트를 받을 수 있습니다.</p><a href="/?case_submit=1">사례 제출하기: 제출 +10P · 승인 +20P · 우수 사례 +50P</a></section>`;
  const url = `${SITE}/cases`;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>질병별 보험 가입·고지·보상 사례 | InsureConnect</title><meta name="description" content="질병별 보험 가입, 고지, 보상 사례를 확인하세요."><meta name="robots" content="index,follow"><link rel="canonical" href="${url}">${ld({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:SITE},{'@type':'ListItem',position:2,name:'질병별 사례',item:url}]})}</head><body><nav><a href="/">홈</a> &gt; 질병별 사례</nav><main><h1>질병별 보험 사례</h1><ul>${items}</ul>${contributorHtml}</main></body></html>`;
  return new Response(html, { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=300, s-maxage=300' } });
}
