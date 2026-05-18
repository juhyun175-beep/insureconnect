const SB_URL  = 'https://rzllpymhtygnooduevgf.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bGxweW1odHlnbm9vZHVldmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjg1NjYsImV4cCI6MjA4NzkwNDU2Nn0.Z2K720NiFo191fVBllr0_OiTxvJYjwTSv3ZSiNgc2bs';
const SB_HDR  = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };
const BASE    = 'https://insureconnect-hub.pages.dev';

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
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

  if (debug) {
    return new Response(JSON.stringify({ sbStatus, posts, sbBody }, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const staticUrls = [
    `  <url>\n    <loc>${BASE}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${BASE}/guide.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    `  <url>\n    <loc>${BASE}/about.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    `  <url>\n    <loc>${BASE}/privacy.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>`,
  ];

  const postUrls = posts.map(p =>
    `  <url>\n    <loc>${BASE}/knowledge/${p.id}</loc>\n    <lastmod>${fmtDate(p.created_at)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...postUrls].join('\n')}\n</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=600',
    },
  });
}
