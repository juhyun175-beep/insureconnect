/**
 * v2.138.0: SEO 랜딩 제휴 파트너 스트립 + viewable 임프레션 + 성과 통계 테스트
 *
 *   문자열 존재 검사로 끝내지 않는다. v2.135.0 SEO 팝업 테스트처럼 VM 샌드박스에서
 *   스트립 클라이언트 스크립트를 실제 실행하고, IntersectionObserver 를 mock 으로 주입해
 *   카드별 뷰어블 임프레션 동작을 검증한다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ── seoCtaFooter() 실행해 실제 주입 HTML 확보 (기존 v2.135.0 테스트와 동일 방식) ──
const seoSource = read('functions/_lib/seo-cta.js');
const seoScript = `${seoSource.replace(/^import .*;\r?\n/gm, '').replace(/\bexport\s+/g, '')}\nthis.__exports = { seoCtaFooter };`;
const seoSandbox = { coupangModal: () => '' };
vm.createContext(seoSandbox);
vm.runInContext(seoScript, seoSandbox, { filename: 'seo-cta.js' });
const footerHtml = seoSandbox.__exports.seoCtaFooter('https://insureconnect.co.kr');

// 스트립 IIFE 코드 추출(마커 사이)
function extractStrip(html) {
  const startC = html.indexOf('SEO_PARTNER_STRIP_START');
  const iife = html.indexOf('(function(){', startC);
  const endC = html.indexOf('/* SEO_PARTNER_STRIP_END', iife);
  assert(startC >= 0 && iife > startC && endC > iife, 'strip IIFE not extractable');
  return html.slice(iife, endC);
}
const stripCode = extractStrip(footerHtml);

// ── mock DOM/IO/fetch 하네스 ──
function makeEl(tag) {
  return {
    tagName: tag, className: '', textContent: '', style: {},
    _attrs: {}, _children: [], _listeners: {},
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    appendChild(c) { this._children.push(c); return c; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    _fire(ev) { (this._listeners[ev] || []).forEach((fn) => fn()); },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

async function runStrip({ partners = [], ua = 'Mozilla/5.0', withIO = true } = {}) {
  const box = makeEl('div');
  const created = [];
  const trackCalls = [];
  const fetchUrls = [];
  const ioInstances = [];

  class IOMock {
    constructor(cb, opts) { this.cb = cb; this.opts = opts; this.observed = []; ioInstances.push(this); }
    observe(el) { this.observed.push(el); }
    unobserve(el) { this.observed = this.observed.filter((x) => x !== el); }
    disconnect() { this.observed = []; }
    fire(el, ratio) { this.cb([{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio }], this); }
  }

  const documentMock = {
    getElementById(id) { return id === 'seo-partner-strip' ? box : null; },
    createElement(tag) { const el = makeEl(tag); created.push(el); return el; },
  };
  function fetchMock(url, opts) {
    fetchUrls.push(url);
    if (url === '/api/partners?active=1') return Promise.resolve({ json: () => Promise.resolve(partners) });
    if (url === '/api/track/card-click') { trackCalls.push(JSON.parse(opts.body)); return Promise.resolve({ json: () => Promise.resolve({ ok: true }) }); }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  }
  const windowMock = {};
  if (withIO) windowMock.IntersectionObserver = IOMock;

  const sandbox = {
    window: windowMock,
    document: documentMock,
    navigator: { userAgent: ua },
    fetch: fetchMock,
    console,
  };
  if (withIO) sandbox.IntersectionObserver = IOMock;
  vm.createContext(sandbox);
  vm.runInContext(stripCode, sandbox, { filename: 'seo-cta.js#partner-strip' });
  await flush();
  await flush();

  const cards = created.filter((el) => el.className === 'spx-card');
  const cardById = (pid) => cards.find((c) => c.getAttribute('data-partner-id') === String(pid));
  return { box, created, cards, cardById, trackCalls, fetchUrls, ioInstances, io: ioInstances[0] };
}

const P = (over) => Object.assign({ id: 1, name: 'Alpha', tagline: 't', category: 'c', href: 'https://a.example', img: '' }, over);

// ════════════════════════════════════════════════════════════════
//  주입 마크업 · 캐시
// ════════════════════════════════════════════════════════════════

test('seoCtaFooter: placeholder(.seo-cta 위) + 스트립 스크립트 주입', () => {
  assert(footerHtml.includes('<div id="seo-partner-strip"'), 'placeholder missing');
  assert(/id="seo-partner-strip"[^>]*style="display:none"/.test(footerHtml), 'placeholder must start hidden');
  const phIdx = footerHtml.indexOf('id="seo-partner-strip"');
  const ctaIdx = footerHtml.indexOf('<footer class="seo-cta"');
  assert(phIdx >= 0 && ctaIdx > phIdx, 'placeholder must sit above the .seo-cta block');
  assert(footerHtml.includes("menu:'제휴파트너'"), 'strip tracking must use 제휴파트너 menu');
  assert(!footerHtml.includes('_BOT_UA_RE'), 'must not reference a non-existent shared bot constant');
});

test('SSR HTML에 파트너 데이터를 서버 렌더하지 않는다(placeholder는 비어있음)', () => {
  // placeholder div 는 자기 자신으로 즉시 닫힘 → 서버 렌더 카드 없음
  assert(/<div id="seo-partner-strip"[^>]*><\/div>/.test(footerHtml), 'placeholder must be empty (JS-rendered only)');
});

test('공개 /api/partners?active=1 캐시 정책 적용', () => {
  const api = read('functions/api/partners/index.js');
  assert(api.includes("'Cache-Control': 'public, max-age=60, s-maxage=300'"), 'public active response should be cacheable');
});

// ════════════════════════════════════════════════════════════════
//  스트립 렌더 · 뷰어블 임프레션 (VM 실행)
// ════════════════════════════════════════════════════════════════

test('1. 렌더 직후(관측 콜백 전) imp 요청 0건', async () => {
  const r = await runStrip({ partners: [P()] });
  assert.strictEqual(r.cards.length, 1, 'one card rendered');
  assert.strictEqual(r.trackCalls.length, 0, 'no imp/click before IO callback');
  assert.strictEqual(r.box.style.display, '', 'strip shown after render');
});

test('2. intersectionRatio 0.49 → 0건, 0.5 → 해당 카드 imp 1건', async () => {
  const r = await runStrip({ partners: [P({ id: 7 })] });
  const card = r.cardById(7);
  r.io.fire(card, 0.49);
  assert.strictEqual(r.trackCalls.length, 0, '0.49 must not count');
  r.io.fire(card, 0.5);
  assert.deepStrictEqual(r.trackCalls, [{ menu: '제휴파트너', card: 'imp:7' }], '0.5 counts one imp');
});

test('3. 같은 카드 콜백 재실행 시 추가 전송 없음(dedupe)', async () => {
  const r = await runStrip({ partners: [P({ id: 7 })] });
  const card = r.cardById(7);
  r.io.fire(card, 0.6);
  r.io.fire(card, 0.9);
  assert.strictEqual(r.trackCalls.filter((c) => c.card === 'imp:7').length, 1, 'imp deduped');
});

test('4. 카드 4개 독립 집계 — 1개 진입 시 나머지 imp 없음', async () => {
  const partners = [P({ id: 1 }), P({ id: 2 }), P({ id: 3 }), P({ id: 4 }), P({ id: 5 })];
  const r = await runStrip({ partners });
  assert.strictEqual(r.cards.length, 4, 'max 4 cards (slice 0,4)');
  r.io.fire(r.cardById(2), 0.5);
  assert.deepStrictEqual(r.trackCalls, [{ menu: '제휴파트너', card: 'imp:2' }], 'only intersecting card counted');
});

test('5. imp 미전송 카드 클릭 시 imp 1 + click 1 순서 전송', async () => {
  const r = await runStrip({ partners: [P({ id: 9 })] });
  const card = r.cardById(9);
  card._fire('click');
  assert.deepStrictEqual(r.trackCalls, [
    { menu: '제휴파트너', card: 'imp:9' },
    { menu: '제휴파트너', card: 'click:9' },
  ], 'click must send imp first then click');
  // 이후 관측 콜백은 중복 imp 미전송
  r.io.fire(card, 0.9);
  assert.strictEqual(r.trackCalls.filter((c) => c.card === 'imp:9').length, 1, 'no duplicate imp after click');
});

test('6. 봇 UA에서 partners fetch/추적 요청 미발생', async () => {
  const r = await runStrip({ partners: [P()], ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
  assert.strictEqual(r.fetchUrls.length, 0, 'bot must not fetch partners');
  assert.strictEqual(r.trackCalls.length, 0, 'bot must not track');
  assert.strictEqual(r.cards.length, 0, 'bot must not render cards');
});

test('7. IO 미지원 환경에서 페이지로드 임프레션 폴백 없음(클릭 보정만)', async () => {
  const r = await runStrip({ partners: [P({ id: 3 })], withIO: false });
  assert.strictEqual(r.cards.length, 1, 'cards still render without IO');
  assert.strictEqual(r.trackCalls.length, 0, 'no pageload impression fallback');
  assert.strictEqual(r.ioInstances.length, 0, 'no IntersectionObserver constructed');
  r.cardById(3)._fire('click');
  assert.deepStrictEqual(r.trackCalls, [
    { menu: '제휴파트너', card: 'imp:3' },
    { menu: '제휴파트너', card: 'click:3' },
  ], 'click correction path still sends imp then click');
});

test('8. HTML 특수문자 name/tagline 이스케이프(textContent), javascript: href 카드 스킵', async () => {
  const evil = '<img src=x onerror=alert(1)>';
  const partners = [
    P({ id: 1, name: evil, tagline: '</b><script>x</script>', href: 'https://ok.example' }),
    P({ id: 2, name: 'JS', href: 'javascript:alert(1)' }),
    P({ id: 3, name: 'Data', href: 'data:text/html,x' }),
  ];
  const r = await runStrip({ partners });
  // javascript:/data: 카드 스킵
  assert.strictEqual(r.cards.length, 1, 'unsafe-href cards skipped');
  assert(r.cardById(1), 'safe card kept');
  assert(!r.cardById(2) && !r.cardById(3), 'unsafe cards absent');
  // name 은 textContent 로 저장(문자열 그대로) — HTML 로 실행되지 않음
  const nameEl = r.created.find((el) => el.className === 'spx-name');
  assert.strictEqual(nameEl.textContent, evil, 'name rendered as literal text via textContent');
  // 스트립 소스가 innerHTML 문자열 보간을 쓰지 않음
  assert(!stripCode.includes('.innerHTML'), 'strip must not use innerHTML');
  assert(stripCode.includes("img.referrerPolicy = 'no-referrer'") || stripCode.includes("img.referrerPolicy='no-referrer'"), 'external img referrerpolicy');
});

test('스트립 카드 rel 토큰(sponsored/nofollow/noopener/noreferrer) + 헤더/카드 AD + 고지', async () => {
  const r = await runStrip({ partners: [P()] });
  const card = r.cards[0];
  const tokens = String(card.rel || '').split(/\s+/);
  ['noopener', 'noreferrer', 'nofollow', 'sponsored'].forEach((t) => assert(tokens.includes(t), `rel token ${t}`));
  assert.strictEqual(card.target, '_blank', 'target _blank');
  const adEls = r.created.filter((el) => (el.className === 'spx-ad' || el.className === 'spx-card-ad') && el.textContent === 'AD');
  assert(adEls.length >= 2, 'header AD + card AD present');
  const note = r.created.find((el) => el.className === 'spx-note');
  assert(note && note.textContent.includes('각 파트너사에서 직접 진행됩니다'), 'disclosure note present');
});

// ════════════════════════════════════════════════════════════════
//  성과 통계 API (VM 없이 직접 호출)
// ════════════════════════════════════════════════════════════════

function makeStatsDb({ partners, events }) {
  return {
    prepare(sql) {
      let b = [];
      return {
        bind(...v) { b = v; return this; },
        async all() {
          if (/FROM ic_partner_cards/.test(sql)) return { results: partners };
          if (/ic_card_clicks_daily/.test(sql)) return { results: events };
          return { results: [] };
        },
      };
    },
  };
}

test('9. stats API: 0실적 파트너 반환·삭제 잔여 보존·partner_id 문자열·verifyAdmin·기본 30일', async () => {
  const mod = await import(pathToFileURL(path.join(root, 'functions/api/partners/index.js')).href);
  const db = makeStatsDb({
    partners: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
    events: [
      { card: 'imp:1', n: 100 }, { card: 'click:1', n: 5 },
      { card: 'imp:9', n: 12 }, { card: 'click:9', n: 3 }, // 9 = 삭제 파트너 잔여
      { card: 'junk', n: 50 },
    ],
  });
  const env = { DB: db, ADMIN_SECRET: 'sec' };
  // verifyAdmin 가드
  const noAuth = await mod.onRequestGet({ request: new Request('https://x/api/partners?stats=1'), env });
  assert.strictEqual(noAuth.status, 401, 'stats requires admin');
  // 기본 days=30
  const res = await mod.onRequestGet({ request: new Request('https://x/api/partners?stats=1', { headers: { 'x-admin-secret': 'sec' } }), env });
  const j = await res.json();
  assert.strictEqual(j.days, 30, 'default days 30');
  const byId = {};
  j.stats.forEach((s) => { byId[s.partner_id] = s; assert.strictEqual(typeof s.partner_id, 'string', 'partner_id string'); });
  assert.deepStrictEqual(byId['1'], { partner_id: '1', name: 'Alpha', impressions: 100, clicks: 5, ctr: 5 });
  assert.deepStrictEqual(byId['2'], { partner_id: '2', name: 'Beta', impressions: 0, clicks: 0, ctr: 0 }, '0-perf current partner returned');
  assert(byId['9'] && byId['9'].name === '9' && byId['9'].impressions === 12, 'deleted partner residual preserved with id-as-name');
  // days 범위 클램프 7~90
  const clamp = async (d) => (await (await mod.onRequestGet({ request: new Request('https://x/api/partners?stats=1&days=' + d, { headers: { 'x-admin-secret': 'sec' } }), env })).json()).days;
  assert.strictEqual(await clamp(1), 7, 'days clamped to min 7');
  assert.strictEqual(await clamp(999), 90, 'days clamped to max 90');
});

// ════════════════════════════════════════════════════════════════
//  홈 파트너 존 임프레션 (v2.137.0 회귀 포함) · 관리자 성과표
// ════════════════════════════════════════════════════════════════

test('10. 홈 파트너 존 임프레션 로직 + v2.137.0 안전 렌더 회귀', () => {
  const html = read('index.html');
  // 신규 임프레션 로직
  assert(html.includes("trackCardClick('제휴파트너', 'imp:' + pid)"), 'home zone viewable imp missing');
  assert(html.includes("trackCardClick('제휴파트너', 'click:' + pid)"), 'home zone card click missing');
  assert(html.includes('threshold: 0.5'), 'home zone imp threshold 0.5 missing');
  assert(html.includes('function sendImpZone('), 'home zone imp dedupe helper missing');
  // v2.137.0 회귀 — id 기반 추적키·textContent·rel 유지
  assert(html.includes("trackClick('partner-' + p.id, 'partner')"), 'v2.137.0 id-based link tracking must remain');
  assert(html.includes('nameEl.textContent = nm'), 'v2.137.0 textContent rendering must remain');
  assert(html.includes("a.rel = 'noopener noreferrer nofollow sponsored'"), 'v2.137.0 rel tokens must remain');
});

test('관리자 성과표: 기간 셀렉트 + 노출/클릭/CTR + 천단위 콤마 + 데이터 성격 각주', () => {
  const html = read('admin.html');
  assert(html.includes('id="pt-stats-days"'), 'period select missing');
  assert(/value="7"[\s\S]*value="30"[\s\S]*value="90"/.test(html), '7/30/90 options missing');
  assert(html.includes('/api/partners?stats=1&days='), 'admin should fetch stats API');
  assert(html.includes("toLocaleString('en-US')"), 'thousands separator missing');
  assert(html.includes('감사 가능한 과금'), 'data-nature footnote missing');
});

console.log('seo partner strip / impressions / stats tests defined');
