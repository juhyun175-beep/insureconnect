/**
 * v2.1.62: 보험사별 전산/청구 SSR 랜딩 (프로그래매틱 SEO)
 *   GET /company/{slug}
 *   타깃 검색: "삼성생명 전산 바로가기", "현대해상 청구 팩스번호", "메리츠화재 보상 전화" 등
 */
import { INSURERS, INSURER_MAP, TYPE_LABEL } from '../_lib/insurers.js';
import { insurerNames } from '../_lib/insurers.js';
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';
import { seoPostingWidget } from '../_lib/posting-widget.js';
import { renderAggregation, AGGREGATIONS, renderClaimFormsHub } from '../_lib/company-aggregation.js';
import { pickRelatedPosts, relatedHtml, crossLinkHtml } from '../_lib/seo-links.js';
import { loadCompanyContent } from '../_lib/company-content.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const isPhone = (s) => /\d{3,}/.test(String(s || ''));

const ALIAS_SLOTS = 8;
const GENDER_LABEL = { M: '남성', F: '여성', male: '남성', female: '여성', 남: '남성', 여: '여성', any: '공통' };
const CATEGORY_LABEL = { underwrite: '인수심사', disclosure: '고지', claim: '보상' };

function aliasBinds(slug) {
  const names = insurerNames(slug).slice(0, ALIAS_SLOTS);
  return [...names, ...Array(ALIAS_SLOTS - names.length).fill(null)];
}

