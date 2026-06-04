/**
 * v2.14.0: 홈 보험뉴스 (네이버식) — GET /api/news?cat=all|sonbo|saengbo|policy
 *   구글 뉴스 RSS(키 불필요)에서 보험 키워드 뉴스 → 태그/엔티티 정리 → D1 30분 캐시 → 홈 위젯
 *   카테고리 쿼리는 코드 고정(사용자 입력 아님 — 변조 차단). 헤드라인+출처+원문 링크만(전문 복제 X).
 */
import { json, corsPreflight, handle } from '../_lib/http.js';

// 카테고리 → 검색어 (코드 고정)
const CATS = {
  all:     '보험',
  sonbo:   '손해보험',
  saengbo: '생명보험',
  policy:  '금융감독원 보험',
};
const TTL_MS = 30 * 60 * 1000; // 30분 캐시
const MAX_ITEMS = 12;

const rssUrl = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;

function decodeEntities(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (_) { return ''; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch (_) { return ''; } })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

const pick = (block, tag) => {
  const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'));
  return m ? m[1] : '';
};

function parseRss(xml) {
  const out = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const b of blocks) {
    const rawTitle = decodeEntities(pick(b, 'title'));
    const link = decodeEntities(pick(b, 'link'));
    const pubDate = pick(b, 'pubDate').trim();
    let source = decodeEntities(pick(b, 'source'));
    let title = rawTitle;
    // 구글은 제목 끝에 " - 언론사"를 붙임 → 분리
    if (source && title.endsWith(' - ' + source)) {
      title = title.slice(0, title.length - (source.length + 3)).trim();
    } else {
      const idx = title.lastIndexOf(' - ');
      if (idx > 8) { if (!source) source = title.slice(idx + 3).trim(); title = title.slice(0, idx).trim(); }
    }
    if (title && link) out.push({ title, link, source, pubDate });
  }
  return out;
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const url = new URL(request.url);
  const reqCat = url.searchParams.get('cat');
  const cat = CATS[reqCat] ? reqCat : 'all';
  const query = CATS[cat];
  const now = Date.now();

  // 1) 캐시(30분) 우선
  try {
    const c = await env.DB.prepare(`SELECT payload, fetched_at FROM ic_news_cache WHERE cat = ?`).bind(cat).first();
    if (c && c.fetched_at && (now - Date.parse(c.fetched_at)) < TTL_MS) {
      return json({ ok: true, cat, cached: true, items: JSON.parse(c.payload) });
    }
  } catch (_) {}

  // 2) 구글 뉴스 RSS fetch + 파싱
  let items = [];
  try {
    const r = await fetch(rssUrl(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InsureConnectBot/1.0; +https://insureconnect-hub.pages.dev)',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (r.ok) items = parseRss(await r.text()).slice(0, MAX_ITEMS);
  } catch (_) {}

  // 3) 성공 → 캐시 저장 후 반환
  if (items.length) {
    try {
      await env.DB.prepare(
        `INSERT INTO ic_news_cache (cat, payload, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(cat) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`
      ).bind(cat, JSON.stringify(items), new Date().toISOString()).run();
    } catch (_) {}
    return json({ ok: true, cat, items });
  }

  // 4) 실패 → 오래된 캐시라도(stale), 없으면 빈 결과(위젯이 graceful 처리)
  try {
    const c = await env.DB.prepare(`SELECT payload FROM ic_news_cache WHERE cat = ?`).bind(cat).first();
    if (c) return json({ ok: true, cat, stale: true, items: JSON.parse(c.payload) });
  } catch (_) {}
  return json({ ok: false, cat, code: 'unavailable', items: [] });
});
