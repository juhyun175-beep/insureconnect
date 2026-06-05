/**
 * v2.14.4: 홈 종합 뉴스 (네이버식·카드형) — GET /api/news?cat=all|economy|society|politics|it|world|health
 *   연합뉴스 분야별 RSS(전부 썸네일 제공) → 정리·썸네일 추출·중복제거·최신순 → D1 캐시(10분)+SWR(방문 시 백그라운드 갱신)
 *   카테고리=코드 고정(변조 차단). 헤드라인+썸네일+출처+원문 링크만(전문 복제 X). 키 불필요.
 */
import { json, corsPreflight, handle } from '../_lib/http.js';

const Y = (s) => `https://www.yna.co.kr/rss/${s}.xml`;

// 카테고리 → [ [url, 출처명], ... ]  (연합뉴스 분야별 + 보험 탭은 보험 전문지 실시간)
const CATS = {
  all:       [[Y('news'), '연합뉴스']],
  insurance: [['https://www.insjournal.co.kr/rss/allArticle.xml', '보험저널'], ['https://www.insnews.co.kr/rss/allArticle.xml', '보험신보']],
  economy:   [[Y('economy'), '연합뉴스'], [Y('market'), '연합뉴스']],
  industry:  [[Y('industry'), '연합뉴스']],
  society:   [[Y('society'), '연합뉴스']],
  politics:  [[Y('politics'), '연합뉴스']],
  culture:   [[Y('culture'), '연합뉴스']],
  sports:    [[Y('sports'), '연합뉴스']],
  world:     [[Y('international'), '연합뉴스']],
  health:    [[Y('health'), '연합뉴스']],
};

const TTL_MS = 5 * 60 * 1000; // 5분(더 실시간) + SWR
const MAX_OUT = 16, MAX_CACHE = 40;

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (_) { return ''; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch (_) { return ''; } })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

const pick = (b, t) => { const m = b.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? m[1] : ''; };

// 썸네일 추출 — media:content/thumbnail → enclosure → 본문 <img> (https만, 혼합콘텐츠 방지)
function pickImage(block) {
  let m = block.match(/<media:(?:content|thumbnail)[^>]*\burl=["']([^"']+)["']/i);
  if (!m) m = block.match(/<enclosure[^>]*\burl=["']([^"']+\.(?:jpe?g|png|gif|webp)[^"']*)["']/i);
  if (!m) m = block.match(/<img[^>]*\bsrc=["']([^"']+)["']/i);
  if (!m) return null;
  const u = decodeEntities(m[1]);
  return /^https:\/\//.test(u) ? u : null;
}

function parseFeed(xml, name) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const title = decodeEntities(pick(b, 'title'));
    const link = decodeEntities(pick(b, 'link')) || decodeEntities(pick(b, 'guid'));
    const pubDate = (pick(b, 'pubDate') || pick(b, 'dc:date') || '').trim();
    if (title && link && /^https?:/.test(link)) out.push({ title, link, source: name, pubDate, image: pickImage(b) });
  }
  return out;
}

async function fetchFeed(url, name) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InsureConnectBot/1.0; +https://insureconnect-hub.pages.dev)',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return [];
    return parseFeed(await r.text(), name);
  } catch (_) { return []; }
}

function buildList(lists) {
  const seen = new Set(); const out = [];
  for (const items of lists) for (const it of items) {
    const key = it.title.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key); out.push(it);
  }
  out.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  return out;
}

async function refreshCat(env, cat) {
  const feeds = CATS[cat] || CATS.all;
  const lists = await Promise.all(feeds.map(([url, name]) => fetchFeed(url, name)));
  const list = buildList(lists).slice(0, MAX_CACHE);
  if (list.length) {
    try {
      await env.DB.prepare(
        `INSERT INTO ic_news_cache (cat, payload, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(cat) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`
      ).bind(cat, JSON.stringify(list), new Date().toISOString()).run();
    } catch (_) {}
  }
  return list;
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async (context) => handle(async () => {
  const { env, request } = context;
  const url = new URL(request.url);
  const reqCat = url.searchParams.get('cat');
  const cat = Object.prototype.hasOwnProperty.call(CATS, reqCat) ? reqCat : 'all';
  const now = Date.now();

  // 캐시 로드(카테고리별)
  let list = null, fetchedAt = 0;
  try {
    const c = await env.DB.prepare(`SELECT payload, fetched_at FROM ic_news_cache WHERE cat = ?`).bind(cat).first();
    if (c) { list = JSON.parse(c.payload); fetchedAt = Date.parse(c.fetched_at) || 0; }
  } catch (_) {}

  const stale = !list || (now - fetchedAt) >= TTL_MS;
  if (!list) {
    list = await refreshCat(env, cat);                 // 캐시 없음 → 동기
  } else if (stale) {
    if (context.waitUntil) { try { context.waitUntil(refreshCat(env, cat)); } catch (_) {} } // SWR
    else list = await refreshCat(env, cat);
  }
  list = list || [];

  return json({ ok: list.length > 0, cat, items: list.slice(0, MAX_OUT) });
});
