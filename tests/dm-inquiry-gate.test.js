const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function importFresh(rel) {
  return import(pathToFileURL(path.join(root, rel)).href + `?t=${Date.now()}${Math.random()}`);
}

function makeFulfillmentEnv({ order, adType = 'recruit', adRow = {} } = {}) {
  const calls = [];
  const tableByType = { recruit: 'ic_recruitments', lecture: 'ic_lectures', meetup: 'ic_meetings' };
  const table = tableByType[adType] || 'ic_recruitments';
  const env = {
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
            if (/SELECT id, options_json, fulfilled_json, status FROM ad_orders/.test(sql)) {
              return Promise.resolve(order || null);
            }
            if (sql === `SELECT * FROM ${table} WHERE id = ?`) {
              return Promise.resolve({ id: rec.values[0], title: 'DM test posting', ...adRow });
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
  return { env, calls, table };
}

async function fulfillDm({ adType = 'recruit', adRow = {} } = {}) {
  const mod = await importFresh('functions/_lib/fulfillment.js');
  const { env, calls, table } = makeFulfillmentEnv({
    adType,
    adRow,
    order: {
      id: 701,
      options_json: JSON.stringify(['dm_inquiry']),
      fulfilled_json: null,
      status: 'paid',
    },
  });
  const result = await mod.fulfillApprovedOptions(env, { adType, adId: 77 });
  const orderUpdate = calls.find((c) => /UPDATE ad_orders\s+SET status =/.test(c.sql));
  assert(orderUpdate, 'fulfillment should persist fulfilled_json');
  return { mod, result, fulfilled: JSON.parse(orderUpdate.values[0]), calls, table };
}

function makeRegistrationEnv() {
  const calls = [];
  let nextPostingId = 800;
  let nextOrderId = 1700;
  const env = {
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
            if (/INSERT INTO ic_(recruitments|lectures|meetings)/.test(sql)) {
              return Promise.resolve({ id: ++nextPostingId });
            }
            if (/COUNT\(\*\) AS used FROM ad_orders WHERE promo_code = \?/.test(sql)) {
              return Promise.resolve({ used: 100 });
            }
            if (/INSERT INTO ad_orders/.test(sql)) {
              return Promise.resolve({ id: ++nextOrderId });
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

async function postAnonymous(rel, body) {
  const mod = await importFresh(rel);
  const { env, calls } = makeRegistrationEnv();
  const request = new Request('https://insureconnect.co.kr/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Anonymous DM option test',
      description: 'Anonymous posting should not sell dm_inquiry',
      submitter_name: 'Anon',
      submitter_contact: '010-0000-0000',
      options: ['dm_inquiry', 'seo_boost'],
      ...body,
    }),
  });
  const res = await mod.onRequestPost({ request, env });
  const json = await res.json();
  const order = calls.find((c) => /INSERT INTO ad_orders/.test(c.sql));
  assert(order, `${rel} should create an order for anonymous submissions`);
  return { json, order, optionsJson: order.values[9] ? JSON.parse(order.values[9]) : [] };
}

module.exports = (async () => {
  {
    const mod = await importFresh('functions/_lib/fulfillment.js');
    assert.strictEqual(typeof mod.ensureDmCol, 'function', 'fulfillment should export ensureDmCol');
    const { env, calls } = makeFulfillmentEnv();
    await mod.ensureDmCol(env);
    for (const table of ['ic_recruitments', 'ic_lectures', 'ic_meetings']) {
      assert(
        calls.some((c) => c.sql === `ALTER TABLE ${table} ADD COLUMN dm_enabled INTEGER NOT NULL DEFAULT 0`),
        `${table} should get additive dm_enabled column`,
      );
    }
  }

  {
    const { fulfilled, calls, table } = await fulfillDm({ adRow: { submitter_id: 42 } });
    assert.strictEqual(fulfilled.dm_inquiry.status, 'auto_done');
    assert.strictEqual(fulfilled.dm_inquiry.mode, 'dm_enabled');
    assert.match(fulfilled.dm_inquiry.message, /1:1 문의 버튼을 활성화했습니다/);
    assert(
      calls.some((c) => c.sql === `UPDATE ${table} SET dm_enabled = 1 WHERE id = ?` && c.values[0] === 77),
      'dm_inquiry fulfillment should enable dm_enabled on the posting row',
    );
  }

  {
    const { fulfilled, calls, table } = await fulfillDm({ adRow: { submitter_id: null } });
    assert.strictEqual(fulfilled.dm_inquiry.status, 'auto_failed');
    assert.strictEqual(fulfilled.dm_inquiry.mode, 'dm_enabled');
    assert.match(fulfilled.dm_inquiry.message, /회원 계정이 연결되지 않아 1:1 문의를 활성화할 수 없습니다/);
    assert(!calls.some((c) => c.sql === `UPDATE ${table} SET dm_enabled = 1 WHERE id = ?`), 'anonymous postings should not enable DM');
  }

  for (const [rel, body] of [
    ['functions/api/recruitments/index.js', { company_name: 'Company' }],
    ['functions/api/lectures/index.js', { instructor: 'Instructor' }],
    ['functions/api/meetings/index.js', { host: 'Host' }],
  ]) {
    const { json, order, optionsJson } = await postAnonymous(rel, body);
    assert.deepStrictEqual(optionsJson, ['seo_boost'], `${rel} should strip dm_inquiry before validateOptions for anonymous users`);
    assert.strictEqual(order.values[10], 15000, `${rel} should not charge the 20000 dm_inquiry option`);
    assert.strictEqual(json.price.options_price, 15000);
  }

  {
    const dmSource = fs.readFileSync(path.join(root, 'functions/api/chat/dm.js'), 'utf8');
    assert(dmSource.includes("import { ensureDmCol } from '../../_lib/fulfillment.js';"), 'DM API should ensure dm_enabled column');
    assert(dmSource.includes('SELECT submitter_id, title, dm_enabled FROM'), 'DM API should read dm_enabled from posting tables');
    assert(dmSource.includes("Number(post.dm_enabled) !== 1"), 'DM API should gate both GET and POST by dm_enabled');
    assert(!dmSource.includes('inquiry_enabled'), 'DM gate should not use the obsolete inquiry_enabled column');

    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert(index.includes('로그인 등록 시에만 제공 — 문의 수신에 회원 계정이 필요합니다'), 'anonymous modal should explain dm_inquiry login requirement');
    assert(/it\.dm_enabled\s*==\s*1[\s\S]{0,240}dm-viewer-btn/.test(index), 'recruit/lecture viewer buttons should render only when dm_enabled is 1');
    assert(index.includes("var dmBtn=d.dm_enabled==1?'<button class=\"dm-viewer-btn\""), 'meetup viewer button should render only when dm_enabled is 1');

    for (const rel of [
      'functions/api/recruitments/[id].js',
      'functions/api/lectures/[id].js',
      'functions/api/meetings/[id].js',
    ]) {
      const source = fs.readFileSync(path.join(root, rel), 'utf8');
      assert(source.includes("'dm_enabled'"), `${rel} should allow admin dm_enabled manual toggles`);
    }
  }

  console.log('dm inquiry gate tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
