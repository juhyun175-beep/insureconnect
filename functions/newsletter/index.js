/**
 * v2.8.13: 소식·자료 아카이브 (SSR) — GET /newsletter
 *   타깃 검색: "보험 카드뉴스", "보험사 소식지 모음", "보험 영업자료"
 *   InsureConnect 카드뉴스(/og/news/{set_id}, indexable) + 보험사 소식지(PDF) 집계
 *   구독(=가입) CTA → 신규 자료 업로드 시 카카오 자동 알림(재방문 고착)
 */
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';

const SITE = 'https://insureconnect.co.kr';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const fmt = (iso) => (iso ? String(iso).slice(0, 10) : '');

export const onRequestGet = async ({ env }) => {
  const url = `${SITE}/newsletter`;

  // 1) 카드뉴스 (set 단위로 그룹) — 대표 카드(sort_order 최소)의 제목 사용
  let cardSets = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT set_id, title, sort_order, created_at FROM ic_card_news ORDER BY created_at DESC, sort_order ASC LIMIT 400`
    ).all();
    const seen = new Map();
    for (const r of (rs.results || [])) {
      if (!seen.has(r.set_id)) seen.set(r.set_id, { set_id: r.set_id, title: r.title, created_at: r.created_at, cards: 1 });
      else seen.get(r.set_id).cards++;
    }
    cardSets = [...seen.values()].slice(0, 60);
  } catch (_) {}

  // 2) 보험사 소식지 (PDF 등)
  let newsletters = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, company, title, file_url, file_type, created_at FROM ic_newsletters ORDER BY created_at DESC LIMIT 80`
    ).all();
    newsletters = (rs.results || []).filter(n => n.file_url);
  } catch (_) {}

  const cardCards = cardSets.map(c => `
    <a class="nl-card" href="/og/news/${esc(c.set_id)}">
      <span class="nl-tag nl-tag-cn">카드뉴스</span>
      <div class="nl-title">${esc(c.title || 'InsureConnect 카드뉴스')}</div>
      <div class="nl-meta">${esc(fmt(c.created_at))}${c.cards > 1 ? ` · ${c.cards}컷` : ''}</div>
    </a>`).join('');

  const nlCards = newsletters.map(n => `
    <a class="nl-card" href="${esc(n.file_url)}" target="_blank" rel="noopener nofollow">
      <span class="nl-tag nl-tag-co">${esc(n.company || '소식지')}</span>
      <div class="nl-title">${esc(n.title || '소식지')}</div>
      <div class="nl-meta">${esc(fmt(n.created_at))} · ${esc(String(n.file_type || 'PDF').toUpperCase())}</div>
    </a>`).join('');

  const totalCount = cardSets.length + newsletters.length;
  const title = '보험 카드뉴스·소식지 아카이브 | InsureConnect';
  const desc = `InsureConnect 카드뉴스와 보험사 소식지·영업자료 ${totalCount}건을 한 곳에서. 새 자료가 올라오면 카카오로 알림을 받아보세요.`;

  const collectionLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '보험 카드뉴스·소식지 아카이브', url,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: cardSets.slice(0, 40).map((c, idx) => ({
        '@type': 'ListItem', position: idx + 1, url: `${SITE}/og/news/${c.set_id}`, name: c.title || 'InsureConnect 카드뉴스',
      })),
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '소식·자료', item: url },
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
${ld(collectionLd)}
${ld(breadcrumbLd)}
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:1000px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
header.h{max-width:1000px;margin:0 auto 16px;padding:30px 28px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:27px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.94;font-size:14px}
.sub-cta{max-width:1000px;margin:0 auto 18px;padding:0 16px}
.sub-box{background:#fff;border:1px solid #e0f2fe;border-radius:14px;padding:18px 22px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.sub-box .t{flex:1;min-width:200px}.sub-box .t b{font-size:15px;color:#0f172a}.sub-box .t p{margin:3px 0 0;font-size:13px;color:#64748b}
.sub-box a{background:#FEE500;color:#191600;text-decoration:none;font-weight:800;font-size:14px;padding:11px 18px;border-radius:10px}
.sec{max-width:1000px;margin:0 auto;padding:0 16px}.sec h2{font-size:18px;color:#0f172a;margin:20px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.nl-card{display:flex;flex-direction:column;gap:6px;background:#fff;border-radius:12px;padding:16px 16px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.05);transition:transform .15s,box-shadow .15s}
.nl-card:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(37,99,235,0.13)}
.nl-tag{align-self:flex-start;font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px}
.nl-tag-cn{color:#1d4ed8;background:#dbeafe}.nl-tag-co{color:#0369a1;background:#e0f2fe}
.nl-title{font-size:14.5px;font-weight:800;color:#0f172a;line-height:1.35}
.nl-meta{font-size:11.5px;color:#94a3b8}
.empty-box{background:#fff;border-radius:12px;padding:30px;text-align:center;color:#94a3b8;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
@media(max-width:640px){header.h{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>소식·자료</span></nav>
<header class="h">
  <h1>보험 카드뉴스 · 소식지 아카이브</h1>
  <p>InsureConnect 카드뉴스와 보험사 소식지·영업자료를 한 곳에서. 현재 ${totalCount}건.</p>
</header>
<div class="sub-cta"><div class="sub-box">
  <div class="t"><b>📬 새 자료 알림 받기</b><p>카카오로 1초 구독하면 새 카드뉴스·소식지가 올라올 때 알림을 보내드려요.</p></div>
  <a href="/api/auth/kakao/login">💬 카카오로 구독하기</a>
</div></div>
${cardSets.length ? `<div class="sec"><h2>🗞 InsureConnect 카드뉴스</h2><div class="grid">${cardCards}</div></div>` : ''}
${newsletters.length ? `<div class="sec"><h2>📄 보험사 소식지 · 영업자료</h2><div class="grid">${nlCards}</div></div>` : ''}
${totalCount === 0 ? `<div class="sec"><div class="empty-box">아직 등록된 자료가 없습니다. 곧 업데이트됩니다.</div></div>` : ''}
<div class="sec" style="margin-top:16px">
  ${seoShareBar(url, '보험 카드뉴스·소식지 아카이브', 'InsureConnect 카드뉴스와 보험사 소식지를 한 곳에서', `${SITE}/logo-full.png`)}
</div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=1800' },
  });
};
