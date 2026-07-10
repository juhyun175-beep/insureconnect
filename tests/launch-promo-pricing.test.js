const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadModule(rel, names) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const script = source.replace(/\bexport\s+/g, '') + `\nthis.__exports = { ${names.join(', ')} };`;
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox.__exports;
}

function makeD1Env({ promoUsed = 0, failPromoCount = false } = {}) {
  const calls = [];
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
            if (/COUNT\(\*\) AS used FROM ad_orders WHERE promo_code = \?/.test(sql)) {
              if (failPromoCount) return Promise.reject(new Error('count failed'));
              return Promise.resolve({ used: promoUsed });
            }
            if (/INSERT INTO ad_orders/.test(sql)) return Promise.resolve({ id: 777 });
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

module.exports = (async () => {
  const promo = loadModule('functions/_lib/promo.js', ['LAUNCH_PROMO', 'ensurePromoCol', 'getPromoRemaining']);
  assert.deepStrictEqual(
    { ...promo.LAUNCH_PROMO },
    {
      enabled: true,
      code: 'launch30',
      limit: 100,
      label: '런치 프로모 — 선착순 100건 등록비 0원',
    },
    'launch promo constants should be fixed server-side',
  );

  {
    const { env, calls } = makeD1Env({ promoUsed: 12 });
    await promo.ensurePromoCol(env);
    assert(
      calls.some((c) => /ALTER TABLE ad_orders ADD COLUMN promo_code TEXT/.test(c.sql)),
      'ensurePromoCol should add ad_orders.promo_code with additive ALTER',
    );

    const remaining = await promo.getPromoRemaining(env);
    assert.deepStrictEqual({ ...remaining }, { enabled: true, remaining: 88, limit: 100 });
    const count = calls.find((c) => /COUNT\(\*\) AS used FROM ad_orders WHERE promo_code = \?/.test(c.sql));
    assert(count, 'getPromoRemaining should count used promo orders');
    assert.deepStrictEqual(count.values, ['launch30'], 'promo count should bind the launch code');
  }

  {
    const { env } = makeD1Env({ failPromoCount: true });
    const remaining = await promo.getPromoRemaining(env);
    assert.deepStrictEqual(
      { ...remaining },
      { enabled: true, remaining: 0, limit: 100 },
      'promo count failures should safely disable application',
    );
  }

  {
    const orders = loadModule('functions/_lib/orders.js', ['ensureOrderTables', 'createAdOrder']);
    const { env, calls } = makeD1Env();
    const id = await orders.createAdOrder(env, {
      ad_type: 'recruit',
      ad_id: 123,
      member_id: 45,
      submitter_name: 'Tester',
      submitter_contact: '010-0000-0000',
      base_price: 20000,
      coupon_id: null,
      coupon_rate: 0,
      final_price: 0,
      options_json: null,
      options_price: 0,
      promo_code: 'launch30',
      consent_refund: true,
      consent_points: true,
      consent_fail: true,
    });

    assert.strictEqual(id, 777);
    assert(
      calls.some((c) => /ALTER TABLE ad_orders ADD COLUMN promo_code TEXT/.test(c.sql)),
      'createAdOrder should lazily ensure promo_code',
    );
    const insert = calls.find((c) => /INSERT INTO ad_orders/.test(c.sql));
    assert(insert, 'createAdOrder should insert an ad_orders row');
    assert(insert.sql.includes('promo_code'), 'ad_orders insert should include promo_code');
    assert(insert.values.includes('launch30'), 'ad_orders insert should bind promo_code');
  }

  for (const [file, table] of [
    ['functions/api/recruitments/index.js', 'ic_recruitments'],
    ['functions/api/lectures/index.js', 'ic_lectures'],
    ['functions/api/meetings/index.js', 'ic_meetings'],
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert(source.includes("import { LAUNCH_PROMO, getPromoRemaining } from '../../_lib/promo.js';"), `${file} should import promo helpers`);
    assert(source.includes('const promo = await getPromoRemaining(env);'), `${file} should check promo before coupon validation`);
    assert(source.includes('const promoApplied = promo.enabled && promo.remaining > 0;'), `${file} should apply only while remaining`);
    assert(source.includes('const basePrice = promoApplied ? 0 : finalPrice('), `${file} should zero only the base price`);
    assert(source.includes(`UPDATE ${table} SET price=?, coupon_id=?, coupon_rate=? WHERE id=?`), `${file} should persist base price on posting`);
    assert(source.includes('promo_code: promoApplied ? LAUNCH_PROMO.code : null'), `${file} should record promo orders`);
    assert(source.includes('promo: { applied: promoApplied'), `${file} should return promo priceInfo`);
  }

  {
    const source = fs.readFileSync(path.join(root, 'functions/api/promo/status.js'), 'utf8');
    assert(source.includes("import { json, handle } from '../../_lib/http.js';"));
    assert(source.includes('getPromoRemaining(env)'));
    assert(source.includes("'Cache-Control': 'max-age=30'"));
  }

  {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const marker of [
      '/api/promo/status',
      'window.SM_PROMO',
      'id="sm-promo-row"',
      'id="sm-promo-left"',
      'sm-promo-free',
      '입금 없이 접수 완료',
    ]) {
      assert(html.includes(marker), `posting modal should include launch promo marker: ${marker}`);
    }
  }

  console.log('launch promo pricing tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
