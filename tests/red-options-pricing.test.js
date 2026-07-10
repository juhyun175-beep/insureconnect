const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

const plain = (value) => JSON.parse(JSON.stringify(value));

function loadModule(rel, names) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const script = source.replace(/\bexport\s+/g, '') + `\nthis.__exports = { ${names.join(', ')} };`;
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: rel });
  return sandbox.__exports;
}

module.exports = (async () => {
  const { OPTION_CATALOG, validateOptions } = loadModule('functions/_lib/options.js', ['OPTION_CATALOG', 'validateOptions']);

  assert.ok(OPTION_CATALOG.open_chat_post, 'open_chat_post should exist in the server option catalog');
  assert.ok(OPTION_CATALOG.seo_boost, 'seo_boost should exist in the server option catalog');
  assert.ok(OPTION_CATALOG.bundle_boost, 'bundle_boost should exist in the server option catalog');
  assert.strictEqual(OPTION_CATALOG.open_chat_post.price, 25000, 'open_chat_post should be a 25,000 won count-priced option');
  assert.strictEqual(OPTION_CATALOG.open_chat_post.pricing, 'count');
  assert.strictEqual(OPTION_CATALOG.open_chat_post.min_count, 1);
  assert.strictEqual(OPTION_CATALOG.open_chat_post.max_count, 3);
  assert.strictEqual(OPTION_CATALOG.seo_boost.price, 15000, 'seo_boost should be 15,000 won');
  assert.strictEqual(OPTION_CATALOG.bundle_boost.price, 59000, 'bundle_boost should be 59,000 won');
  assert.deepStrictEqual(
    plain(OPTION_CATALOG.bundle_boost.includes),
    [{ key: 'seo_boost' }, { key: 'open_chat_post', count: 2 }, { key: 'kakao_blast' }],
    'bundle_boost should declare the single-product bundle contents',
  );
  assert.match(
    OPTION_CATALOG.open_chat_promo.label,
    /풀데이 점유/,
    'open_chat_promo should be renamed to full-day occupancy while keeping the anchor price',
  );
  assert.strictEqual(OPTION_CATALOG.open_chat_promo.price, 280000);

  {
    const opt = validateOptions('recruit', [{ key: 'open_chat_post', count: 2, slot: 'pm9' }]);
    assert.strictEqual(opt.total, 50000, 'count pricing should multiply price by count');
    assert.deepStrictEqual(plain(opt.keys), [{ key: 'open_chat_post', count: 2, slot: 'pm9' }], 'valid slot should be preserved for fulfillment');
    assert.deepStrictEqual(plain(opt.optionKeys), ['open_chat_post']);
  }

  {
    const opt = validateOptions('lecture', [{ key: 'open_chat_post', count: 99, slot: 'noon' }]);
    assert.strictEqual(opt.total, 75000, 'count pricing should clamp to max_count');
    assert.deepStrictEqual(plain(opt.keys), [{ key: 'open_chat_post', count: 3, slot: 'noon' }]);
  }

  {
    const opt = validateOptions('meetup', [{ key: 'open_chat_post', count: -20, slot: 'am8' }]);
    assert.strictEqual(opt.total, 25000, 'count pricing should clamp to min_count');
    assert.deepStrictEqual(plain(opt.keys), [{ key: 'open_chat_post', count: 1, slot: 'am8' }]);
  }

  {
    const opt = validateOptions('recruit', [{ key: 'open_chat_post', count: 2, slot: 'hacked' }]);
    assert.strictEqual(opt.total, 50000, 'invalid slot should not invalidate the option');
    assert.deepStrictEqual(plain(opt.keys), [{ key: 'open_chat_post', count: 2 }], 'invalid slot should be removed from options_json payload');
  }

  {
    const opt = validateOptions('recruit', ['bundle_boost']);
    assert.strictEqual(opt.total, 59000, 'bundle_boost alone should charge the bundle price');
    assert.deepStrictEqual(plain(opt.keys), ['bundle_boost']);
    assert.deepStrictEqual(plain(opt.optionKeys), ['bundle_boost']);
  }

  {
    const opt = validateOptions('recruit', ['bundle_boost', 'seo_boost', 'kakao_blast', { key: 'open_chat_post', count: 3, slot: 'pm9' }]);
    assert.strictEqual(opt.total, 59000, 'bundle_boost should dedupe included single options');
    assert.deepStrictEqual(plain(opt.keys), ['bundle_boost']);
    assert.deepStrictEqual(plain(opt.optionKeys), ['bundle_boost']);
  }

  {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const marker of [
      'open_chat_post: { price: 25000, pricing: \'count\', min: 1, max: 3 }',
      'seo_boost: { price: 15000 }',
      'bundle_boost: { price: 59000',
      'id="sm-opt-open_chat_post"',
      'id="sm-opt-open_chat_post-count"',
      'name="sm-opt-open_chat_post-slot"',
      'id="sm-opt-seo_boost"',
      'id="sm-opt-bundle_boost"',
      '단품 합산 94,000원',
      '풀데이 점유',
      'smSyncBundleBoost',
    ]) {
      assert(html.includes(marker), `submit modal should include red-price option UI marker: ${marker}`);
    }
    assert(html.includes("options.push({ key: 'open_chat_post', count: count, slot: slot });"), 'client payload should preserve open_chat_post count and slot');
    assert(html.includes('meta.pricing === \'count\''), 'client display price should handle count-priced options');
  }

  {
    const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
    assert(admin.includes("seo_boost:'SEO고정7일'"), 'admin refund/order labels should include seo_boost');
    assert(admin.includes("open_chat_post:'오픈챗 게시'"), 'admin refund/order labels should include open_chat_post');
    assert(admin.includes("bundle_boost:'부스트패키지'"), 'admin refund/order labels should include bundle_boost');
    assert(admin.includes("open_chat_promo:'오픈채팅 풀데이 점유'"), 'admin refund/order label should use renamed full-day option');
    assert(admin.includes("_RF_SLOT={am8:'오전8시',noon:'점심12:30',pm9:'저녁9시'}"), 'admin should render open_chat_post slot labels');
  }

  console.log('red options pricing tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
