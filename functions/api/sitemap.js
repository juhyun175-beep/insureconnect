import { SEO_CATEGORIES } from '../_lib/seo-categories.js';
import { INSURERS } from '../_lib/insurers.js';

const SB_URL  = 'https://rzllpymhtygnooduevgf.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bGxweW1odHlnbm9vZHVldmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjg1NjYsImV4cCI6MjA4NzkwNDU2Nn0.Z2K720NiFo191fVBllr0_OiTxvJYjwTSv3ZSiNgc2bs';
const SB_HDR  = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };
const BASE    = 'https://insureconnect-hub.pages.dev';

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
}
const xmlEsc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function urlTag(loc, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${xmlEsc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const debug = url.searchParams.has('debug');

  let posts = [];
  let sbStatus = null;
  let sbBody = null;

  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_knowledge_posts?select=id,created_at&order=created_at.desc&limit=1000`,
      { headers: SB_HDR }
    );
    sbStatus = res.status;
    sbBody = await res.text();
    if (res.ok) posts = JSON.parse(sbBody);
  } catch (e) {
    sbBody = String(e);
  }

  // SEO 게시판(ic_seo_posts, D1) — published 글의 /insurance/{category}/{slug}
  let seoPosts = [];
  try {
    if (env && env.DB) {
      const rs = await env.DB.prepare(
        `SELECT category, slug, updated_at FROM ic_seo_posts
         WHERE status = 'published' ORDER BY updated_at DESC LIMIT 5000`
      ).all();
      seoPosts = rs.results || [];
    }
  } catch (e) { /* D1 미연결 시 무시 */ }

  if (debug) {
    return new Response(JSON.stringify({ sbStatus, posts, seoCount: seoPosts.length, sbBody }, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const staticUrls = [
    urlTag(`${BASE}/`, today, 'daily', '1.0'),
    urlTag(`${BASE}/insurance`, today, 'daily', '0.9'),
    urlTag(`${BASE}/company`, today, 'weekly', '0.9'),
    urlTag(`${BASE}/guide.html`, today, 'monthly', '0.8'),
    urlTag(`${BASE}/about.html`, today, 'monthly', '0.7'),
    urlTag(`${BASE}/privacy.html`, today, 'yearly', '0.3'),
  ];

  // 보험사별 전산/청구 랜딩 + 집계(허브) 페이지
  const companyUrls = [
    urlTag(`${BASE}/company/customer-center`, today, 'weekly', '0.85'),
    urlTag(`${BASE}/company/claim-fax`, today, 'weekly', '0.85'),
    ...INSURERS.map(i => urlTag(`${BASE}/company/${i.slug}`, today, 'weekly', '0.8')),
  ];

  // SEO 카테고리 목록 페이지
  const categoryUrls = SEO_CATEGORIES.map(c =>
    urlTag(`${BASE}/insurance/${c.slug}`, today, 'weekly', '0.7')
  );

  const knowledgeUrls = posts.map(p =>
    urlTag(`${BASE}/knowledge/${p.id}`, fmtDate(p.created_at), 'monthly', '0.8')
  );

  // SEO 게시글 — 가장 가치 높은 인덱싱 대상
  const seoUrls = seoPosts.map(p =>
    urlTag(`${BASE}/insurance/${p.category}/${p.slug}`, fmtDate(p.updated_at), 'monthly', '0.9')
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...companyUrls, ...categoryUrls, ...seoUrls, ...knowledgeUrls].join('\n')}\n</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=600',
    },
  });
}
