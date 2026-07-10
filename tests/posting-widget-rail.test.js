const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadPostingWidget() {
  const source = fs
    .readFileSync(path.join(root, 'functions/_lib/posting-widget.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/\bexport\s+/g, '');
  const script = `${source}\nthis.__exports = { seoPostingWidget, collectPostings };`;
  const sandbox = {
    Request,
    Response,
    console,
    getPromoRemaining: async () => ({ enabled: true, remaining: 7, limit: 30 }),
    Math,
    Date,
    caches: {
      default: {
        store: new Map(),
        matchCalls: 0,
        putCalls: 0,
        async match(req) {
          this.matchCalls += 1;
          return this.store.get(req.url) || null;
        },
        async put(req, res) {
          this.putCalls += 1;
          this.store.set(req.url, res.clone());
        },
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: 'posting-widget.js' });
  return { mod: sandbox.__exports, sandbox };
}

function makeEnv(rowsByTable = {}) {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        const rec = {
          sql,
          run() {
            return Promise.resolve({ ok: true });
          },
          all() {
            if (/FROM ic_recruitments/.test(sql)) return Promise.resolve({ results: rowsByTable.recruit || [] });
            if (/FROM ic_lectures/.test(sql)) return Promise.resolve({ results: rowsByTable.lecture || [] });
            if (/FROM ic_meetings/.test(sql)) return Promise.resolve({ results: rowsByTable.meetup || [] });
            return Promise.resolve({ results: [] });
          },
        };
        calls.push(rec);
        return rec;
      },
    },
  };
  return { env, calls };
}

module.exports = (async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const later = new Date(Date.now() + 2 * 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const rowsByTable = {
    recruit: [
      { id: 11, title: '<script>alert(1)</script>', sub: 'A&B', created_at: '2026-07-01T00:00:00Z', seo_boost_until: later },
      { id: 12, title: 'General recruit', sub: 'GA', created_at: '2026-07-02T00:00:00Z', seo_boost_until: past },
    ],
    lecture: [
      { id: 21, title: 'Boost lecture', sub: 'Teacher', created_at: '2026-07-03T00:00:00Z', seo_boost_until: future },
    ],
    meetup: [
      { id: 31, title: 'Meetup', sub: 'Host', created_at: '2026-07-04T00:00:00Z', seo_boost_until: null },
    ],
  };

  {
    const { mod, sandbox } = loadPostingWidget();
    const { env, calls } = makeEnv(rowsByTable);
    const html = await mod.seoPostingWidget(env);

    assert(html.includes('__cache/posting-widget-v3'), 'widget cache-busting marker should use cache key v3');
    assert([...sandbox.caches.default.store.keys()].some((key) => key.includes('posting-widget-v3')), 'cache put should use posting-widget-v3 key');
    assert.strictEqual(calls.filter((c) => /SELECT id, title,/.test(c.sql)).length, 3, 'cache miss should query all posting tables once');
    await mod.seoPostingWidget(env);
    assert.strictEqual(calls.filter((c) => /SELECT id, title,/.test(c.sql)).length, 3, 'cache hit should avoid additional D1 SELECTs');

    assert(html.includes('class="spw-rail"'), 'desktop rail should render beside the existing bottom widget');
    assert(html.includes('position:fixed'), 'rail should be fixed-positioned');
    assert(html.includes('right:20px'), 'rail should sit in the right margin');
    assert(html.includes('top:120px'), 'rail should use the requested top offset');
    assert(html.includes('width:230px'), 'rail should use the requested width');
    assert(html.includes('box-sizing:border-box'), 'rail should be self-contained when pages lack a global box-sizing reset');
    assert(html.includes('max-height:calc(100vh - 140px)'), 'rail should guard short viewports with a max height');
    assert(html.includes('overflow-y:auto'), 'rail should scroll internally in short viewports');
    assert(html.includes('.spw-rail-list{display:grid;gap:8px;grid-template-columns:minmax(0,1fr)}'), 'rail list grid should allow narrow tracks to shrink');
    assert(html.includes('.spw-rail-item{min-width:0;max-width:100%;box-sizing:border-box;'), 'rail items should not overflow the 230px rail');
    assert(html.includes('@media(max-width:1279px)'), 'rail should be hidden at 1279px and below');
    assert(html.includes("sessionStorage.getItem('spw_rail_hide')"), 'rail should honor session hide state');
    assert(html.includes("sessionStorage.setItem('spw_rail_hide','1')"), 'rail close button should hide for the current session');
    assert(html.includes('공고 미리보기'), 'rail should render its preview header');
    assert(html.includes('등록비 0원 · 선착순 7건'), 'rail CTA should use compact launch promo copy');
    assert(html.includes("company_name:'seo_rail_recruit_11'"), 'rail clicks should use seo_rail company_name prefix');
    assert(html.includes("company_name:'seo_widget_recruit_11'"), 'bottom widget clicks should keep seo_widget company_name prefix');
    assert(!html.includes('<script>alert(1)</script>'), 'rail titles should be escaped');
    assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped rail title should remain visible as text');
    const railItems = html.match(/class="spw-rail-item"/g) || [];
    assert.strictEqual(railItems.length, 2, 'rail should show exactly two posting cards');
  }

  {
    const { mod } = loadPostingWidget();
    const { env } = makeEnv({});
    const html = await mod.seoPostingWidget(env);
    assert(!html.includes('class="spw-rail"'), 'rail should not render when there are no postings');
    assert(html.includes('seo-posting-widget'), 'bottom widget should still render its registration CTA when empty');
  }

  console.log('posting widget rail tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
