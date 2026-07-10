/**
 * v2.1.66: 보험사 정보 집계(허브) 페이지 — 신규 유입용 프로그래매틱 SEO
 *   /company/customer-center, /company/claim-fax
 *   - broad 고검색량 쿼리("보험사 고객센터 번호", "보험금 청구 팩스번호") 타깃
 *   - 32개 상세(/company/{slug})로 내부링크 분배 (hub-spoke)
 *   - v2.114.0: seoPostingWidget은 renderAggregation(env 미전달 구조) 범위 밖.
 */
import { INSURERS, TYPE_LABEL } from './insurers.js';
import { seoCtaFooter, seoShareBar } from './seo-cta.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

export const AGGREGATIONS = {
  'customer-center': {
    h1: '보험사 고객센터 전화번호 총정리 (생보·손보 32곳)',
    title: '보험사 고객센터 전화번호 모음 — 생명·손해보험 대표/보상 접수',
    desc: '삼성생명·삼성화재·메리츠화재·현대해상 등 국내 생명·손해보험사 32곳의 대표 고객센터 전화번호와 보험금 보상 접수 번호를 한 표로 정리했습니다.',
    intro: '보험금 문의나 상담 시 필요한 보험사별 대표전화와 보상 접수 번호입니다. 보험사명을 누르면 전산 바로가기·청구 팩스·상품공시까지 확인할 수 있습니다.',
    cols: ['보험사', '대표전화', '보상·접수'],
    row: (i) => [i.call, i.incall],
    faq: [
      { q: '보험사 고객센터는 어디로 전화하나요?', a: '위 표에서 가입한 보험사의 대표전화로 연결하면 됩니다. 보험금 보상·접수는 별도 번호가 있는 경우가 많아 함께 정리했습니다.' },
      { q: '보험금 접수 번호가 대표전화와 다른가요?', a: '많은 보험사가 일반 상담과 보상 접수 회선을 구분합니다. 표의 "보상·접수" 번호를 이용하면 더 빠릅니다.' },
    ],
  },
  'claim-fax': {
    h1: '보험사 보험금 청구 팩스번호 모음 (32곳)',
    title: '보험금 청구 팩스번호 모음 — 보험사별 청구 서류 팩스',
    desc: '보험금 청구 서류를 팩스로 접수할 때 필요한 국내 보험사 32곳의 청구 팩스번호를 정리했습니다. 실손/정액에 따라 접수처가 다를 수 있어 콜센터 확인을 권장합니다.',
    intro: '보험금 청구 서류는 모바일 앱·팩스·방문으로 접수할 수 있습니다. 아래는 보험사별 청구 팩스번호입니다. 상품(실손/정액)에 따라 접수처가 다를 수 있으니 청구 전 콜센터 확인을 권장합니다.',
    cols: ['보험사', '청구 팩스', '대표전화'],
    row: (i) => [i.fax, i.call],
    faq: [
      { q: '보험금 청구를 팩스로 해도 되나요?', a: '대부분의 보험사가 팩스 청구를 받습니다. 위 표의 청구 팩스번호로 보험금청구서·진단서·영수증 등을 보내면 됩니다. 다만 모바일 앱 청구가 더 빠를 수 있습니다.' },
      { q: '청구 팩스번호가 "가상번호 부여"라고 되어 있어요.', a: '일부 보험사는 청구 건마다 가상 팩스번호를 부여합니다. 콜센터에 청구 의사를 알리면 전용 번호를 안내받을 수 있습니다.' },
    ],
  },
};

const NAME_TO_SLUG = Object.fromEntries(INSURERS.map(i => [i.name, i.slug]));
const CF_ALIAS_TO_NAME = { '라이나손보': '라이나손해보험' };

