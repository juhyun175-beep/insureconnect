/**
 * 동적 sitemap.xml
 * v2.1.39: 채용공고/강의공고/카드뉴스 + 기존 보험지식 + 정적 URL 통합
 *           Google Jobs / 네이버 검색 노출용 인덱싱 시드
 */
const BASE = 'https://insureconnect-hub.pages.dev';
const SB_URL  = 'https://rzllpymhtygnooduevgf.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bGxweW1odHlnbm9vZHVldmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjg1NjYsImV4cCI6MjA4NzkwNDU2Nn0.Z2K720NiFo191fVBllr0_OiTxvJYjwTSv3ZSiNgc2bs';
const SB_HDR  = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };

function fmtDate(iso) {
  return iso ? String(iso).slice(0, 10) : new Date().toISOString().slice(0, 10);
}
function urlEntry(loc, lastmod, changefreq = 'weekly', priority = 0.6) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function onRequestGet({ env }) {
  const today = new Date().toISOString().slice(0, 10);

  // 정적 페이지
  const staticUrls = [
    urlEntry(`${BASE}/`, today, 'daily', 1.0),
    urlEntry(`${BASE}/privacy.html`, today, 'yearly', 0.3),
    urlEntry(`${BASE}/insurance`, today, 'daily', 0.9),
    urlEntry(`${BASE}/company`, today, 'weekly', 0.8),
    urlEntry(`${BASE}/rental`, today, 'weekly', 0.8),
    urlEntry(`${BASE}/recruit`, today, 'daily', 0.85),
    urlEntry(`${BASE}/lecture`, today, 'daily', 0.85),
  ];

  // v2.0.0 (master): SEO 게시판 카테고리 + 게시글
  const SEO_SLUGS = ['claim','actual-loss','whole-life','cancer','car','practice','recruit-tips','notice','surgery-code','disease-code','terms','underwrite'];
  const seoCategoryUrls = SEO_SLUGS.map(s => urlEntry(`${BASE}/insurance/${s}`, today, 'daily', 0.8));
  let seoPosts = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT category, slug, created_at, updated_at FROM ic_seo_posts WHERE status='published' ORDER BY created_at DESC LIMIT 5000`
    ).all();
    seoPosts = rs.results || [];
  } catch (_) {}
  const seoPostUrls = seoPosts.map(p =>
    urlEntry(`${BASE}/insurance/${p.category}/${p.slug}`, fmtDate(p.updated_at || p.created_at), 'weekly', 0.85)
  );

  // 보험지식 (Supabase REST 경유 — 기존 호환)
  let posts = [];
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_knowledge_posts?select=id,created_at,updated_at&order=created_at.desc&limit=1000`,
      { headers: SB_HDR }
    );
    if (res.ok) posts = await res.json();
  } catch (_) {}
  const knowledgeUrls = posts.map(p =>
    urlEntry(`${BASE}/knowledge/${p.id}`, fmtDate(p.updated_at || p.created_at), 'monthly', 0.8)
  );

  // 채용공고 (D1 직접)
  let recruits = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, created_at, updated_at FROM ic_recruitments
       WHERE status = 'approved' ORDER BY created_at DESC LIMIT 1000`
    ).all();
    recruits = rs.results || [];
  } catch (_) {}
  const recruitUrls = recruits.map(r =>
    urlEntry(`${BASE}/og/recruit/${r.id}`, fmtDate(r.updated_at || r.created_at), 'weekly', 0.9)
  );

  // 강의공고
  let lectures = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, created_at, updated_at FROM ic_lectures
       WHERE status = 'approved' ORDER BY created_at DESC LIMIT 1000`
    ).all();
    lectures = rs.results || [];
  } catch (_) {}
  const lectureUrls = lectures.map(r =>
    urlEntry(`${BASE}/og/lecture/${r.id}`, fmtDate(r.updated_at || r.created_at), 'weekly', 0.9)
  );

  // 카드뉴스 (set_id 별 1엔트리)
  let news = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT set_id, MAX(created_at) AS created_at
       FROM ic_card_news GROUP BY set_id ORDER BY created_at DESC LIMIT 1000`
    ).all();
    news = rs.results || [];
  } catch (_) {}
  const newsUrls = news.map(n =>
    urlEntry(`${BASE}/og/news/${n.set_id}`, fmtDate(n.created_at), 'monthly', 0.7)
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
  ...staticUrls,
  ...seoCategoryUrls,
  ...seoPostUrls,
  ...recruitUrls,
  ...lectureUrls,
  ...knowledgeUrls,
  ...newsUrls,
].join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=1800, s-maxage=3600',
    },
  });
}
