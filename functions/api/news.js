/**
 * v2.14.2: 홈 보험뉴스 (카드형·실시간) — GET /api/news?cat=all|sonbo|saengbo|policy
 *   보험 전문지(보험신보) + 연합뉴스·한국경제(보험 필터) RSS 합쳐 → 정리·썸네일 추출·중복제거·최신순
 *   → D1 캐시(10분) + stale-while-revalidate(방문 시 백그라운드 갱신 → 계속 최신화) → 홈 카드 위젯
 *   소스/카테고리 코드 고정. 헤드라인+썸네일+출처+원문 링크만(전문 복제 X). 키 불필요.
 *   (구글 뉴스 RSS는 Cloudflare 데이터센터 IP를 503 차단 → 한국 언론사 RSS 직접 사용)
 */
import { json, corsPreflight, handle } from '../_lib/http.js';

// 보험 관련 필터(일반지 거를 때)
const INS_RE = /보험|손해|생명|실손|연금|보장|약관|금감원|금융위|손보|생보|공제|배상|보험사|보험료|보험금/;

// 뉴스 소스(코드 고정) — insOnly=true 면 보험 관련 제목만
const SOURCES = [
  { url: 'https://www.insnews.co.kr/rss/allArticle.xml', name: '보험신보', insOnly: false },
  { url: 'https://www.yna.co.kr/rss/economy.xml',        name: '연합뉴스', insOnly: true  }, // 썸네일 O
  { url: 'https://www.yna.co.kr/rss/market.xml',         name: '연합뉴스', insOnly: true  }, // 썸네일 O
  { url: 'https://www.hankyung.com/feed/economy',        name: '한국경제', insOnly: true  },
];

const CAT_KW = {
  all: null,
  sonbo:   /손해보험|손보|자동차보험|화재|배상|실손|다이렉트|펫보험|여행자|운전자/,
  saengbo: /생명보험|생보|종신|정기보험|변액|연금|건강보험|치매|간병|어린이|상해/,
  policy:  /금융위|금감원|금융감독원|감독원|당국|보험업법|제도|개정|시행|가이드|분쟁|소비자|약관/,
};

const TTL_MS = 10 * 60 * 1000; // 10분(짧게 → 자주 최신화)
const POOL_KEY = '_pool';
const MAX_POOL = 40, MAX_OUT = 12;

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

async function fetchFeed(src) {
  try {
    const r = await fetch(src.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InsureConnectBot/1.0; +https://insureconnect-hub.pages.dev)',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return { items: [] };
    let items = parseFeed(await r.text(), src.name);
    if (src.insOnly) items = items.filter((it) => INS_RE.test(it.title));
    return { items };
  } catch (_) { return { items: [] }; }
}

function buildPool(results) {
  // 각 소스 내부는 최신순 정렬
  const lists = results.map((r) => {
    const s = (r.items || []).slice();
    s.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
    return s;
  });
  // 소스 라운드로빈 인터리브 — 다발 게시 매체(보험신보)가 풀을 독식하지 않게 + 이미지 소스(연합) 고루 노출
  const seen = new Set(); const pool = [];
  for (let i = 0; pool.length < MAX_POOL; i++) {
    let any = false;
    for (const lst of lists) {
      if (i >= lst.length) continue;
      any = true;
      const it = lst[i];
      const key = it.title.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key); pool.push(it);
      if (pool.length >= MAX_POOL) break;
    }
    if (!any) break;
  }
  return pool;
}

async function refreshPool(env) {
  const results = await Promise.all(SOURCES.map(fetchFeed));
  const pool = buildPool(results);
  if (pool.length) {
    try {
      await env.DB.prepare(
        `INSERT INTO ic_news_cache (cat, payload, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(cat) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`
      ).bind(POOL_KEY, JSON.stringify(pool), new Date().toISOString()).run();
    } catch (_) {}
  }
  return pool;
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async (context) => handle(async () => {
  const { env, request } = context;
  const url = new URL(request.url);
  const reqCat = url.searchParams.get('cat');
  const cat = Object.prototype.hasOwnProperty.call(CAT_KW, reqCat) ? reqCat : 'all';
  const now = Date.now();

  // 캐시 로드
  let pool = null, fetchedAt = 0;
  try {
    const c = await env.DB.prepare(`SELECT payload, fetched_at FROM ic_news_cache WHERE cat = ?`).bind(POOL_KEY).first();
    if (c) { pool = JSON.parse(c.payload); fetchedAt = Date.parse(c.fetched_at) || 0; }
  } catch (_) {}

  const stale = !pool || (now - fetchedAt) >= TTL_MS;
  if (!pool) {
    pool = await refreshPool(env);                 // 캐시 없음 → 동기 갱신
  } else if (stale) {
    // stale-while-revalidate: 즉시 stale 제공 + 백그라운드 갱신(다음 방문자는 최신)
    if (context.waitUntil) { try { context.waitUntil(refreshPool(env)); } catch (_) {} }
    else pool = await refreshPool(env);
  }
  pool = pool || [];

  // 카테고리 필터(제목 키워드) — 비면 전체로 폴백
  const kw = CAT_KW[cat];
  let items = kw ? pool.filter((it) => kw.test(it.title)) : pool;
  if (!items.length) items = pool;

  return json({ ok: pool.length > 0, cat, items: items.slice(0, MAX_OUT) });
});
