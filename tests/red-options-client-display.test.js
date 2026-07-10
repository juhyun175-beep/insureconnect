const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const plain = (value) => JSON.parse(JSON.stringify(value));

function makeElement(initial = {}) {
  return {
    checked: false,
    disabled: false,
    value: '',
    textContent: '',
    innerHTML: '',
    selectedOptions: [],
    dataset: {},
    style: {},
    classList: { toggle() {} },
    getAttribute(name) {
      return this[name] || '';
    },
    ...initial,
  };
}

function loadClientPricing() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const start = html.indexOf('const SM_BASE =');
  const end = html.indexOf('function closeSubmitModal()', start);
  assert(start > 0 && end > start, 'should find submit-modal pricing script block');
  const block = html.slice(start, end);

  const elements = new Map();
  const ids = [
    'sm-coupon-sel',
    'sm-base-price',
    'sm-promo-row',
    'sm-promo-left',
    'sm-coupon-row',
    'sm-discount-row',
    'sm-discount-amt',
    'sm-options-row',
    'sm-options-amt',
    'sm-final-price',
    'sm-opt-featured_listing',
    'sm-opt-dm_inquiry',
    'sm-opt-kakao_blast',
    'sm-opt-open_chat_post',
    'sm-opt-seo_boost',
    'sm-opt-bundle_boost',
    'sm-opt-open_chat_promo',
    'sm-opt-home_banner7',
  ];
  ids.forEach((id) => elements.set(id, makeElement({ id })));
  elements.set('sm-opt-open_chat_post-count', makeElement({ id: 'sm-opt-open_chat_post-count', value: '1', disabled: true }));
  elements.set('sm-opt-open_chat_post-bundle-hint', makeElement({ id: 'sm-opt-open_chat_post-bundle-hint', style: { display: 'none' } }));
  elements.set('sm-opt-open_chat_promo-days', makeElement({ id: 'sm-opt-open_chat_promo-days', value: '1', disabled: true }));

  const radios = [
    makeElement({ value: 'am8', checked: false, disabled: true }),
    makeElement({ value: 'noon', checked: true, disabled: true }),
    makeElement({ value: 'pm9', checked: false, disabled: true }),
  ];
  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="sm-opt-open_chat_post-slot"]') return radios;
      return [];
    },
    querySelector(selector) {
      if (selector === 'input[name="sm-opt-open_chat_post-slot"]:checked') {
        return radios.find((r) => r.checked) || null;
      }
      return null;
    },
  };
  const sandbox = {
    console,
    document,
    window: { SM_PROMO: { remaining: 0 } },
    submitState: { mode: 'recruit' },
    fetch: async () => ({ ok: false }),
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(`${block}\nthis.__client = { SM_OPTIONS, smSelectedOptions, smOptionAmount, smUpdatePrice, smSyncBundleBoost, smToggleCountOption };`, sandbox, { filename: 'index.html-pricing' });
  return { client: sandbox.__client, elements, radios, window: sandbox.window };
}

function check(elements, key, value = true) {
  elements.get('sm-opt-' + key).checked = value;
}

function selectedTotal(client) {
  return client.smSelectedOptions().reduce((sum, opt) => sum + client.smOptionAmount(opt), 0);
}

module.exports = (async () => {
  {
    const { client, elements, radios } = loadClientPricing();
    check(elements, 'open_chat_post');
    elements.get('sm-opt-open_chat_post-count').value = '2';
    radios.forEach((r) => { r.checked = r.value === 'pm9'; });
    client.smToggleCountOption('open_chat_post');
    const selected = client.smSelectedOptions();
    assert.deepStrictEqual(plain(selected), [{ key: 'open_chat_post', count: 2, slot: 'pm9' }]);
    assert.strictEqual(selectedTotal(client), 50000);
    client.smUpdatePrice();
    assert.strictEqual(elements.get('sm-final-price').textContent, '70,000');
  }

  {
    const { client, elements, radios } = loadClientPricing();
    check(elements, 'bundle_boost');
    radios.forEach((r) => { r.checked = r.value === 'pm9'; });
    client.smSyncBundleBoost();
    assert.deepStrictEqual(plain(client.smSelectedOptions()), [{ key: 'bundle_boost', slot: 'pm9' }]);
    assert.strictEqual(selectedTotal(client), 59000);
    assert.strictEqual(elements.get('sm-opt-seo_boost').disabled, true);
    assert.strictEqual(elements.get('sm-opt-open_chat_post').disabled, true);
    assert.strictEqual(elements.get('sm-opt-kakao_blast').disabled, true);
    assert.strictEqual(radios.every((r) => r.disabled === false), true, 'bundle should keep slot radios enabled');
    assert.strictEqual(elements.get('sm-opt-open_chat_post-bundle-hint').style.display, '', 'bundle should show slot guidance');
    client.smUpdatePrice();
    assert.strictEqual(elements.get('sm-final-price').textContent, '79,000');
  }

  {
    const { client, elements, radios } = loadClientPricing();
    check(elements, 'seo_boost');
    check(elements, 'kakao_blast');
    check(elements, 'bundle_boost');
    radios.forEach((r) => { r.checked = r.value === 'pm9'; });
    client.smSyncBundleBoost();
    assert.deepStrictEqual(plain(client.smSelectedOptions()), [{ key: 'bundle_boost', slot: 'pm9' }], 'bundle should hide included singles and preserve selected slot');
    assert.strictEqual(selectedTotal(client), 59000);
  }

  {
    const { client, elements, window } = loadClientPricing();
    window.SM_PROMO.remaining = 3;
    check(elements, 'bundle_boost');
    client.smSyncBundleBoost();
    client.smUpdatePrice();
    assert.strictEqual(elements.get('sm-final-price').textContent, '59,000', 'promo should zero only base price; bundle remains paid');
  }

  console.log('red options client display tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
