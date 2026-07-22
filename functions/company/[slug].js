/**
 * v2.1.62: 보험사별 전산/청구 SSR 랜딩 (프로그래매틱 SEO)
 *   GET /company/{slug}
 *   타깃 검색: "삼성생명 전산 바로가기", "현대해상 청구 팩스번호", "메리츠화재 보상 전화" 등
 */
import { INSURERS, INSURER_MAP, TYPE_LABEL } from '../_lib/insurers.js';
import { safeInsurerNames } from '../_lib/insurers.js';
import { loadCompanyContent } from '../_lib/company-content.js';
import { seoShareBar } from '../_lib/seo-cta.js';
import { seoPostingWidget } from '../_lib/posting-widget.js';
import { renderAggregation, AGGREGATIONS, renderClaimFormsHub } from '../_lib/company-aggregation.js';
import { pickRelatedPosts, relatedHtml, crossLinkHtml } from '../_lib/seo-links.js';
import { caseDiseaseUrl, CASES_INDEX_WHERE, isCasesIndexable } from '../_lib/cases-seo.js';
import { renderPage } from '../_lib/ssr-shell.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const isPhone = (s) => /\d{3,}/.test(String(s || ''));

const displayValue = (value) => String(value == null ? '' : value).trim() || '-';
const excerpt = (value, length = 150) => {
  const text = String(value == null ? '' : value).trim();
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};
const caseCategory = (category) => ({
  underwrite: '인수',
  disclosure: '고지',
  claim: '청구',
}[category] || '보험');

