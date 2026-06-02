/**
 * v2.8.10: 리스/렌터카 SSR 랜딩 (검색 유입 → 견적 리드 전환)
 *   GET /rental
 *   타깃 검색: "보험설계사 렌트카 할인", "설계사 리스 우대", "법인 장기렌트 견적"
 *   인라인 견적 문의 → POST /api/rental-inquiries (공개)
 */
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

export const onRequestGet = async ({ env }) => {
  const url = `${SITE}/rental`;

  let vehicles = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, name, image_url FROM ic_rental_vehicles WHERE is_active = 1 ORDER BY id DESC LIMIT 12`
    ).all();
    vehicles = rs.results || [];
  } catch (_) {}

  const vehicleCards = vehicles.map(v => `
    <div class="rv-card">
      ${v.image_url ? `<div class="rv-thumb"><img src="${esc(v.image_url)}" alt="${esc(v.name)}" loading="lazy"></div>` : ''}
      <div class="rv-body">
        <div class="rv-name">${esc(v.name)}</div>
        <button type="button" class="rv-cta" onclick="pickVehicle('${esc(v.name).replace(/'/g, '')}')">이 차량 견적받기 →</button>
      </div>
    </div>`).join('');

  const vehicleOptions = ['관심 차량 선택(선택)', ...vehicles.map(v => v.name)]
    .map((n, i) => `<option value="${i === 0 ? '' : esc(n)}">${esc(n)}</option>`).join('');

  const title = '보험설계사 전용 리스·렌터카 우대 견적 | InsureConnect';
  const desc = '보험설계사·법인 대상 리스/장기렌터카 우대 조건. 전 차종 무료 견적, 전문매니저 1:1 상담. 보증·선납·보험연령까지 맞춤 견적을 받아보세요.';

  const serviceLd = {
    '@context': 'https://schema.org', '@type': 'Service',
    name: '보험설계사 전용 리스·렌터카 우대 견적', serviceType: '자동차 리스/장기렌트 견적',
    areaServed: 'KR', provider: { '@type': 'Organization', name: 'InsureConnect', url: SITE },
    url, description: desc,
  };
  const faq = [
    { q: '보험설계사도 리스/렌터카 우대를 받을 수 있나요?', a: '네. 보험설계사·법인 대상 우대 조건으로 견적을 안내합니다. 무료 견적 신청 후 전문매니저가 1:1로 상담합니다.' },
    { q: '견적을 받으면 바로 계약해야 하나요?', a: '아니요. 견적은 무료이며 비교용입니다. 조건이 맞을 때만 진행하시면 됩니다.' },
    { q: '어떤 차종까지 가능한가요?', a: '국산·수입 전 차종 리스/장기렌트가 가능합니다. 관심 차량을 남겨주시면 맞춤 견적을 드립니다.' },
  ];
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '리스·렌터카 우대 견적', item: url },
    ] };
  const faqHtml = faq.map(f => `<dl><dt>Q. ${esc(f.q)}</dt><dd>${esc(f.a)}</dd></dl>`).join('');

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
<meta property="og:image" content="${SITE}/rental-page-banner.jpg">
<meta name="twitter:card" content="summary_large_image">
${ld(serviceLd)}
${ld(faqLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;line-height:1.7;margin:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:880px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:880px;margin:0 auto;padding:0 16px}
.hero{position:relative;border-radius:18px;overflow:hidden;margin-bottom:18px;min-height:220px;display:flex;align-items:flex-end;color:#fff;
  background:linear-gradient(100deg,rgba(8,13,38,0.92),rgba(8,13,38,0.45)),url('${SITE}/rental-page-banner.jpg') center/cover}
.hero-in{padding:26px 26px 24px}
.hero .badge{display:inline-block;background:linear-gradient(135deg,#e11d48,#f97316);font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;margin-bottom:10px}
.hero h1{margin:0 0 8px;font-size:27px;letter-spacing:-0.02em;text-shadow:0 2px 12px rgba(0,0,0,0.5)}
.hero p{margin:0 0 14px;font-size:14.5px;opacity:.95;text-shadow:0 1px 8px rgba(0,0,0,0.5)}
.hero a.cta{display:inline-block;background:#fff;color:#0b1220;text-decoration:none;font-weight:800;font-size:15px;padding:12px 22px;border-radius:11px}
.trust{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.trust span{flex:1;min-width:160px;background:#fff;border-radius:12px;padding:14px 16px;font-size:13.5px;font-weight:700;color:#0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.trust b{color:#e11d48}
h2{font-size:19px;color:#0f172a;margin:24px 0 12px}
.rv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.rv-card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
.rv-thumb{aspect-ratio:16/10;background:#eef2f7;overflow:hidden}.rv-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.rv-body{padding:12px 14px}.rv-name{font-size:14px;font-weight:800;color:#0f172a;margin-bottom:8px;letter-spacing:-0.01em}
.rv-cta{width:100%;background:#eff6ff;color:#1a3de8;border:none;border-radius:9px;font-weight:700;font-size:13px;padding:9px;cursor:pointer}
.lead{background:#fff;border-radius:16px;padding:24px 24px;box-shadow:0 4px 18px rgba(12,31,184,0.08);margin:22px 0}
.lead h2{margin-top:0}
.lead .row{display:flex;gap:10px;flex-wrap:wrap}
.lead label{display:block;font-size:12.5px;font-weight:700;color:#475569;margin:10px 0 5px}
.lead input,.lead select,.lead textarea{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:11px 13px;font-size:15px;font-family:inherit;color:#0f172a}
.lead .col{flex:1;min-width:150px}
.lead .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.lead button.submit{width:100%;margin-top:16px;background:linear-gradient(135deg,#e11d48,#f97316);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:16px;padding:14px;cursor:pointer}
.lead .note{font-size:11.5px;color:#94a3b8;margin-top:10px;text-align:center}
.lead .done{display:none;text-align:center;padding:24px 10px}.lead .done .ic{font-size:44px}
.faq{background:#fff7ed;border-left:4px solid #f97316;border-radius:14px;padding:22px 24px;margin:22px 0}
.faq h2{margin-top:0;color:#9a3412}.faq dt{font-weight:700;color:#9a3412;margin-bottom:4px}.faq dd{margin:0 0 12px;color:#374151}
@media(max-width:640px){.hero{border-radius:0}.wrap{padding:0 12px}.hero h1{font-size:22px}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>리스·렌터카 우대 견적</span></nav>
<div class="wrap">
<img src="${SITE}/rental-promo.jpg?v=3" alt="삼따방 회원 전용 리스·렌트 우대 혜택 안내" style="width:100%;height:auto;display:block;border-radius:16px;margin-bottom:14px;box-shadow:0 8px 28px rgba(8,13,38,0.18);">
<a class="cta" href="#lead" style="display:block;text-align:center;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px;border-radius:12px;margin-bottom:18px;">무료 견적 받기 ↓</a>

<div class="trust">
  <span>🏷 <b>설계사 전용</b> 우대 조건</span>
  <span>👤 전문매니저 <b>1:1</b> 상담</span>
  <span>🚗 국산·수입 <b>전 차종</b></span>
</div>

${vehicles.length ? `<h2>🚗 추천 차량 라인업</h2><div class="rv-grid">${vehicleCards}</div>` : ''}

<section class="lead" id="lead">
  <div id="lead-form-box">
    <h2>📩 무료 견적 받기</h2>
    <p style="margin:0 0 4px;color:#64748b;font-size:13.5px">연락처를 남기시면 전문매니저가 맞춤 견적으로 연락드립니다. (무료·비교용)</p>
    <form id="rental-lead" autocomplete="on">
      <div class="row">
        <div class="col"><label>이름 *</label><input type="text" id="ld-name" maxlength="30" placeholder="홍길동" required></div>
        <div class="col"><label>휴대폰 *</label><input type="tel" id="ld-phone" maxlength="20" placeholder="010-0000-0000" required></div>
      </div>
      <label>관심 차량</label>
      <select id="ld-vehicle">${vehicleOptions}</select>
      <label>요청사항 (선택)</label>
      <textarea id="ld-memo" maxlength="500" rows="2" placeholder="예: 장기렌트 48개월 / 보증 30% 희망"></textarea>
      <input class="hp" type="text" id="ld-website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button type="submit" class="submit" id="ld-submit">무료 견적 신청하기</button>
      <p class="note" id="ld-err" style="color:#dc2626;display:none"></p>
      <p class="note">제출 시 견적 상담을 위해 연락처가 전문매니저에게 전달됩니다.</p>
    </form>
  </div>
  <div class="done" id="lead-done">
    <div class="ic">✅</div>
    <h2 style="color:#16a34a">견적 신청이 접수되었습니다</h2>
    <p style="color:#475569">입력하신 번호로 전문매니저가 곧 연락드립니다. 감사합니다.</p>
    <a href="/" style="display:inline-block;margin-top:8px;color:#1a3de8;font-weight:700;text-decoration:none">InsureConnect 둘러보기 →</a>
  </div>
</section>

${seoShareBar(url, '보험설계사 전용 리스·렌터카 우대 견적', desc, `${SITE}/rental-page-banner.jpg`)}
<div class="faq"><h2>자주 묻는 질문</h2>${faqHtml}</div>
</div>
${seoCtaFooter(SITE)}
<script>
(function(){
  function pickVehicle(name){ var s=document.getElementById('ld-vehicle'); if(s){ for(var i=0;i<s.options.length;i++){ if(s.options[i].value===name){ s.selectedIndex=i; break; } } } var l=document.getElementById('lead'); if(l) l.scrollIntoView({behavior:'smooth'}); }
  window.pickVehicle=pickVehicle;
  var f=document.getElementById('rental-lead'); if(!f) return;
  f.addEventListener('submit',async function(ev){
    ev.preventDefault();
    var err=document.getElementById('ld-err'); err.style.display='none';
    var name=(document.getElementById('ld-name').value||'').trim();
    var phone=(document.getElementById('ld-phone').value||'').trim();
    if(name.length<2){ err.textContent='이름을 입력해주세요.'; err.style.display='block'; return; }
    if(phone.replace(/[^0-9]/g,'').length<8){ err.textContent='연락 가능한 휴대폰을 입력해주세요.'; err.style.display='block'; return; }
    var btn=document.getElementById('ld-submit'); btn.disabled=true; btn.textContent='접수 중…';
    try{
      var res=await fetch('/api/rental-inquiries',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ customer_name:name, customer_phone:phone,
          vehicle_name:(document.getElementById('ld-vehicle').value||''),
          memo:(document.getElementById('ld-memo').value||''),
          website:(document.getElementById('ld-website').value||'') })});
      var d=await res.json();
      if(!res.ok){ throw new Error(d.error||'접수 실패'); }
      document.getElementById('lead-form-box').style.display='none';
      document.getElementById('lead-done').style.display='block';
    }catch(e){ err.textContent='❌ '+(e.message||'접수 실패 — 잠시 후 다시 시도해주세요.'); err.style.display='block'; btn.disabled=false; btn.textContent='무료 견적 신청하기'; }
  });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=1800' },
  });
};
