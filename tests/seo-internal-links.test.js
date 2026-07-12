const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const seoLinksPath = path.join(root, 'functions/_lib/seo-links.js');

function loadSeoLinks() {
  const source = fs
    .readFileSync(seoLinksPath, 'utf8')
    .replace(/\bexport\s+/g, '');
  const script = `${source}\nthis.__exports = { seedFromSlug, pickRelatedPosts, relatedHtml, crossLinkHtml };`;
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: 'seo-links.js' });
  return { mod: sandbox.__exports, source };
}

function makeDb(rows, { fail = false } = {}) {
  const calls = [];
  const db = {
    prepare(sql) {
      if (fail) throw new Error('db unavailable');
      const call = { sql, bound: [] };
      calls.push(call);
      return {
        bind(...values) {
          call.bound = values;
          return this;
        },
        async all() {
          return { results: rows };
        },
      };
    },
  };
  return { db, calls };
}

function loadRoute(rel, globals) {
  const source = fs
    .readFileSync(path.join(root, rel), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/\bexport\s+/g, '');
  const script = `${source}\nthis.__exports = { onRequestGet };`;
  const sandbox = { Response, console, ...globals };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: rel });
  return { mod: sandbox.__exports, source };
}

function makeRouteDb() {
  return {
    prepare() {
      return {
        bind() { return this; },
        async all() { return { results: [] }; },
      };
    },
  };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

module.exports = (async () => {
  const { mod, source } = loadSeoLinks();

  assert.strictEqual(mod.seedFromSlug('samsung-life'), 90769236, 'slug hash should use stable unsigned FNV-1a');
  assert.strictEqual(mod.seedFromSlug('samsung-life'), mod.seedFromSlug('samsung-life'), 'same slug should keep the same seed');
  assert.notStrictEqual(mod.seedFromSlug('samsung-life'), mod.seedFromSlug('meritz-fire'), 'different slugs should spread across the pool');
  assert(Number.isInteger(mod.seedFromSlug('한글-slug')), 'hash should be an integer for UTF-16 input');
  assert(mod.seedFromSlug('한글-slug') >= 0, 'hash should be unsigned');
  assert(!source.includes('Math.random'), 'SEO links must never depend on Math.random()');

  const pool = Array.from({ length: 10 }, (_, i) => ({
    category: i < 5 ? 'claim' : 'terms',
    slug: `post-${String(i).padStart(2, '0')}`,
    title: `Post ${i}`,
  }));
  const { db, calls } = makeDb(pool);
  const first = await mod.pickRelatedPosts(db, 'samsung-life', ['claim', 'terms']);
  const second = await mod.pickRelatedPosts(db, 'samsung-life', ['claim', 'terms']);

  assert.deepStrictEqual(
    plain(first.map((post) => post.slug)),
    ['post-06', 'post-07', 'post-08', 'post-09', 'post-00'],
    'offset and stride should select the deterministic five-post window',
  );
  assert.deepStrictEqual(plain(second), plain(first), 'same URL seed should always return the same posts');
  assert.strictEqual(new Set(first.map((post) => post.slug)).size, 5, 'selected posts should be unique');
  assert.strictEqual(calls.length, 2, 'each helper call should issue one pool query');
  for (const call of calls) {
    assert(/FROM\s+ic_seo_posts/.test(call.sql), 'query should read ic_seo_posts');
    assert(/status\s*=\s*'published'/.test(call.sql), 'query should keep only published posts');
    assert(/category\s+IN\s*\(\?,\?\)/.test(call.sql), 'IN placeholders should come only from category count');
    assert(/ORDER\s+BY\s+category,\s*slug/.test(call.sql), 'pool order should be stable');
    assert(!call.sql.includes('claim') && !call.sql.includes('terms'), 'category values must not be interpolated into SQL');
    assert.deepStrictEqual(call.bound, ['claim', 'terms'], 'category values should be bound in order');
  }

  const cyclePool = pool.slice(0, 6);
  const cycleResult = await mod.pickRelatedPosts(makeDb(cyclePool).db, 'meritz-fire', ['claim'], 5);
  assert.strictEqual(cycleResult.length, 5, 'short stride cycles should deterministically fill to n when the pool is large enough');
  assert.strictEqual(new Set(cycleResult.map((post) => post.slug)).size, 5, 'cycle fallback should not duplicate posts');

  let emptyPrepareCalls = 0;
  const emptyDb = { prepare() { emptyPrepareCalls += 1; throw new Error('should not query'); } };
  assert.deepStrictEqual(plain(await mod.pickRelatedPosts(emptyDb, 'x', [])), [], 'empty categories should return an empty pool');
  assert.strictEqual(emptyPrepareCalls, 0, 'empty categories should not build an invalid IN clause');
  assert.deepStrictEqual(plain(await mod.pickRelatedPosts(makeDb([], { fail: true }).db, 'x', ['claim'])), [], 'DB failures should return an empty array');

  assert.strictEqual(mod.relatedHtml([], '관련 글 없음'), '', 'empty related data should omit the entire section');
  const related = mod.relatedHtml([
    { category: 'claim', slug: 'a"b', title: 'A & <B>' },
  ], '보험 <가이드>');
  assert(related.includes('<section class="card rel">'), 'related posts should use the existing card style');
  assert(related.includes('<h2>보험 &lt;가이드&gt;</h2>'), 'related heading should be escaped');
  assert(related.includes('href="/insurance/claim/a&quot;b"'), 'related href components should be escaped');
  assert(related.includes('A &amp; &lt;B&gt;'), 'related titles should be escaped');
  assert(!related.includes('관련 글 없음'), 'rendered sections should never add an empty-state phrase');

  const peers = [
    { slug: 'samsung-life', name: '삼성생명' },
    { slug: 'shinhan-life', name: '신한라이프' },
    { slug: 'shinhan-life', name: '중복 신한라이프' },
    { slug: 'hana-life', name: '하나생명' },
    { slug: 'kb-life', name: 'KB라이프' },
    { slug: 'db-life', name: 'DB생명' },
    { slug: 'nh-life', name: '농협생명' },
    { slug: 'kyobo-life', name: '교보생명' },
    { slug: 'aia-life', name: 'AIA생명' },
  ];
  const cross = mod.crossLinkHtml(peers, 'samsung-life', '같은 <유형>', '/company/', ' 전산 <바로가기>');
  const crossAgain = mod.crossLinkHtml(peers, 'samsung-life', '같은 <유형>', '/company/', ' 전산 <바로가기>');
  const hrefs = Array.from(cross.matchAll(/href="(\/company\/[^"]+)"/g), (m) => m[1]);
  assert.strictEqual(hrefs.length, 6, 'cross links should render six peers');
  assert.strictEqual(new Set(hrefs).size, 6, 'duplicate peers should be removed');
  assert(!hrefs.includes('/company/samsung-life'), 'current page should be excluded');
  assert.strictEqual(crossAgain, cross, 'cross links should be deterministic for the current slug');
  assert(cross.includes('<h2>같은 &lt;유형&gt;</h2>'), 'cross-link heading should be escaped');
  assert(cross.includes('전산 &lt;바로가기&gt;'), 'cross-link suffix should be escaped');
  assert.strictEqual(
    mod.crossLinkHtml([{ slug: 'only', name: '현재' }], 'only', '다른 페이지', '/ga/', ''),
    '',
    'no eligible peers should omit the entire cross-link section',
  );

  {
    const companyRel = 'functions/company/[slug].js';
    const companySource = fs.readFileSync(path.join(root, companyRel), 'utf8');
    assert(
      companySource.includes("import { INSURERS, INSURER_MAP, TYPE_LABEL } from '../_lib/insurers.js';"),
      'company route should import INSURERS for same-type cross links',
    );
    assert(
      companySource.includes("import { pickRelatedPosts, relatedHtml, crossLinkHtml } from '../_lib/seo-links.js';"),
      'company route should import shared SEO link helpers',
    );
    assert(!companySource.includes('const related = ['), 'company route should remove the hardcoded related array');

    const insurers = [
      { type: 'life', slug: 'samsung-life', name: '삼성생명', call: '1', incall: '2', fax: '3', erp: 'https://erp.example', gongsi: 'https://gongsi.example' },
      { type: 'life', slug: 'hana-life', name: '하나생명' },
      { type: 'life', slug: 'kb-life', name: 'KB라이프' },
      { type: 'nonlife', slug: 'meritz-fire', name: '메리츠화재' },
    ];
    const pickCalls = [];
    const relatedCalls = [];
    const crossCalls = [];
    const { mod: companyRoute } = loadRoute(companyRel, {
      INSURERS: insurers,
      INSURER_MAP: { 'samsung-life': insurers[0] },
      TYPE_LABEL: { life: '생명보험' },
      insurerNames: () => ['삼성생명', '삼성'],
      loadCompanyContent: async () => ({ coverages: [], cases: [], boardPosts: [] }),
      seoCtaFooter: () => '<footer></footer>',
      seoShareBar: () => '<div data-share></div>',
      seoPostingWidget: async () => '<aside data-widget></aside>',
      renderAggregation: () => null,
      AGGREGATIONS: {},
      renderClaimFormsHub: async () => null,
      pickRelatedPosts: async (...args) => {
        pickCalls.push(args);
        return [{ category: 'claim', slug: 'dynamic-post', title: '동적 관련글' }];
      },
      relatedHtml: (...args) => {
        relatedCalls.push(args);
        return '<section data-related></section>';
      },
      crossLinkHtml: (...args) => {
        crossCalls.push(args);
        return '<section data-cross></section>';
      },
    });
    const env = { DB: makeRouteDb() };
    const html = await (await companyRoute.onRequestGet({ params: { slug: 'samsung-life' }, env })).text();

    assert.strictEqual(pickCalls.length, 1, 'company route should pick related posts once');
    assert.strictEqual(pickCalls[0][0], env.DB, 'company related query should use the route DB binding');
    assert.strictEqual(pickCalls[0][1], 'samsung-life', 'company slug should seed related selection');
    assert.deepStrictEqual(
      plain(pickCalls[0][2]),
      ['claim', 'actual-loss', 'terms', 'surgery-code', 'disease-code'],
      'company route should use the five requested insurance categories',
    );
    assert.deepStrictEqual(
      plain(relatedCalls[0]),
      [[{ category: 'claim', slug: 'dynamic-post', title: '동적 관련글' }], '보험금 청구가 처음이라면'],
      'company route should render the selected related posts',
    );
    assert.deepStrictEqual(
      plain(crossCalls[0][0].map((peer) => peer.slug)),
      ['samsung-life', 'hana-life', 'kb-life'],
      'company cross links should receive only insurers with the same type',
    );
    assert.deepStrictEqual(
      plain(crossCalls[0].slice(1)),
      ['samsung-life', '같은 유형의 보험사 전산', '/company/', ' 전산 바로가기'],
      'company cross-link arguments should use the current slug and company base',
    );
    assert(html.includes('<section data-related></section><section data-cross></section>'), 'company HTML should render related and cross-link sections together');
    assert(!html.includes('/insurance/claim/claim-deadline-3-years'), 'company HTML should not retain a hardcoded related link');
  }

  {
    const gaRel = 'functions/ga/[slug].js';
    const gaSource = fs.readFileSync(path.join(root, gaRel), 'utf8');
    assert(
      gaSource.includes("import { GA_LIST, GA_MAP } from '../_lib/ga-companies.js';"),
      'GA route should import GA_LIST for cross links',
    );
    assert(
      gaSource.includes("import { pickRelatedPosts, relatedHtml, crossLinkHtml } from '../_lib/seo-links.js';"),
      'GA route should import shared SEO link helpers',
    );
    assert(!gaSource.includes('const related = ['), 'GA route should remove the hardcoded related array');
    assert(!gaSource.includes('/insurance/practice/fp-income-structure'), 'GA route should remove the redirecting legacy link');

    const gaList = [
      { slug: 'ga-korea', name: '지에이코리아', site: 'gakorea.example', erp: 'https://erp.example' },
      { slug: 'goodrich', name: '굿리치' },
      { slug: 'prime-asset', name: '프라임에셋' },
      { slug: 'mega', name: '메가' },
      { slug: 'ifa', name: 'IFA' },
      { slug: 'metarich', name: '메타리치' },
      { slug: 'peoplelife', name: '한화피플라이프' },
    ];
    const pickCalls = [];
    const relatedCalls = [];
    const crossCalls = [];
    const { mod: gaRoute } = loadRoute(gaRel, {
      GA_LIST: gaList,
      GA_MAP: { 'ga-korea': gaList[0] },
      seoCtaFooter: () => '<footer></footer>',
      seoShareBar: () => '<div data-share></div>',
      seoPostingWidget: async () => '<aside data-widget></aside>',
      pickRelatedPosts: async (...args) => {
        pickCalls.push(args);
        return [{ category: 'practice', slug: 'dynamic-ga-post', title: '동적 GA 관련글' }];
      },
      relatedHtml: (...args) => {
        relatedCalls.push(args);
        return '<section data-related></section>';
      },
      crossLinkHtml: (...args) => {
        crossCalls.push(args);
        return '<section data-cross></section>';
      },
    });
    const env = { DB: makeRouteDb() };
    const html = await (await gaRoute.onRequestGet({ params: { slug: 'ga-korea' }, env })).text();

    assert.strictEqual(pickCalls.length, 1, 'GA route should pick related posts once');
    assert.strictEqual(pickCalls[0][0], env.DB, 'GA related query should use the route DB binding');
    assert.strictEqual(pickCalls[0][1], 'ga-korea', 'GA slug should seed related selection');
    assert.deepStrictEqual(
      plain(pickCalls[0][2]),
      ['practice', 'recruit-tips', 'underwrite'],
      'GA route should use the three requested categories',
    );
    assert.deepStrictEqual(
      plain(relatedCalls[0]),
      [[{ category: 'practice', slug: 'dynamic-ga-post', title: '동적 GA 관련글' }], '설계사라면 함께 보면 좋은 정보'],
      'GA route should render the selected related posts',
    );
    assert.deepStrictEqual(plain(crossCalls[0][0]), plain(gaList), 'GA cross links should receive GA_LIST');
    assert.deepStrictEqual(
      plain(crossCalls[0].slice(1)),
      ['ga-korea', '다른 GA 전산 바로가기', '/ga/', ' 전산 바로가기'],
      'GA cross-link arguments should use the current slug and GA base',
    );
    assert(html.includes('<section data-related></section><section data-cross></section>'), 'GA HTML should render related and cross-link sections together');
  }

  console.log('seo internal link tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
