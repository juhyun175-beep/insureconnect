const SB_URL  = 'https://rzllpymhtygnooduevgf.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bGxweW1odHlnbm9vZHVldmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjg1NjYsImV4cCI6MjA4NzkwNDU2Nn0.Z2K720NiFo191fVBllr0_OiTxvJYjwTSv3ZSiNgc2bs';
const SB_HDR  = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };
const BASE    = 'https://insureconnect-hub.pages.dev';

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export async function onRequestGet() {
  let posts = [];
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_knowledge_posts?select=id,created_at,updated_at&order=created_at.desc&limit=1000`,
      { headers: SB_HDR }
    );
    if (res.ok) posts = await res.json();
  } catch (_) {}

  const today = new Date().toISOString().slice(0, 10);

  const staticUrls = [
    `  <url>
    <loc>${BASE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    `  <url>
    <loc>${BASE}/privacy.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>`,
  ];

  const postUrls = posts.map(p => `  <url>
    <loc>${BASE}/knowledge/${p.id}</loc>
    <lastmod>${fmtDate(p.updated_at || p.created_at)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...postUrls].join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
