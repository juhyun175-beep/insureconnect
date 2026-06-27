/**
 * 동적 RSS 2.0 피드 — /rss.xml
 *   네이버 서치어드바이저 RSS 제출용(신규/최신 콘텐츠 빠른 색인 유도).
 *   최신 콘텐츠를 타입 혼합으로 모아 발행일 내림차순 정렬 → 상위 50건.
 *     - 보험정보 SEO 글(/insurance/{category}/{slug})
 *     - 인기·충실 자유게시판 글(/og/board/{id}) — 색인 게이트 통과분만
 *     - 채용공고(/og/recruit/{id}) · 강의(/og/lecture/{id})
 */
import { BOARD_SEO_WHERE } from './_lib/board-seo.js';

const BASE = 'https://insureconnect.co.kr';
const MAX_ITEMS = 50;

const xesc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** D1 datetime('now')은 UTC 'YYYY-MM-DD HH:MM:SS' → RFC-822 */
function rfc822(iso) {
  if (!iso) return new Date().toUTCString();
  const d = new Date(String(iso).replace(' ', 'T') + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(iso)) ? '' : 'Z'));
  return isNaN(d) ? new Date().toUTCString() : d.toUTCString();
}
const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export async function onRequestGet({ env }) {
  const items = [];

  // 1) 보험정보 SEO 글
  try {
    const rs = await env.DB.prepare(
      `SELECT category, slug, title, excerpt, created_at, updated_at
       FROM ic_seo_posts WHERE status='published'
       ORDER BY created_at DESC LIMIT ${MAX_ITEMS}`
    ).all();
    for (const p of (rs.results || [])) {
      items.push({
        title: p.title,
        link: `${BASE}/insurance/${p.category}/${p.slug}`,
        desc: clean(p.excerpt).slice(0, 280),
        date: p.updated_at || p.created_at,
      });
    }
  } catch (_) {}

  // 2) 인기·충실 자유게시판 글 (색인 게이트 통과)
  try {
    const rs = await env.DB.prepare(
      `SELECT id, title, content, created_at FROM ic_board_posts
       WHERE deleted = 0 AND ${BOARD_SEO_WHERE}
       ORDER BY created_at DESC LIMIT 30`
    ).all();
    for (const p of (rs.results || [])) {
      items.push({
        title: p.title,
        link: `${BASE}/og/board/${p.id}`,
        desc: clean(p.content).slice(0, 280),
        date: p.created_at,
      });
    }
  } catch (_) {}

  // 3) 채용공고
  try {
    const rs = await env.DB.prepare(
      `SELECT id, title, company_name, description, created_at, updated_at
       FROM ic_recruitments WHERE status='approved' ORDER BY created_at DESC LIMIT 20`
    ).all();
    for (const r of (rs.results || [])) {
      items.push({
        title: r.company_name ? `[채용] ${r.title} · ${r.company_name}` : `[채용] ${r.title}`,
        link: `${BASE}/og/recruit/${r.id}`,
        desc: clean(r.description).slice(0, 280),
        date: r.updated_at || r.created_at,
      });
    }
  } catch (_) {}

  // 4) 강의
  try {
    const rs = await env.DB.prepare(
      `SELECT id, title, instructor, description, created_at, updated_at
       FROM ic_lectures WHERE status='approved' ORDER BY created_at DESC LIMIT 20`
    ).all();
    for (const r of (rs.results || [])) {
      items.push({
        title: r.instructor ? `[강의] ${r.title} · ${r.instructor}` : `[강의] ${r.title}`,
        link: `${BASE}/og/lecture/${r.id}`,
        desc: clean(r.description).slice(0, 280),
        date: r.updated_at || r.created_at,
      });
    }
  } catch (_) {}

  // 발행일 내림차순 → 상위 MAX_ITEMS
  items.sort((a, b) => new Date(String(b.date).replace(' ', 'T') + 'Z') - new Date(String(a.date).replace(' ', 'T') + 'Z'));
  const top = items.slice(0, MAX_ITEMS);

  const lastBuild = top.length ? rfc822(top[0].date) : new Date().toUTCString();
  const itemsXml = top.map((it) => `    <item>
      <title>${xesc(it.title)}</title>
      <link>${xesc(it.link)}</link>
      <guid isPermaLink="true">${xesc(it.link)}</guid>
      <description>${xesc(it.desc)}</description>
      <pubDate>${rfc822(it.date)}</pubDate>
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>InsureConnect — 보험설계사 통합 허브</title>
    <link>${BASE}/</link>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>보험사 전산·청구, 보험정보, 채용·강의, 설계사 커뮤니티 최신 업데이트</description>
    <language>ko</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>60</ttl>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=1800',
    },
  });
}