function plainText(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderCoverageSection(ins, coverages) {
  if (!coverages.length) return { html: '', jsonLd: '' };
  const rows = coverages.map((coverage) => {
    const payMaturity = [coverage.payment_period, coverage.maturity_period].filter(Boolean).join(' / ');
    return `<tr>
      <td>${esc(coverage.product_name)}</td><td>${esc(coverage.coverage_name)}</td>
      <td>${esc(coverage.join_amount)}</td><td>${esc(coverage.join_age)}</td>
      <td>${esc(payMaturity)}</td><td>${esc(coverage.gender)}</td>
    </tr>`;
  }).join('');
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${ins.name} 주요 담보 · 가입금액`,
    numberOfItems: coverages.length,
    itemListElement: coverages.map((coverage, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: [coverage.product_name, coverage.coverage_name].filter(Boolean).join(' · '),
        description: [
          coverage.join_amount && `가입금액 ${coverage.join_amount}`,
          coverage.join_age && `가입나이 ${coverage.join_age}`,
          coverage.payment_period,
          coverage.maturity_period,
          coverage.gender,
        ].filter(Boolean).join(' · '),
      },
    })),
  };
  return {
    jsonLd: ld(itemList),
    html: `<section class="card">
  <h2>${esc(ins.name)} 주요 담보 · 가입금액</h2>
  <div class="data-table-wrap"><table class="data-table">
    <thead><tr><th>상품명</th><th>담보명</th><th>가입금액</th><th>가입나이</th><th>납입/만기</th><th>성별</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</section>`,
  };
}

function renderCaseSection(ins, cases) {
  if (cases.length < 3) return '';
  const items = cases.map((item) => {
    const topic = item.disease || CATEGORY_LABEL[item.category] || '보험 사례';
    const demographic = [item.age != null ? `${item.age}세` : '', GENDER_LABEL[item.gender] || item.gender].filter(Boolean).join(' ');
    const outcome = [item.join_condition, item.result].filter(Boolean).join(' → ');
    const reliability = Number.isFinite(Number(item.reliability))
      ? `<span class="reliability">신뢰도 ${esc(item.reliability)}</span>`
      : '';
    return `<li>
      <div class="case-title"><strong>[${esc(topic)}] ${esc(demographic)}</strong>${reliability}</div>
      ${outcome ? `<div class="case-outcome">${esc(outcome)}</div>` : ''}
      ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
    </li>`;
  }).join('');
  return `<section class="card">
  <h2>${esc(ins.name)} 인수 · 보상 사례</h2>
  <ul class="case-list">${items}</ul>
</section>`;
}

function renderBoardSection(ins, boardPosts) {
  if (!boardPosts.length) return '';
  const items = boardPosts.map((post) => {
    const excerpt = plainText(post.content).slice(0, 180);
    const date = post.created_at ? String(post.created_at).slice(0, 10) : '';
    return `<li><a href="/og/board/${encodeURIComponent(post.id)}">${esc(post.title)}</a>
      ${excerpt ? `<p>${esc(excerpt)}</p>` : ''}${date ? `<time datetime="${esc(date)}">${esc(date)}</time>` : ''}</li>`;
  }).join('');
  return `<section class="card">
  <h2>설계사들이 ${esc(ins.name)}에 대해 나눈 이야기</h2>
  <ul class="story-list">${items}</ul>
</section>`;
}

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
  const cfNames = aliasBinds(ins.slug);
  const [relatedPosts, companyContent, claimFormRows] = await Promise.all([
    pickRelatedPosts(
      env.DB,
      ins.slug,
      ['claim', 'actual-loss', 'terms', 'surgery-code', 'disease-code'],
    ),
    loadCompanyContent(env, ins),
    env.DB.prepare(
      `SELECT title, file_url, file_type
       FROM ic_claim_forms
       WHERE company IN (?, ?, ?, ?, ?, ?, ?, ?)
       ORDER BY created_at DESC`
    ).bind(...cfNames).all().then((rs) => rs.results || []).catch(() => []),
  ]);
  const claimForms = claimFormRows.filter((form) => form.file_url);

  const typeLabel = TYPE_LABEL[ins.type] || '보험';
  const url = `${SITE}/company/${ins.slug}`;
  const title = `${ins.name} 전산 바로가기·고객센터·청구${claimForms.length ? '서류' : ''} 안내`;
  const desc = `${ins.name} 설계사 전산(사이버창구) 바로가기, 대표전화 ${ins.call}, 보상접수 ${ins.incall}, 청구 팩스 ${ins.fax}, ${claimForms.length ? '보험금 청구서류 양식 다운로드, ' : ''}상품공시실 링크를 한 곳에 정리했습니다.`;

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
  const coverageSection = renderCoverageSection(ins, companyContent.coverages);
  const coverageHtml = coverageSection.html;
  const coverageLd = coverageSection.jsonLd;
  const casesHtml = renderCaseSection(ins, companyContent.cases);
  const boardHtml = renderBoardSection(ins, companyContent.boardPosts);
  const faxRow = isPhone(ins.fax)
    ? `<tr><th>청구 팩스</th><td><a href="#" onclick="return false">${esc(ins.fax)}</a></td></tr>`
    : `<tr><th>청구 팩스</th><td>${esc(ins.fax)}</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)} | InsureConnect</title>
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
<meta name="twitter:card" content="summary">
  ${ld(orgLd)}
  ${ld(faqLd)}
  ${ld(breadcrumbLd)}
  ${coverageLd}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;line-height:1.7;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:760px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:0 16px}
