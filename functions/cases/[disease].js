import { caseDiseaseUrl, diseaseFromParam, CASES_INDEX_WHERE, isCasesIndexable } from '../_lib/cases-seo.js';
import { insurerSlugForName } from '../_lib/insurers.js';
import { loadCaseContributors, mask } from '../_lib/contributors.js';
import { renderPage } from '../_lib/ssr-shell.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ageBand = (age) => {
  const n = Number(age);
  return Number.isFinite(n) && n > 0 ? `${Math.floor(n / 10) * 10}대` : '연령대 미상';
};

function insurerHtml(insurer) {
  const name = String(insurer || '보험사 미상');
  const slug = insurerSlugForName(name);
  return slug ? `<a href="/company/${esc(slug)}">${esc(name)}</a>` : esc(name);
}

export async function onRequestGet({ params, env }) {
  const disease = diseaseFromParam(params.disease);
  const rows = (await env.DB.prepare(
    `SELECT category, insurer, gender, age, elapsed_period, join_condition, result, summary, reliability, created_at
     FROM ic_insurance_cases
     WHERE ${CASES_INDEX_WHERE} AND TRIM(COALESCE(disease,'')) = ?
     ORDER BY reliability DESC, created_at DESC`
  ).bind(disease).all()).results || [];
  if (!rows.length) return new Response('Not found', { status: 404 });

  const underwriting = rows.filter((r) => r.category === 'underwrite' || r.category === 'disclosure').length;
  const indexable = isCasesIndexable({ count: rows.length, underwriting });
  const insurers = [...new Set(rows.map((r) => r.insurer).filter(Boolean))];
  const title = `${disease} 보험 가입·고지·보상 사례 ${rows.length}건 | InsureConnect`;
  const description = `${disease} 실제 사례 ${rows.length}건, ${insurers.length}개 보험사의 가입·고지·보상 정보. 유사 사례가 있어도 개인별 심사 결과는 달라질 수 있습니다.`.slice(0, 160);
  const contributors = await loadCaseContributors(env, disease, 3);
  const contributorHtml = contributors.length
    ? `<section class="card"><h2>사례 기여</h2><p>이 페이지는 설계사 ${contributors.length}명의 실제 사례 기여로 만들어졌습니다.</p><ul class="rel">${contributors.map((r) => `<li>${esc(mask(r.nickname))} · ${esc(r.n)}건</li>`).join('')}</ul></section>`
    : '';

  const section = (categories, label) => {
    const list = rows.filter((r) => categories.includes(r.category));
    return list.length
      ? `<section class="card"><h2>${label}</h2><ul class="rel">${list.map((r) => {
        const gender = r.gender ? ` · ${esc(r.gender)}` : '';
        const created = r.created_at ? ` · ${esc(String(r.created_at).slice(0, 10))}` : '';
        return `<li><strong>${esc(r.result || '결과 미상')}</strong> · ${insurerHtml(r.insurer)}${gender} · ${esc(ageBand(r.age))} · ${esc(r.elapsed_period || '')} · ${esc(r.join_condition || '')} · ${esc(r.summary || '')} (${esc(r.reliability)}${created})</li>`;
      }).join('')}</ul></section>`
      : '';
  };

  const url = `${SITE}${caseDiseaseUrl(disease)}`;
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '질병별 사례', item: `${SITE}/cases` },
      { '@type': 'ListItem', position: 3, name: disease, item: url },
    ],
  };
  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url,
    mainEntity: {
      '@type': 'ItemList', numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.result || '보험 사례' })),
    },
  };
  const bodyHtml = `${section(['underwrite'], '인수심사')}${section(['disclosure'], '고지')}${section(['claim'], '보상')}${contributorHtml}
<section class="card"><p>유사 사례가 있어도 개인별 심사 결과는 달라질 수 있습니다.</p><p><a href="/?case_submit=1">사례 제출하기: 제출 +10P · 승인 +20P</a></p></section>`;
  const html = renderPage({
    title,
    description,
    robots: indexable ? 'index,follow' : 'noindex,follow',
    canonical: indexable ? url : '',
    jsonLd: [breadcrumbLd, collection],
    breadcrumb: [
      { label: '홈', href: '/' },
      { label: '질병별 사례', href: '/cases' },
      { label: disease },
    ],
    headerHtml: `<span class="badge">질병별 사례</span><h1>${esc(disease)} 보험 가입·고지·보상 사례</h1><p>승인된 실제 사례 ${rows.length}건을 확인하세요.</p>`,
    bodyHtml,
    site: SITE,
  });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300' } });
}
