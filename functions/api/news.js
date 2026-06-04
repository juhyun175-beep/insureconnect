/**
 * v2.14.0: 홈 보험뉴스 (네이버식) — GET /api/news?cat=all|sonbo|saengbo|policy
 *   보험 전문지(보험신보) + 연합뉴스(보험 필터) RSS를 합쳐 → 정리·중복제거·최신순 → D1 30분 캐시 → 홈 위젯
 *   소스/카테고리는 코드 고정(변조 차단). 헤드라인+출처+원문 링크만(전문 복제 X). 키 불필요.
 *   (구글 뉴스 RSS는 Cloudflare 데이터센터 IP를 503으로 차단 → 한국 언론사 RSS 직접 사용)
 */
import { json, corsPreflight, handle } from '../_lib/http.js';

// 보험 관련 필터(일반지 거를 때)
const INS_RE = /보험|손해|생명|실손|연금|보장|약관|금감원|금융위|손보|생보|공제|배상|보험사/;

// 뉴스 소스 (코드 고정) — insOnly=true 면 보험 관련만 추림
const SOURCES = [
  { url: 'https://www.insnews.co.kr/rss/allArticle.xml', name: '보험신보', insOnly: false },
  { url: 'https://www.yna.co.kr/rss/economy.xml',        name: '연합뉴스', insOnly: true  },
];

// 카테고리 → 키워드(제목 필터). all 은 전체
const CAT_KW = {
  all: null,
  sonbo:   /손해보험|손보|자동차보험|화재|배상|실손|다이렉트|펫보험|여행자|운전자/,
  saengbo: /생명보험|생보|종신|정기보험|변액|연금|건강보험|치매|간병|어린이|상해/,
  policy:  /금융위|금감원|금융감독원|감독원|당국|보험업법|제도|개정|시행|가이드|분쟁|소비자|약관/,
};

const TTL_MS = 30 * 60 * 1000; // 30분
const POOL_KEY = '_pool';
const MAX_POOL = 40, MAX_OUT = 10;

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

function parseFeed(xml, name) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const title = decodeEntities(pick(b, 'title'));
    const link = decodeEntities(pick(b, 'link')) || decodeEntities(pick(b, 'guid'));
    const pubDate = (pick(b, 'pubDate') || pick(b, 'dc:date') || '').trim();
    if (title && link && /^https?:/.test(link)) out.push({ title, link, source: name, pubDate });
  }
  return out;
}

async function fetchFeed(src) {
  try {
    const r = await fetch(src.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InsureConnectBot/1.0; +https://insureconnect-hub.pages.dev)',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (!r.ok) return { name: src.name, status: r.status, items: [] };
    let items = parseFeed(await r.text(), src.name);
    if (src.insOnly) items = items.filter((it) => INS_RE.test(it.title));
    return { name: src.name, status: r.status, items };
  } catch (e) { return { name: src.name, status: 'ERR', items: [], error: String((e && e.message) || e) }; }
}

function buildPool(results) {
  const seen = new Set(); const pool = [];
  for (const r of results) for (const it of r.items) {
    const key = it.title.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key); pool.push(it);
  }
  pool.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  return pool.slice(0, MAX_POOL);
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const url = new URL(request.url);
  const reqCat = url.searchParams.get('cat');
  const cat = Object.prototype.hasOwnProperty.call(CAT_KW, reqCat) ? reqCat : 'all';
  const now = Date.now();

  // 1) pool 캐시(30분)
  let pool = null;
  try {
    const c = await env.DB.prepare(`SELECT payload, fetched_at FROM ic_news_cache WHERE cat = ?`).bind(POOL_KEY).first();
    if (c && c.fetched_at && (now - Date.parse(c.fetched_at)) < TTL_MS) pool = JSON.parse(c.payload);
  } catch (_) {}

  // 2) 만료/없음 → 소스 fetch + merge
  if (!pool) {
    const results = await Promise.all(SOURCES.map(fetchFeed));
    pool = buildPool(results);
    if (pool.length) {
      try {
        await env.DB.prepare(
          `INSERT INTO ic_news_cache (cat, payload, fetched_at) VALUES (?, ?, ?)
           ON CONFLICT(cat) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`
        ).bind(POOL_KEY, JSON.stringify(pool), new Date().toISOString()).run();
      } catch (_) {}
    } else {
      // 새로 못 가져옴 → 오래된 캐시라도(stale)
      try { const c = await env.DB.prepare(`SELECT payload FROM ic_news_cache WHERE cat = ?`).bind(POOL_KEY).first(); if (c) pool = JSON.parse(c.payload); } catch (_) {}
    }
  }
  pool = pool || [];

  // 3) 카테고리 필터(제목 키워드) — 비면 전체로 폴백
  const kw = CAT_KW[cat];
  let items = kw ? pool.filter((it) => kw.test(it.title)) : pool;
  if (!items.length) items = pool;

  return json({ ok: pool.length > 0, cat, items: items.slice(0, MAX_OUT) });
});