header.c-head{background:#fff;border-radius:14px;padding:28px 26px;box-shadow:0 4px 16px rgba(0,0,0,0.04);margin-bottom:16px}
header.c-head .badge{display:inline-block;background:#eff6ff;color:#1a3de8;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:10px}
header.c-head h1{margin:0 0 6px;font-size:26px;color:#0f172a;letter-spacing:-0.02em}
header.c-head p{margin:0;color:#6b7280;font-size:14px}
.cta-erp{display:block;text-align:center;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px;border-radius:12px;margin:16px 0}
.card{background:#fff;border-radius:14px;padding:22px 24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:16px}
.card h2{margin:0 0 12px;font-size:18px;color:#0f172a}
table.info{width:100%;border-collapse:collapse}
table.info th{text-align:left;width:120px;color:#6b7280;font-weight:600;padding:9px 0;vertical-align:top;font-size:14px}
table.info td{padding:9px 0;color:#1f2937;font-weight:600;border-bottom:1px solid #f1f5f9}
table.info a{color:#1a3de8;text-decoration:none}
.cf-list{list-style:none;padding:0;margin:0}
.cf-list li{padding:11px 0;border-bottom:1px solid #f1f5f9}
.cf-list a{color:#1a3de8;text-decoration:none;font-weight:700;display:flex;align-items:center;gap:8px}
.cf-ft{font-size:10.5px;font-weight:800;color:#fff;background:#ef4444;padding:2px 7px;border-radius:5px}
.data-table-wrap{overflow-x:auto}.data-table{width:100%;min-width:680px;border-collapse:collapse;font-size:13px}.data-table th{padding:9px 8px;text-align:left;color:#475569;background:#f8fafc;border-bottom:2px solid #e2e8f0;white-space:nowrap}.data-table td{padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}.data-table td:nth-child(3){font-weight:800;color:#1e3a8a;white-space:nowrap}
.case-list,.story-list{list-style:none;padding:0;margin:0}.case-list li,.story-list li{padding:13px 0;border-bottom:1px solid #e5e7eb}.case-list li:last-child,.story-list li:last-child{border-bottom:0}.case-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.case-outcome{margin-top:5px;color:#1e3a8a;font-weight:700}.case-list p,.story-list p{margin:5px 0 0;color:#475569;font-size:13px}.reliability{flex:none;font-size:10.5px;font-weight:800;color:#047857;background:#d1fae5;padding:2px 7px;border-radius:999px}.story-list a{color:#1a3de8;text-decoration:none;font-weight:800}.story-list time{display:block;margin-top:5px;color:#94a3b8;font-size:11px}
.btn-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.btn-row a{display:inline-block;background:#eff6ff;color:#1a3de8;text-decoration:none;font-weight:700;font-size:14px;padding:9px 16px;border-radius:9px}
.faq dl{margin:0 0 12px}.faq dt{font-weight:700;color:#1e3a8a;margin-bottom:4px}.faq dd{margin:0;color:#374151}
.rel ul{list-style:none;padding:0;margin:0}.rel li{padding:9px 0;border-bottom:1px solid #f1f5f9}.rel a{color:#1a3de8;text-decoration:none;font-weight:600}
.note{font-size:12px;color:#9ca3af;margin-top:8px}
@media(max-width:640px){header.c-head,.card{border-radius:0}.wrap{padding:0}.crumb{padding:12px 16px}}
</style>
</head>
<body>
<nav class="crumb" aria-label="breadcrumb"><a href="/">홈</a> &raquo; <a href="/company">보험사 전산</a> &raquo; <span>${esc(ins.name)}</span></nav>
<div class="wrap">
<header class="c-head">
  <span class="badge">${esc(typeLabel)}</span>
  <h1>${esc(ins.name)} 전산 바로가기 · 청구 안내</h1>
  <p>${esc(ins.name)} 설계사 전산(사이버창구) 접속, 고객센터·보상접수 전화, 청구 팩스번호, 상품공시실을 한 곳에 정리했습니다.</p>
  <a class="cta-erp" href="${esc(ins.erp)}" target="_blank" rel="noopener nofollow">🖥 ${esc(ins.name)} 전산 바로가기 →</a>
</header>

<section class="card">
  <h2>고객센터 · 보상 연락처</h2>
  <table class="info">
    <tr><th>대표전화</th><td>${esc(ins.call)}</td></tr>
    <tr><th>보상·접수</th><td>${esc(ins.incall)}</td></tr>
    ${faxRow}
  </table>
  <p class="note">※ 청구 팩스·접수처는 상품(실손/정액)에 따라 다를 수 있어, 청구 전 콜센터로 확인을 권장합니다.</p>
</section>
${coverageHtml}
${casesHtml}
${cfHtml}
${boardHtml}
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
</div>
${postingWidget}
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
};
