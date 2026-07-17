const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadCouponsModule() {
  const source = fs.readFileSync(path.join(root, 'functions/_lib/coupons.js'), 'utf8');
  const script = source.replace(/\bexport\s+/g, '') + `
this.__exports = {
  AD_BASE,
  INQUIRY_OPTION_PRICE,
  MAIN_FEATURED_OPTION_PRICE,
  KAKAO_BLAST_OPTION_PRICE,
  HOME_BANNER7_OPTION_PRICE,
  finalPrice,
  finalPriceWithOptions,
  paidOptionEnabled,
};`;
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox.__exports;
}

function loadOrdersModule() {
  const source = fs.readFileSync(path.join(root, 'functions/_lib/orders.js'), 'utf8');
  const script = source.replace(/\bexport\s+/g, '') + `
this.__exports = { ensureOrderTables, createAdOrder };`;
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox.__exports;
}

function makeD1Env() {
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
            return Promise.resolve({ id: 777 });
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

{
  const coupons = loadCouponsModule();
  assert.deepStrictEqual(
    { ...coupons.AD_BASE },
    { recruit: 20000, lecture: 20000, meetup: 20000 },
    'all posting base prices should be 20,000 KRW',
  );
  assert.strictEqual(coupons.finalPrice('recruit', 10), 18000, 'discount applies only to base price');
  assert.strictEqual(coupons.INQUIRY_OPTION_PRICE, 20000);
  assert.strictEqual(coupons.MAIN_FEATURED_OPTION_PRICE, 20000);
  assert.strictEqual(coupons.KAKAO_BLAST_OPTION_PRICE, 29000);
  assert.strictEqual(coupons.HOME_BANNER7_OPTION_PRICE, 300000);
  assert.strictEqual(coupons.paidOptionEnabled(true), 1);
  assert.strictEqual(coupons.paidOptionEnabled(1), 1);
  assert.strictEqual(coupons.paidOptionEnabled('1'), 1);
  assert.strictEqual(coupons.paidOptionEnabled(false), 0);
  assert.strictEqual(coupons.paidOptionEnabled('0'), 0);
  assert.strictEqual(coupons.paidOptionEnabled('true'), 0);

  const price = coupons.finalPriceWithOptions('recruit', 10, {
    inquiry_enabled: true,
    main_featured_enabled: '1',
    kakao_blast_enabled: 1,
    home_banner7_enabled: true,
  });
  assert.deepStrictEqual({ ...price }, {
    base_price: 20000,
    coupon_rate: 10,
    base_final_price: 18000,
    inquiry_enabled: 1,
    inquiry_price: 20000,
    main_featured_enabled: 1,
    main_featured_price: 20000,
    kakao_blast_enabled: 1,
    kakao_blast_price: 29000,
    home_banner7_enabled: 1,
    home_banner7_price: 300000,
    total_price: 387000,
  });
}

(async () => {
  const { createAdOrder } = loadOrdersModule();
  const { env, calls } = makeD1Env();
  const id = await createAdOrder(env, {
    ad_type: 'recruit',
    ad_id: 123,
    member_id: 45,
    submitter_name: 'Tester',
    submitter_contact: '010-0000-0000',
    base_price: 20000,
    coupon_id: 9,
    coupon_rate: 10,
    final_price: 18000,
    inquiry_enabled: 1,
    inquiry_price: 20000,
    main_featured_enabled: 1,
    main_featured_price: 20000,
    kakao_blast_enabled: 1,
    kakao_blast_price: 29000,
    home_banner7_enabled: 1,
    home_banner7_price: 300000,
    total_price: 387000,
    consent_refund: true,
    consent_points: true,
    consent_fail: true,
  });

  assert.strictEqual(id, 777);
  const insert = calls.find((c) => /INSERT INTO ad_orders/.test(c.sql));
  assert(insert, 'createAdOrder should insert an ad_orders row');
  for (const column of [
    'inquiry_enabled',
    'inquiry_price',
    'main_featured_enabled',
    'main_featured_price',
    'kakao_blast_enabled',
    'kakao_blast_price',
    'home_banner7_enabled',
    'home_banner7_price',
    'total_price',
  ]) {
    assert(insert.sql.includes(column), `INSERT should include ${column}`);
  }
  assert.deepStrictEqual(
    insert.values.slice(9, 18),
    [1, 20000, 1, 20000, 1, 29000, 1, 300000, 387000],
    'option fields should be bound before consent fields',
  );

  console.log('ad option pricing tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

for (const marker of [
  'id="sm-option-inquiry"',
  'id="sm-option-main-featured"',
  'id="sm-option-kakao-blast"',
  'id="sm-option-home-banner7"',
  'const SM_KAKAO_BLAST_OPTION_PRICE = 29000',
  'const SM_MAIN_FEATURED_OPTION_PRICE = 20000',
  'const SM_HOME_BANNER7_OPTION_PRICE = 300000',
  'payload.kakao_blast_enabled',
  'payload.home_banner7_enabled',
]) {
  assert(indexHtml.includes(marker), `posting modal should include 4-option marker: ${marker}`);
}

for (const phrase of [
  '운영자가 발송 전 도달 수를 확인합니다',
  '운영자가 클릭 리포트를 확인합니다',
  '노출/클릭 리포트를 확인합니다',
]) {
  assert(!indexHtml.includes(phrase), `posting option copy should avoid operator liability language: ${phrase}`);
}

assert(!indexHtml.includes('/api/payments/ad-checkout'), 'posting modal should not activate ad Toss checkout');
assert(
  !fs.existsSync(path.join(root, 'functions/api/payments/ad-checkout.js')),
  'ad Toss checkout API should not be restored while Toss remains infrastructure-only',
);

for (const file of [
  'functions/api/recruitments/[id].js',
  'functions/api/lectures/[id].js',
  'functions/api/meetings/[id].js',
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert(
    source.includes("status='pending_payment'"),
    `${file} should only publish pending manual-payment orders`,
  );
  assert(
    !source.includes("status <> 'refunded'"),
    `${file} should not overwrite paid/refunded order states on approval`,
  );
}
