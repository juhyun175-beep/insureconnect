/**
 * v2.1.68: GA(법인대리점)별 전산 SSR 랜딩 (프로그래매틱 SEO)
 *   GET /ga/{slug}  — 타깃: "지에이코리아 전산", "굿리치 로그인", "프라임에셋 전산 바로가기" 등
 */
import { GA_MAP } from '../_lib/ga-companies.js';
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

export const onRequestGet = async ({ params }) => {
  const ga = GA_MAP[params.slug];
  if (!ga) return new Response('Not found', { status: 404 });

  const url = `${SITE}/ga/${ga.slug}`;
  const homepage = `https://${ga.site}`;
  const title = `${ga.name} 전산 바로가기 (로그인)`;
  const desc = `${ga.name} 설계사 전산(ERP) 바로가기와 로그인 안내, 공식 홈페이지 링크를 정리했습니다. 법인보험대리점(GA) 소속 설계사 업무용 전산 접속 페이지입니다.`;

  const faqs = [
    { q: `${ga.name} 전산은 어디서 로그인하나요?`, a: `이 페이지의 "전산 바로가기" 버튼으로 ${ga.name} 공식 설계사 전산(ERP)에 접속할 수 있습니다. 소속 시 발급받은 아이디·비밀번호로 로그인하세요.` },
    { q: `${ga.name} 전산 비밀번호를 분실했어요.`, a: `전산 비밀번호 분실·초기화는 본인이 소속된 ${ga.name} 지점 또는 본사 전산 담당에 문의해야 합니다. 보안상 소속 GA를 통해서만 재발급됩니다.` },
    { q: `전산 접속이 안 되거나 보안프로그램 설치를 요구해요.`, a: `법인대리점 전산은 최초 접속 시 보안 프로그램(키보드보안·백신 등) 설치가 필요한 경우가 많습니다. 안내에 따라 설치 후 브라우저를 재시작하면 됩니다. PC 환경(권장 브라우저)도 확인하세요.` },
    { q: `GA(법인보험대리점)가 무엇인가요?`, a: `GA는 여러 보험사의 상품을 비교·판매할 수 있는 법인보험대리점입니다. ${ga.name} 같은 GA 소속 설계사는 전속과 달리 여러 보험사 상품을 함께 취급합니다.` },
  ];
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const orgLd = { '@context': 'https://schema.org', '@type': 'InsuranceAgency', name: ga.name, url, sameAs: [homepage] };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'GA 전산', item: `${SITE}/ga` },
      { '@type': 'ListItem', position: 3, name: ga.name, item: url },
    ] };

  const faqHtml = faqs.map(f => `<dl><dt>Q. ${esc(f.q)}</dt><dd>${esc(f.a)}</dd></dl>`).join('');
  const related = [
    ['/company', '보험사 전산·고객센터·청구 안내'],
    ['/insurance/practice/fp-income-structure', '설계사 수수료·소득 구조 이해'],
    ['/insurance/recruit-tips/career-fp-transition', '경력 설계사 이직 — 옮기기 전 점검'],
  ];

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
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;line-height:1.7;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:760px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:0 16px}
header.c-head{background:#fff;border-radius:14px;padding:28px 26px;box-shadow:0 4px 16px rgba(0,0,0,0.04);margin-bottom:16px}
header.c-head .badge{display:inline-block;background:#ecfdf5;color:#059669;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:10px}
header.c-head h1{margin:0 0 6px;font-size:25px;color:#0f172a;letter-spacing:-0.02em}
header.c-head p{margin:0;color:#6b7280;font-size:14px}
.cta-erp{display:block;text-align:center;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px;border-radius:12px;margin:16px 0}
.card{background:#fff;border-radius:14px;padding:22px 24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:16px}
.card h2{margin:0 0 12px;font-size:18px;color:#0f172a}
.steps{margin:0;padding-left:20px}.steps li{margin-bottom:8px;color:#374151}
.btn-row{display:flex;flex-wrap:wrap;gap:10px}
.btn-row a{display:inline-block;background:#eff6ff;color:#1a3de8;text-decoration:none;font-weight:700;font-size:14px;padding:9px 16px;border-radius:9px}
.faq dl{margin:0 0 12px}.faq dt{font-weight:700;color:#1e3a8a;margin-bottom:4px}.faq dd{margin:0;color:#374151}
.rel ul{list-style:none;padding:0;margin:0}.rel li{padding:9px 0;border-bottom:1px solid #f1f5f9}.rel a{color:#1a3de8;text-decoration:none;font-weight:600}
.note{font-size:12px;color:#9ca3af;margin-top:8px}
@media(max-width:640px){header.c-head,.card{border-radius:0}.wrap{padding:0}.crumb{padding:12px 16px}}
</style>
</head>
<body>
<nav class="crumb" aria-label="breadcrumb"><a href="/">홈</a> &raquo; <a href="/ga">GA 전산</a> &raquo; <span>${esc(ga.name)}</span></nav>
<div class="wrap">
<header class="c-head">
  <span class="badge">GA · 법인보험대리점</span>
  <h1>${esc(ga.name)} 전산 바로가기 (로그인)</h1>
  <p>${esc(ga.name)} 소속 설계사를 위한 전산(ERP) 접속과 로그인 안내입니다. 여러 보험사 상품을 취급하는 법인대리점 업무 전산입니다.</p>
  <a class="cta-erp" href="${esc(ga.erp)}" target="_blank" rel="noopener nofollow">🖥 ${esc(ga.name)} 전산 바로가기 →</a>
</header>

<section class="card">
  <h2>전산 로그인 안내</h2>
  <ol class="steps">
    <li>위 <strong>전산 바로가기</strong> 버튼으로 ${esc(ga.name)} 공식 전산에 접속합니다.</li>
    <li>소속 시 발급받은 <strong>아이디·비밀번호</strong>로 로그인합니다.</li>
    <li>최초 접속 시 <strong>보안 프로그램</strong> 설치가 필요할 수 있습니다. 안내에 따라 설치 후 재접속하세요.</li>
  </ol>
  <p class="note">※ 아이디·비밀번호 발급/초기화는 보안상 소속 ${esc(ga.name)} 지점·본사를 통해서만 가능합니다.</p>
  <div class="btn-row" style="margin-top:8px;">
    <a href="${esc(ga.erp)}" target="_blank" rel="noopener nofollow">전산 접속</a>
    <a href="${esc(homepage)}" target="_blank" rel="noopener nofollow">공식 홈페이지</a>
  </div>
</section>

<section class="card faq">
  <h2>${esc(ga.name)} 전산 자주 묻는 질문</h2>
  ${faqHtml}
</section>

<section class="card rel">
  <h2>설계사라면 함께 보면 좋은 정보</h2>
  <ul>${related.map(([href, t]) => `<li><a href="${href}">${esc(t)}</a></li>`).join('')}</ul>
</section>
</div>
${seoShareBar(url, ga.name + ' 전산 바로가기', desc, `${SITE}/logo-full.png`)}
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
};