export const onRequestGet = async ({ params, env }) => {
  const ins = INSURER_MAP[params.slug];
  if (!ins) {
    // 청구서류 양식 허브 — /company/claim-forms
    if (params.slug === 'claim-forms') {
      const r = await renderClaimFormsHub(env, SITE);
      if (r) return r;
    }
    // 집계(허브) 페이지 — /company/customer-center, /company/claim-fax
    if (AGGREGATIONS[params.slug]) {
      const r = renderAggregation(params.slug, SITE);
      if (r) return r;
    }
    return new Response('Not found', { status: 404 });
  }

  const postingWidget = await seoPostingWidget(env);
  const relatedPosts = await pickRelatedPosts(
    env.DB,
    ins.slug,
    ['claim', 'actual-loss', 'terms', 'surgery-code', 'disease-code'],
  );
  const { coverages, cases } = await loadCompanyContent(env, ins);
  const safeNames = safeInsurerNames(ins.slug);
  const safeNamePlaceholders = safeNames.map(() => '?').join(',');
  let caseLinks = [];
  try {
    const rs = await env.DB.prepare(`SELECT TRIM(COALESCE(disease,'')) disease, COUNT(*) count,
      SUM(CASE WHEN category IN ('underwrite','disclosure') THEN 1 ELSE 0 END) underwriting
      FROM ic_insurance_cases WHERE ${CASES_INDEX_WHERE} AND insurer IN (${safeNamePlaceholders})
      GROUP BY TRIM(COALESCE(disease,''))`).bind(...safeNames).all();
    caseLinks = (rs.results || []).filter(isCasesIndexable);
  } catch (_) {}

  // 보험금 청구서류 양식 (D1)
  let claimForms = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT title, file_url, file_type FROM ic_claim_forms WHERE company IN (${safeNamePlaceholders}) ORDER BY created_at DESC`
    ).bind(...safeNames).all();
    claimForms = (rs.results || []).filter(f => f.file_url);
  } catch (_) {}

  const typeLabel = TYPE_LABEL[ins.type] || '보험';
  const url = `${SITE}/company/${ins.slug}`;
  const title = `${ins.name} 설계사 전산(사이버창구) 바로가기·청구${claimForms.length ? '서류' : ''} 안내`;
  const faxGuide = isPhone(ins.fax)
    ? '청구 팩스번호 안내'
    : /가상번호/.test(String(ins.fax || ''))
      ? '청구 팩스 가상번호 발급 안내'
      : '보험금 청구 접수 방법 안내';
  const desc = `${ins.name} 사이버창구 원클릭 접속. ${faxGuide}, `
    + `${claimForms.length ? '청구서류 양식 다운로드, ' : ''}`
    + `${coverages.length ? '특약별 가입금액, ' : ''}`
    + `${cases.length ? '실제 인수·청구 사례, ' : ''}`
    + '상품공시실까지 한 곳에. 대표·보상 전화 안내 포함.';

  // FAQ (보험사별 데이터로 구성 → FAQPage 리치결과)
  const faqs = [
    { q: `${ins.name} 대표 고객센터 전화번호는?`, a: `${ins.name} 대표전화는 ${ins.call} 입니다.${isPhone(ins.incall) && ins.incall !== ins.call ? ` 보험금 보상·접수 문의는 ${ins.incall} 로 연결됩니다.` : ''}` },
    { q: `${ins.name} 보험금 청구는 어떻게 하나요?`, a: `${ins.name}은 모바일 앱·팩스·방문 등으로 청구할 수 있습니다.${isPhone(ins.fax) ? ` 청구 서류 팩스번호는 ${ins.fax} 입니다.` : ` 청구 팩스는 "${ins.fax}" 방식입니다.`} 실손은 영수증·세부내역서, 진단비는 진단서가 기본 서류입니다.` },
    { q: `${ins.name} 설계사 전산(사이버창구)은 어디서 접속하나요?`, a: `이 페이지의 "전산 바로가기" 버튼으로 ${ins.name} 공식 설계사 전산에 접속할 수 있습니다.` },
    { q: `${ins.name} 상품공시는 어디서 확인하나요?`, a: `${ins.name} 공식 상품공시실에서 판매 상품과 약관을 확인할 수 있습니다. 이 페이지의 "상품공시실" 링크를 이용하세요.` },
  ];
  if (claimForms.length) {
    faqs.splice(2, 0, { q: `${ins.name} 보험금 청구서류 양식은 어디서 받나요?`, a: `이 페이지의 "보험금 청구서류 양식 다운로드"에서 ${ins.name} 청구서 양식(PDF)을 무료로 내려받을 수 있습니다.` });
  }
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const orgLd = {
    '@context': 'https://schema.org', '@type': 'InsuranceAgency',
    name: ins.name, url,
    contactPoint: [
      { '@type': 'ContactPoint', telephone: ins.call, contactType: 'customer service', areaServed: 'KR', availableLanguage: 'Korean' },
      ...(isPhone(ins.incall) && ins.incall !== ins.call ? [{ '@type': 'ContactPoint', telephone: ins.incall, contactType: 'claims', areaServed: 'KR' }] : []),
    ],
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '보험사 전산', item: `${SITE}/company` },
      { '@type': 'ListItem', position: 3, name: ins.name, item: url },
    ],
  };

  const faqHtml = faqs.map(f => `<dl><dt>Q. ${esc(f.q)}</dt><dd>${esc(f.a)}</dd></dl>`).join('');
  const coverageTotal = Math.max(
    coverages.length,
    Number(coverages[0]?.total_count) || 0,
  );
  const hiddenCoverageCount = Math.max(0, coverageTotal - coverages.length);
  const coveragesHtml = coverages.length ? `
<section class="card coverage-section">
  <h2>🧾 ${esc(ins.name)} 주요 특약·가입금액</h2>
  <div class="coverage-table-wrap">
    <table class="coverage-table">
      <thead><tr><th>상품</th><th>특약</th><th>가입금액</th><th>가입나이</th><th>납입·만기</th></tr></thead>
      <tbody>${coverages.map((coverage) => {
        const periods = [coverage.payment_period, coverage.maturity_period]
          .map(displayValue).filter((value) => value !== '-').join(' · ') || '-';
        return `<tr><td>${esc(displayValue(coverage.product_name))}</td><td>${esc(displayValue(coverage.coverage_name))}</td><td>${esc(displayValue(coverage.join_amount))}</td><td>${esc(displayValue(coverage.join_age))}</td><td>${esc(periods)}</td></tr>`;
      }).join('')}</tbody>
    </table>
  </div>
  <p class="note">승인된 담보 ${coverageTotal}개 중 ${coverages.length}개 표시${hiddenCoverageCount ? ` · 표시 외 ${hiddenCoverageCount}개` : ''}</p>
</section>` : '';
  const casesHtml = cases.length ? `
<section class="card cases-section">
  <h2>💡 ${esc(ins.name)} 실제 인수·청구 사례</h2>
  <div class="case-grid">
    ${cases.map((item) => {
      const profile = [item.gender, item.age].map(displayValue).filter((value) => value !== '-').join(' · ');
      return `<article class="case-card"><div class="case-card-head"><span class="case-badge">${esc(caseCategory(item.category))}</span><strong>${esc(displayValue(item.disease))}</strong></div>${profile ? `<p class="case-profile">${esc(profile)}</p>` : ''}${item.join_condition ? `<p><b>가입조건</b> ${esc(excerpt(item.join_condition, 100))}</p>` : ''}${item.result ? `<p><b>결과</b> ${esc(excerpt(item.result, 100))}</p>` : ''}${item.summary ? `<p>${esc(excerpt(item.summary))}</p>` : ''}${Number(item.reliability) > 0 ? `<span class="case-reliability">신뢰도 ${esc(item.reliability)}</span>` : ''}</article>`;
    }).join('')}
  </div>
</section>` : '';
  const cfHtml = claimForms.length ? `
<section class="card">
  <h2>📄 ${esc(ins.name)} 보험금 청구서류 양식 다운로드</h2>
  <ul class="cf-list">
    ${claimForms.map(f => {
      const label = (f.title || '청구서').trim();
      const ft = String(f.file_type || 'pdf').toUpperCase();
      return `<li><a href="${esc(f.file_url)}" target="_blank" rel="noopener" download>📎 ${esc(ins.name)} ${esc(label)} 청구서 양식 <span class="cf-ft">${esc(ft)}</span></a></li>`;
    }).join('')}
  </ul>
  <p class="note">※ ${esc(ins.name)} 공식 청구서류 양식입니다. 작성 후 모바일 앱·팩스·방문으로 제출하세요. 상품(실손/정액)에 따라 진단서·영수증 등 추가 서류가 필요할 수 있습니다.</p>
</section>` : '';
  const faxRow = isPhone(ins.fax)
    ? `<tr><th>청구 팩스</th><td><a href="#" onclick="return false">${esc(ins.fax)}</a></td></tr>`
    : `<tr><th>청구 팩스</th><td>${esc(ins.fax)}</td></tr>`;

  const headerHtml = `
  <span class="badge">${esc(typeLabel)}</span>
  <h1>${esc(ins.name)} 전산 바로가기 · 청구 안내</h1>
  <p>${esc(ins.name)} 설계사 전산(사이버창구) 접속, 고객센터·보상접수 전화, 청구 팩스번호, 상품공시실을 한 곳에 정리했습니다.</p>
  <a class="cta-erp" href="${esc(ins.erp)}" target="_blank" rel="noopener nofollow">🖥 ${esc(ins.name)} 전산 바로가기 →</a>
`;

  const bodyHtml = `
<section class="card">
  <h2>고객센터 · 보상 연락처</h2>
  <table class="info">
    <tr><th>대표전화</th><td>${esc(ins.call)}</td></tr>
    <tr><th>보상·접수</th><td>${esc(ins.incall)}</td></tr>
    ${faxRow}
  </table>
  <p class="note">※ 청구 팩스·접수처는 상품(실손/정액)에 따라 다를 수 있어, 청구 전 콜센터로 확인을 권장합니다.</p>
</section>
${coveragesHtml}
${casesHtml}
${cfHtml}
${seoShareBar(url, ins.name + ' 전산·청구 안내', desc, `${SITE}/logo-full.png`)}

<section class="card">
  <h2>전산 · 상품공시 바로가기</h2>
  <div class="btn-row">
    <a href="${esc(ins.erp)}" target="_blank" rel="noopener nofollow">설계사 전산 접속</a>
    <a href="${esc(ins.gongsi)}" target="_blank" rel="noopener nofollow">상품공시실</a>
  </div>
</section>

<section class="card faq">
  <h2>${esc(ins.name)} 자주 묻는 질문</h2>
  ${faqHtml}
</section>

${relatedHtml(relatedPosts, '보험금 청구가 처음이라면')}${crossLinkHtml(INSURERS.filter((peer) => peer.type === ins.type), ins.slug, '같은 유형의 보험사 전산', '/company/', ' 전산 바로가기')}
${caseLinks.length ? `<section class="card"><h2>질병별 보험 사례</h2><ul>${caseLinks.map(d => `<li><a href="${caseDiseaseUrl(d.disease)}">${esc(d.disease)} 사례 ${d.count}건</a></li>`).join('')}</ul></section>` : ''}
${postingWidget}
`;

  const html = renderPage({
    title: `${title} | InsureConnect`,
    description: desc,
    robots: 'index,follow',
    canonical: url,
    jsonLd: [orgLd, faqLd, breadcrumbLd],
    breadcrumb: [
      { label: '홈', href: '/' },
      { label: '보험사 전산', href: '/company' },
      { label: ins.name },
    ],
    headerHtml,
    bodyHtml,
    site: SITE,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
};
