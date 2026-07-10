const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function importFresh(rel) {
  return import(pathToFileURL(path.join(root, rel)).href + `?t=${Date.now()}${Math.random()}`);
}

function makePatchEnv({ table, curStatus = 'pending' } = {}) {
  const calls = [];
  const env = {
    ADMIN_SECRET: 'secret',
    INDEXNOW_KEY: 'test-indexnow-key',
    DB: {
      prepare(sql) {
        const rec = {
          sql,
          values: [],
          bind(...values) {
            rec.values = values;
            return rec;
          },
          run() {
            return Promise.resolve({ meta: { changes: 1 } });
          },
          first() {
            if (sql === `SELECT status, featured_until FROM ${table} WHERE id = ?`) {
              return Promise.resolve({ status: curStatus, featured_until: '2026-07-20 00:00:00' });
            }
            if (/SELECT id, options_json, fulfilled_json, status FROM ad_orders/.test(sql)) {
              return Promise.resolve(null);
            }
            return Promise.resolve(null);
          },
          all() {
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

async function patchApproved({ rel, table, id, curStatus }) {
  const mod = await importFresh(rel);
  const { env, calls } = makePatchEnv({ table, curStatus });
  const waited = [];
  const fetches = [];
  const oldFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    fetches.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
    return new Response('', { status: 202 });
  };
  try {
    const request = new Request(`https://insureconnect.co.kr/api/test/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
      body: JSON.stringify({ status: 'approved', reject_reason: null }),
    });
    const res = await mod.onRequestPatch({
      params: { id: String(id) },
      request,
      env,
      waitUntil(promise) {
        waited.push(promise);
      },
    });
    const json = await res.json();
    await Promise.all(waited);
    return { res, json, calls, waited, fetches };
  } finally {
    global.fetch = oldFetch;
  }
}

function makeSeoEnv() {
  const calls = [];
  const env = {
    ADMIN_SECRET: 'secret',
    DB: {
      prepare(sql) {
        const rec = {
          sql,
          values: [],
          bind(...values) {
            rec.values = values;
            return rec;
          },
          all() {
            if (/GROUP BY company_name/.test(sql)) {
              return Promise.resolve({
                results: [
                  { company_name: 'seo_widget_recruit_11', clicks: 5 },
                  { company_name: 'seo_rail_recruit_11', clicks: 3 },
                  { company_name: 'seo_widget_lecture_22', clicks: 4 },
                  { company_name: 'not_parseable', clicks: 99 },
                ],
              });
            }
            if (/FROM ic_recruitments/.test(sql)) {
              return Promise.resolve({ results: [{ id: 11, title: '<b>Recruit</b>', seo_boost_until: '2099-01-01T00:00:00Z' }] });
            }
            if (/FROM ic_lectures/.test(sql)) {
              return Promise.resolve({ results: [{ id: 22, title: 'Lecture title', seo_boost_until: null }] });
            }
            if (/FROM ic_meetings/.test(sql)) {
              return Promise.resolve({ results: [] });
            }
            if (/GROUP BY date/.test(sql)) {
              return Promise.resolve({
                results: [
                  { date: '2026-07-09', company_name: 'seo_widget_recruit_11', clicks: 2 },
                  { date: '2026-07-09', company_name: 'seo_rail_recruit_11', clicks: 1 },
                ],
              });
            }
            return Promise.resolve({ results: [] });
          },
          first() {
            return Promise.resolve(null);
          },
          run() {
            return Promise.resolve({ meta: { changes: 1 } });
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
  {
    const promo = await importFresh('functions/_lib/promo.js');
    assert.strictEqual(promo.LAUNCH_PROMO.limit, 100, 'launch promo limit should be 100');
    assert.match(promo.LAUNCH_PROMO.label, /선착순 100건/);
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert(index.includes('런치 프로모 (선착순 100건)'), 'submit modal promo label should show 100 slots');
    assert(!index.includes('30' + '건'), 'repo UI should not retain old slot-count copy');
  }

  for (const cfg of [
    { rel: 'functions/api/recruitments/[id].js', table: 'ic_recruitments', id: 101, detail: '/og/recruit/101', hub: '/recruit' },
    { rel: 'functions/api/lectures/[id].js', table: 'ic_lectures', id: 202, detail: '/og/lecture/202', hub: '/lecture' },
    { rel: 'functions/api/meetings/[id].js', table: 'ic_meetings', id: 303, detail: '/og/meetup/303', hub: '/meeting' },
  ]) {
    const first = await patchApproved({ ...cfg, curStatus: 'pending' });
    assert.strictEqual(first.res.status, 200);
    assert.strictEqual(first.json.ok, true);
    assert.deepStrictEqual(first.json.indexnow, { submitted: true });
    assert.strictEqual(first.waited.length, 1, `${cfg.rel} should submit IndexNow in waitUntil on first approval`);
    assert.deepStrictEqual(first.fetches[0].body.urlList, [
      `https://insureconnect.co.kr${cfg.detail}`,
      `https://insureconnect.co.kr${cfg.hub}`,
    ]);

    const again = await patchApproved({ ...cfg, curStatus: 'approved' });
    assert.strictEqual(again.json.ok, true);
    assert.deepStrictEqual(again.json.indexnow, { submitted: false });
    assert.strictEqual(again.waited.length, 0, `${cfg.rel} should not resubmit IndexNow on reapproval`);
  }

  {
    assert(fs.existsSync(path.join(root, 'functions/api/admin/seo-clicks.js')), 'admin seo-clicks endpoint should exist');
    const mod = await importFresh('functions/api/admin/seo-clicks.js');
    const { env } = makeSeoEnv();
    const ok = await mod.onRequestGet({
      request: new Request('https://insureconnect.co.kr/api/admin/seo-clicks?days=14', {
        headers: { 'x-admin-secret': 'secret' },
      }),
      env,
    });
    assert.strictEqual(ok.status, 200);
    const json = await ok.json();
    assert.strictEqual(json.days, 14);
    assert.deepStrictEqual(json.totals, { widget: 9, rail: 3, all: 12 });
    assert.strictEqual(json.rows.length, 2, 'invalid company_name rows should be ignored');
    assert.deepStrictEqual(json.rows[0], {
      type: 'recruit',
      id: 11,
      title: '<b>Recruit</b>',
      widget_clicks: 5,
      rail_clicks: 3,
      total: 8,
      boosted: true,
    });

    const daily = await mod.onRequestGet({
      request: new Request('https://insureconnect.co.kr/api/admin/seo-clicks?days=7&type=recruit&id=11', {
        headers: { 'x-admin-secret': 'secret' },
      }),
      env,
    });
    const dailyJson = await daily.json();
    assert.deepStrictEqual(dailyJson.series, [{ date: '2026-07-09', widget: 2, rail: 1 }]);

    const denied = await mod.onRequestGet({
      request: new Request('https://insureconnect.co.kr/api/admin/seo-clicks?days=14'),
      env,
    });
    assert.strictEqual(denied.status, 401);
  }

  {
    const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
    assert(admin.includes('SEO 노출 클릭'), 'admin should render SEO click card title');
    assert(admin.includes('/api/admin/seo-clicks?days='), 'admin card should fetch seo-clicks endpoint with days');
    assert(admin.includes('seo-click-days'), 'admin card should expose a days selector');
    assert(admin.includes('아직 클릭 데이터가 없습니다 — 위젯/레일 배포 후 쌓입니다'), 'admin card should have the requested empty state');
  }

  console.log('promo, indexnow, seo click tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
