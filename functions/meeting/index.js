/**
 * v2.57.0: 보험설계사 오프라인 모임·세미나·스터디 허브 (SSR) — GET /meeting
 *   타깃 검색: "보험설계사 모임", "보험영업 스터디", "보험 세미나 오프라인", "보험설계사 네트워킹"
 *   승인된 모임공고를 집계 → 개별 Event 페이지(/og/meeting/{id})로 내부링크
 *   유입 양면: 참석 설계사(→회원) + 모임 주최자(→모임 등록)
 */
import { seoCtaFooter, seoShareBar } from '../_lib/seo-cta.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const daysAgo = (iso) => {
  if (!iso) return 999;
  const t = Date.parse(String(iso).replace(' ', 'T'));
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : 999;
};

export const onRequestGet = async ({ env }) => {
  const url = `${SITE}/meeting`;

  let items = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, title, host, created_at
       FROM ic_meetings WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`
    ).all();
    items = rs.results || [];
  } catch (_) {}

  // v2.70.0: 모임은 참여 게이트 — 목록엔 제목·주최만(상세는 SPA에서 로그인+참여 후)
  const cards = items.map(it => {
    const isNew = daysAgo(it.created_at) <= 7;
    return `
    <a class="lec" href="/?meeting=${esc(it.id)}">
      <div class="lec-top">
        ${it.host ? `<span class="lec-by">주최 ${esc(it.host)}</span>` : '<span class="lec-by lec-by-na">모임</span>'}
        ${isNew ? '<span class="lec-new">NEW</span>' : ''}
      </div>
      <div class="lec-title">${esc(it.title)}</div>
      <div class="lec-meta">🔒 로그인·참여 시 장소·일시·신청 방법 공개</div>
      <span class="lec-cta">참여하고 상세 보기 →</span>
    </a>`;
  }).join('');

  const title = '보험설계사 모임·세미나·스터디 일정 모음 | InsureConnect';
  const desc = `보험설계사 오프라인 모임·영업 스터디·세미나·네트워킹 ${items.length}건을 한 곳에서. 장소·일정·신청 정보를 확인하고 바로 참여하세요. 주최자는 무료로 모임을 등록할 수 있습니다.`;

  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '보험설계사 모임·세미나 모음', url,
    isPartOf: { '@type': 'WebSite', name: 'InsureConnect', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.slice(0, 50).map((it, idx) => ({
        '@type': 'ListItem', position: idx + 1, url: `${SITE}/og/meeting/${it.id}`, name: it.title,
      })),
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '모임·세미나', item: url },
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
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:1000px;margin:0 auto}.crumb a{color:#0d9488;text-decoration:none}
header.h{max-width:1000px;margin:0 auto 18px;padding:30px 28px;background:linear-gradient(135deg,#0d9488,#0ea5e9);color:#fff;border-radius:16px}
header.h h1{margin:0 0 8px;font-size:27px;letter-spacing:-0.02em}header.h p{margin:0;opacity:.94;font-size:14px}
.h-cta{display:inline-block;margin-top:14px;background:#fff;color:#0d9488;text-decoration:none;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px}
.sec{max-width:1000px;margin:0 auto;padding:0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.lec{display:flex;flex-direction:column;gap:7px;background:#fff;border-radius:13px;padding:18px 18px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.05);border-top:3px solid #0d9488;transition:transform .15s,box-shadow .15s}
.lec:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(13,148,136,0.15)}
.lec-top{display:flex;align-items:center;gap:7px}
.lec-by{font-size:11.5px;font-weight:800;color:#0f766e;background:#ccfbf1;padding:2px 9px;border-radius:999px}
.lec-by-na{color:#64748b;background:#f1f5f9}
.lec-new{font-size:10px;font-weight:900;color:#fff;background:#ef4444;padding:2px 7px;border-radius:5px;letter-spacing:.03em}
.lec-title{font-size:16px;font-weight:800;color:#0f172a;line-height:1.35;letter-spacing:-0.01em}
.lec-meta{font-size:12px;color:#0f766e;font-weight:600}
.lec-desc{font-size:13px;color:#64748b;line-height:1.5}
.lec-cta{margin-top:auto;font-size:13px;font-weight:700;color:#0d9488}
.empty{max-width:1000px;margin:0 auto;padding:0 16px}
.empty-box{background:#fff;border-radius:14px;padding:40px 24px;text-align:center;color:#64748b;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
@media(max-width:640px){header.h{border-radius:0}}
</style>
</head>
<body>
<nav class="crumb"><a href="/">홈</a> &raquo; <span>모임·세미나</span></nav>
<header class="h">
  <h1>보험설계사 모임 · 세미나 · 스터디</h1>
  <p>오프라인 모임 · 영업 스터디 · 세미나 · 네트워킹 일정을 한 곳에서. 현재 ${items.length}건의 모임이 등록되어 있습니다.</p>
  <a class="h-cta" href="/api/auth/kakao/login">＋ 모임 주최자세요? 무료로 모임 등록 →</a>
</header>
${items.length
  ? `<div class="sec"><div class="grid">${cards}</div></div>`
  : `<div class="empty"><div class="empty-box">현재 등록된 모임이 없습니다. 잠시 후 다시 확인해주세요.<br><br><a href="/api/auth/kakao/login" style="color:#0d9488;font-weight:700;text-decoration:none">모임 무료 등록하기 →</a></div></div>`}
<div class="sec" style="margin-top:16px">
  ${seoShareBar(url, '보험설계사 모임·세미나 모음', '오프라인 모임·스터디·세미나 일정을 한 곳에서', `${SITE}/logo-full.png`)}
</div>
${seoCtaFooter(SITE)}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=1800' },
  });
};
