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
  const script = `${source}\nthis.__exports = { ensureBoostCols, seoPostingWidget };`;
  const sandbox = {
    Request,
    Response,
    console,
    getPromoRemaining: async () => ({ enabled: true, remaining: 9, limit: 30 }),
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

function makeEnv({ rowsByTable = {}, failPrepare = false } = {}) {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        if (failPrepare) throw new Error('db unavailable');
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
  const { mod, sandbox } = loadPostingWidget();

  {
    const { env, calls } = makeEnv();
    await mod.ensureBoostCols(env);
    for (const table of ['ic_recruitments', 'ic_lectures', 'ic_meetings']) {
      assert(
        calls.some((c) => c.sql === `ALTER TABLE ${table} ADD COLUMN seo_boost_until TEXT`),
        `${table} should get additive seo_boost_until column`,
      );
    }
  }

  {
    const future = new Date(Date.now() + 86400000).toISOString();
    const later = new Date(Date.now() + 2 * 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    const { env, calls } = makeEnv({
      rowsByTable: {
        recruit: [
          { id: 11, title: '<script>alert(1)</script>', sub: 'A&B', created_at: '2026-07-01T00:00:00Z', seo_boost_until: later },
          { id: 12, title: '일반 채용', sub: '보험 GA', created_at: '2026-07-02T00:00:00Z', seo_boost_until: past },
        ],
        lecture: [
          { id: 21, title: '부스트 강의', sub: '강사', created_at: '2026-07-03T00:00:00Z', seo_boost_until: future },
        ],
        meetup: [
          { id: 31, title: '모임', sub: '주최자', created_at: '2026-07-04T00:00:00Z', seo_boost_until: null },
        ],
      },
    });
    const html = await mod.seoPostingWidget(env);

    assert(html.includes('지금 올라온 공고'), 'widget should render header');
    assert(html.includes('/og/recruit/11'), 'recruit detail link should use existing SSR route');
    assert(html.includes('/og/lecture/21'), 'lecture detail link should use existing SSR route');
    assert(html.includes('/?post=recruit'), 'widget CTA should open anonymous posting flow');
    assert(html.includes('등록비 0원 (선착순 9건 남음)'), 'widget CTA should reflect launch promo remaining');
    assert(html.includes('PICK'), 'boosted postings should show PICK badge');
    assert(!html.includes('<script>alert(1)</script>'), 'posting titles should be escaped');
    assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped title should remain visible as text');
    assert(html.includes("company_type:'seo_widget_click'"), 'link-click payload should use existing company_type field');
    assert(html.includes("company_name:'seo_widget_recruit_11'"), 'link-click company_name should avoid owner notify regex');

    const selectCalls = calls.filter((c) => /SELECT id, title,/.test(c.sql));
    assert.strictEqual(selectCalls.length, 3, 'widget should query three posting tables on cache miss');

    const html2 = await mod.seoPostingWidget(env);
    assert.strictEqual(html2, html, 'cache hit should return same HTML within s-maxage window');
    assert.strictEqual(
      calls.filter((c) => /SELECT id, title,/.test(c.sql)).length,
      3,
      'cache hit should avoid additional D1 SELECTs',
    );
    assert.strictEqual(sandbox.caches.default.putCalls, 1, 'cache miss should populate caches.default once');
  }

  {
    const { mod: mod2 } = loadPostingWidget();
    const { env } = makeEnv({ rowsByTable: {} });
    const html = await mod2.seoPostingWidget(env);
    assert(html.includes('지금 올라온 공고'), 'empty widget should still render compact card');
    assert(html.includes('내 공고도 여기에 노출'), 'empty widget should still show registration loop CTA');
  }

  {
    const { mod: mod3 } = loadPostingWidget();
    const { env } = makeEnv({ failPrepare: true });
    const html = await mod3.seoPostingWidget(env);
    assert.strictEqual(html, '', 'DB failures should never block SSR page rendering');
  }

  for (const [file, importPath] of [
    ['functions/company/[slug].js', '../_lib/posting-widget.js'],
    ['functions/company/index.js', '../_lib/posting-widget.js'],
    ['functions/insurance/index.js', '../_lib/posting-widget.js'],
    ['functions/insurance/[category]/index.js', '../../_lib/posting-widget.js'],
    ['functions/insurance/[category]/[slug].js', '../../_lib/posting-widget.js'],
    ['functions/ga/[slug].js', '../_lib/posting-widget.js'],
    ['functions/ga/index.js', '../_lib/posting-widget.js'],
    ['functions/newsletter/index.js', '../_lib/posting-widget.js'],
    ['functions/board/index.js', '../_lib/posting-widget.js'],
    ['functions/board/[id].js', '../_lib/posting-widget.js'],
    ['functions/community/index.js', '../_lib/posting-widget.js'],
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    assert(source.includes(`import { seoPostingWidget } from '${importPath}';`), `${file} should import seoPostingWidget`);
    assert(source.includes('const postingWidget = await seoPostingWidget(env);'), `${file} should build widget inside handler`);
    if (file === 'functions/company/[slug].js') {
      const bodyStart = source.indexOf('const bodyHtml =');
      const renderStart = source.indexOf('const html = renderPage', bodyStart);
      assert(bodyStart >= 0 && renderStart > bodyStart, `${file} should assemble bodyHtml before renderPage`);
      const bodySource = source.slice(bodyStart, renderStart);
      assert(bodySource.includes('${postingWidget}'), `${file} should include the widget in bodyHtml`);
      assert(source.includes('bodyHtml,'), `${file} should pass bodyHtml to renderPage`);
    } else {
      assert(source.includes('${postingWidget}\n${seoCtaFooter(SITE)}'), `${file} should render widget immediately before SEO CTA footer`);
    }
  }

  {
    const shell = fs.readFileSync(path.join(root, 'functions/_lib/ssr-shell.js'), 'utf8').replace(/\r\n/g, '\n');
    const bodyIndex = shell.indexOf('${bodyHtml}');
    const footerIndex = shell.indexOf('${seoCtaFooter(site)}');
    assert(bodyIndex >= 0, 'SSR shell should render bodyHtml');
    assert(footerIndex > bodyIndex, 'SSR shell should render SEO CTA footer after bodyHtml');
  }

  {
    const source = fs.readFileSync(path.join(root, 'functions/_lib/company-aggregation.js'), 'utf8');
    assert(
      source.includes('posting-widget') || source.includes('seoPostingWidget'),
      'company aggregation should document why posting widget is intentionally out of scope',
    );
  }

  console.log('seo posting widget tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