/** 보험사 청구서류 양식 다운로드 허브 — /company/claim-forms (D1 조회, async) */
export async function renderClaimFormsHub(env, SITE) {
  const url = `${SITE}/company/claim-forms`;
  let rows = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT company, title, file_url, file_type FROM ic_claim_forms WHERE file_url IS NOT NULL ORDER BY company ASC, created_at DESC`
    ).all();
    rows = rs.results || [];
  } catch (_) {}

  const byCompany = new Map();
  for (const r of rows) {
    if (!byCompany.has(r.company)) byCompany.set(r.company, []);
    byCompany.get(r.company).push(r);
  }

  // v2.8.7(성장): 32개 전 보험사 표시 — 허브→상세 내부링크 극대화(SEO 분배·롱테일 커버리지)
  const CANON_TO_ALIAS = Object.fromEntries(Object.entries(CF_ALIAS_TO_NAME).map(([alias, canon]) => [canon, alias]));
  const ordered = [...INSURERS].sort((a, b) => (a.type === b.type ? 0 : a.type === 'life' ? -1 : 1));
  let withForms = 0;
  const cardsHtml = ordered.map(ins => {
    const forms = byCompany.get(ins.name) || byCompany.get(CANON_TO_ALIAS[ins.name]) || [];
    const nameHtml = `<a href="/company/${ins.slug}">${esc(ins.name)}</a>`;
    if (forms.length) {
      withForms++;
      const items = forms.map(f => {
        const label = (f.title || '청구서').trim();
        const ft = String(f.file_type || 'pdf').toUpperCase();
        return `<li><a href="${esc(f.file_url)}" target="_blank" rel="noopener" download>📎 ${esc(label)} 청구서 양식 <span class="ft">${esc(ft)}</span></a></li>`;
      }).join('');
      return `<div class="cf-card"><h3>${nameHtml}</h3><ul>${items}</ul></div>`;
    }
    return `<div class="cf-card cf-empty"><h3>${nameHtml}</h3><p class="cf-na">청구서류 양식 준비중 · <a href="/company/${ins.slug}">전산·청구 안내 →</a></p></div>`;
  }).join('');

  const faq = [
    { q: '보험금 청구서 양식은 무료인가요?', a: '네, 이 페이지의 보험사별 청구서 양식(PDF)은 무료로 다운로드할 수 있습니다. 작성 후 앱·팩스·방문으로 제출하세요.' },
    { q: '청구서 양식만 내면 보험금이 지급되나요?', a: '청구서 외에 진단서·영수증·세부내역서 등 보장 항목별 서류가 필요합니다. 보험사별 상세 안내는 각 보험사 페이지를 참고하세요.' },
  ];
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '보험사 전산', item: `${SITE}/company` },
      { '@type': 'ListItem', position: 3, name: '보험금 청구서류 양식', item: url },
    ] };
  const faqHtml = faq.map(f => `<dl><dt>Q. ${esc(f.q)}</dt><dd>${esc(f.a)}</dd></dl>`).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>보험사 보험금 청구서류 양식 다운로드 모음 | InsureConnect</title>
<meta name="description" content="삼성생명·현대해상·메리츠화재·삼성화재 등 보험사별 보험금 청구서 양식(PDF)을 한 곳에서 무료로 다운로드하세요. 청구서류 작성·제출 안내 포함.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${url}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="보험사 보험금 청구서류 양식 다운로드 모음 | InsureConnect">
<meta property="og:description" content="보험사별 보험금 청구서 양식(PDF) 무료 다운로드">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/logo-full.png">
${ld(faqLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;line-height:1.7;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:900px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.h{max-width:900px;margin:0 auto 20px;padding:28px 26px;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:25px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.92;font-size:14px}
.wrap{max-width:900px;margin:0 auto;padding:0 16px}
.cf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.cf-card{background:#fff;border-radius:12px;padding:16px 18px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.cf-card h3{margin:0 0 8px;font-size:15px}.cf-card h3 a{color:#1a3de8;text-decoration:none}
.cf-card ul{list-style:none;padding:0;margin:0}
.cf-card li{padding:7px 0;border-top:1px solid #f1f5f9}
.cf-card a{color:#374151;text-decoration:none;font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:6px}
.ft{font-size:10px;font-weight:800;color:#fff;background:#ef4444;padding:1px 6px;border-radius:5px}
.cf-empty{opacity:0.92}
.cf-na{margin:6px 0 0;font-size:12.5px;color:#94a3b8}
.cf-na a{color:#1a3de8;font-weight:600;text-decoration:none}
.faq{background:#eff6ff;border-left:4px solid #1a3de8;border-radius:14px;padding:22px 24px;margin:22px 0}
.faq h2{margin-top:0;color:#1e3a8a}.faq dt{font-weight:700;color:#1e3a8a;margin-bottom:4px}.faq dd{margin:0 0 12px;color:#374151}
@media(max-width:640px){header.h{border-radius:0}.wrap{padding:0 12px}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <a href="/company">보험사 전산</a> &raquo; <span>보험금 청구서류 양식</span></nav>
<header class="h">
  <h1>보험사 보험금 청구서류 양식 다운로드</h1>
  <p>보험사별 보험금 청구서 양식(PDF)을 무료로 내려받으세요. 현재 ${INSURERS.length}개사 중 ${withForms}개사 등록 완료. 보험사명을 누르면 전산·고객센터·청구 안내도 볼 수 있습니다.</p>
</header>
<div class="wrap">
<div class="cf-grid">${cardsHtml || '<p>등록된 청구서류가 없습니다.</p>'}</div>
${seoShareBar(url, '보험사 보험금 청구서류 양식 다운로드 모음', '보험사별 청구서 양식 PDF 무료 다운로드', `${SITE}/logo-full.png`)}
<div class="faq"><h2>자주 묻는 질문</h2>${faqHtml}</div>
</div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=1800' },
  });
}

export function renderAggregation(slug, SITE) {
  const cfg = AGGREGATIONS[slug];
  if (!cfg) return null;
  const url = `${SITE}/company/${slug}`;

  const life = INSURERS.filter(i => i.type === 'life');
  const nonlife = INSURERS.filter(i => i.type === 'nonlife');

  const rowsHtml = (arr) => arr.map(i => {
    const cells = cfg.row(i).map(v => `<td>${esc(v)}</td>`).join('');
    return `<tr><th scope="row"><a href="/company/${i.slug}">${esc(i.name)}</a></th>${cells}</tr>`;
  }).join('');

  const tableFor = (label, arr) => `
    <h2>${esc(label)}</h2>
    <table class="agg">
      <thead><tr>${cfg.cols.map((c, idx) => idx === 0 ? `<th scope="col">${esc(c)}</th>` : `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml(arr)}</tbody>
    </table>`;

  const faqHtml = cfg.faq.map(f => `<dl><dt>Q. ${esc(f.q)}</dt><dd>${esc(f.a)}</dd></dl>`).join('');
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: cfg.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '보험사 전산', item: `${SITE}/company` },
      { '@type': 'ListItem', position: 3, name: cfg.h1, item: url },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(cfg.title)} | InsureConnect</title>
<meta name="description" content="${esc(cfg.desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${url}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:title" content="${esc(cfg.title)}">
<meta property="og:description" content="${esc(cfg.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/logo-full.png">
<meta name="twitter:card" content="summary">
${ld(faqLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;line-height:1.7;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:860px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:860px;margin:0 auto;padding:0 16px}
header.h{background:#fff;border-radius:14px;padding:26px 26px;box-shadow:0 4px 16px rgba(0,0,0,0.04);margin-bottom:16px}
header.h h1{margin:0 0 8px;font-size:25px;color:#0f172a;letter-spacing:-0.02em}
header.h p{margin:0;color:#6b7280;font-size:14px}
h2{font-size:18px;color:#0f172a;margin:22px 0 10px}
table.agg{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);font-size:14px}
table.agg th[scope=col]{background:#eff6ff;color:#1a3de8;text-align:left;padding:11px 14px;font-size:13px}
table.agg th[scope=row]{text-align:left;padding:11px 14px;border-top:1px solid #f1f5f9;white-space:nowrap}
table.agg th[scope=row] a{color:#1a3de8;text-decoration:none;font-weight:700}
table.agg td{padding:11px 14px;border-top:1px solid #f1f5f9;color:#1f2937}
.faq{background:#eff6ff;border-left:4px solid #1a3de8;border-radius:14px;padding:22px 24px;margin:22px 0}
.faq h2{margin-top:0;color:#1e3a8a}.faq dt{font-weight:700;color:#1e3a8a;margin-bottom:4px}.faq dd{margin:0 0 12px;color:#374151}
.note{font-size:12px;color:#9ca3af;margin-top:10px}
@media(max-width:640px){header.h{border-radius:0}.wrap{padding:0}.crumb{padding:12px 16px}table.agg{font-size:13px}}
</style>
</head>
<body>
<nav class="crumb" aria-label="breadcrumb"><a href="/">홈</a> &raquo; <a href="/company">보험사 전산</a> &raquo; <span>${esc(cfg.h1)}</span></nav>
<div class="wrap">
<header class="h">
  <h1>${esc(cfg.h1)}</h1>
  <p>${esc(cfg.intro)}</p>
</header>
${tableFor('🟦 생명보험', life)}
${tableFor('🟧 손해보험', nonlife)}
<p class="note">※ 번호·접수처는 변경될 수 있습니다. 정확한 정보는 각 보험사 공식 안내를 확인하세요. 보험사명을 누르면 전산·청구·공시 안내를 볼 수 있습니다.</p>
${seoShareBar(url, cfg.h1, cfg.desc, `${SITE}/logo-full.png`)}
<div class="faq">
  <h2>자주 묻는 질문</h2>
  ${faqHtml}
</div>
</div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
}
