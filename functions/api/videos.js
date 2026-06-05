/**
 * v2.14.5: 홈 영상 카드 (유튜브) — GET /api/videos
 *   경제·금융 유튜브 채널 RSS(Atom, 키 불필요)에서 최신 업로드 → 썸네일·제목·링크 → D1 캐시(10분)+SWR → 홈 영상 카드
 *   채널=코드 고정(변조 차단). 썸네일은 i.ytimg.com(영상ID로 구성, 핫링크 무관). 클릭 시 유튜브로 이동.
 */
import { json, corsPreflight, handle } from '../_lib/http.js';

// 채널(코드 고정) — 금융 유튜버 + 경제·뉴스 방송사 믹스
const CHANNELS = [
  { id: 'UChlv4GSd7OQl3js-jkLOnFA', name: '삼프로TV' },
  { id: 'UCsJ6RuBiTVWRX156FVbeaGg', name: '슈카월드' },
  { id: 'UCF8AeLlUbEpKju6v1H6p8Eg', name: '한국경제TV' },
  { id: 'UCuuTCooIMbBFHNbPcSS70uw', name: 'SBS News' },
  { id: 'UChlgI3UHCOnwUGzWzbJ3H5w', name: 'YTN' },
  { id: 'UCcQTRi69dsVYHN3exePtZ1A', name: 'KBS News' },
  { id: 'UCuw1hxBo5mDVUhgMzRDk3aw', name: 'TV조선' },
  { id: 'UCJr1BV3rWhi7HR4Yfa70RgQ', name: '채널A' },
];
const FEED = (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
const TTL_MS = 5 * 60 * 1000; // 5분(더 실시간) + SWR
const KEY = 'videos', MAX_OUT = 16, MAX_CACHE = 50;

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

function parseYouTube(xml, name) {
  const out = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const e of entries) {
    const vm = e.match(/<yt:videoId>([A-Za-z0-9_-]{6,20})<\/yt:videoId>/);
    if (!vm) continue;
    const vid = vm[1];
    const title = decodeEntities((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const pubDate = ((e.match(/<published>([^<]+)<\/published>/) || [])[1] || '').trim();
    if (title) out.push({
      title,
      link: `https://www.youtube.com/watch?v=${vid}`,
      image: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
      source: name,
      pubDate,
    });
  }
  return out;
}

async function fetchChannel(ch) {
  try {
    const r = await fetch(FEED(ch.id), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InsureConnectBot/1.0; +https://insureconnect-hub.pages.dev)',
        'Accept': 'application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return [];
    return parseYouTube(await r.text(), ch.name);
  } catch (_) { return []; }
}

function buildList(lists) {
  // 채널 내부 최신순 정렬
  const sorted = lists.map((items) => items.slice().sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0)));
  // 채널 라운드로빈 인터리브 — 자주 올리는 채널(한경TV)이 독식하지 않게 + 각 채널 고루 노출
  const seen = new Set(); const out = [];
  for (let i = 0; ; i++) {
    let any = false;
    for (const lst of sorted) {
      if (i >= lst.length) continue;
      any = true;
      const it = lst[i];
      if (seen.has(it.link)) continue;
      seen.add(it.link); out.push(it);
    }
    if (!any) break;
  }
  return out;
}

async function refresh(env) {
  const lists = await Promise.all(CHANNELS.map(fetchChannel));
  const list = buildList(lists).slice(0, MAX_CACHE);
  if (list.length) {
    try {
      await env.DB.prepare(
        `INSERT INTO ic_news_cache (cat, payload, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(cat) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`
      ).bind(KEY, JSON.stringify(list), new Date().toISOString()).run();
    } catch (_) {}
  }
  return list;
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async (context) => handle(async () => {
  const { env } = context;
  const now = Date.now();

  let list = null, fetchedAt = 0;
  try {
    const c = await env.DB.prepare(`SELECT payload, fetched_at FROM ic_news_cache WHERE cat = ?`).bind(KEY).first();
    if (c) { list = JSON.parse(c.payload); fetchedAt = Date.parse(c.fetched_at) || 0; }
  } catch (_) {}

  const stale = !list || (now - fetchedAt) >= TTL_MS;
  if (!list) {
    list = await refresh(env);
  } else if (stale) {
    if (context.waitUntil) { try { context.waitUntil(refresh(env)); } catch (_) {} }
    else list = await refresh(env);
  }
  list = list || [];

  return json({ ok: list.length > 0, items: list.slice(0, MAX_OUT) });
});
