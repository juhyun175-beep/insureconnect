const assert = require('assert');
const { pathToFileURL } = require('url');
const path = require('path');

const root = path.resolve(__dirname, '..');

function makeEnv({ promoUsed = 100 } = {}) {
  const calls = [];
  let nextRecruitmentId = 900;
  let nextOrderId = 1200;
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
            if (/INSERT INTO ic_recruitments/.test(sql)) {
              return Promise.resolve({ id: ++nextRecruitmentId });
            }
            if (/COUNT\(\*\) AS used FROM ad_orders WHERE promo_code = \?/.test(sql)) {
              return Promise.resolve({ used: promoUsed });
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

async function postRecruitment(options) {
  const mod = await import(pathToFileURL(path.join(root, 'functions/api/recruitments/index.js')).href);
  const { env, calls } = makeEnv();
  const request = new Request('https://insureconnect.co.kr/api/recruitments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '테스트 채용',
      description: '가격 검증용 공고',
      submitter_name: '테스터',
      submitter_contact: '010-0000-0000',
      options,
    }),
  });
  const res = await mod.onRequestPost({ request, env });
  const json = await res.json();
  const order = calls.find((c) => /INSERT INTO ad_orders/.test(c.sql));
  assert(order, 'registration should create an ad order');
  const optionsJson = order.values[9] ? JSON.parse(order.values[9]) : null;
  return { res, json, order, optionsJson };
}

module.exports = (async () => {
  {
    const { json, optionsJson } = await postRecruitment([{ key: 'open_chat_post', count: 2, slot: 'pm9' }]);
    assert.strictEqual(json.price.options_price, 50000);
    assert.strictEqual(json.price.price, 70000);
    assert.deepStrictEqual(optionsJson, [{ key: 'open_chat_post', count: 2, slot: 'pm9' }]);
  }

  {
    const { json, optionsJson } = await postRecruitment(['bundle_boost']);
    assert.strictEqual(json.price.options_price, 59000);
    assert.strictEqual(json.price.price, 79000);
    assert.deepStrictEqual(optionsJson, ['bundle_boost']);
  }

  {
    const { json, optionsJson } = await postRecruitment(['bundle_boost', 'seo_boost', 'kakao_blast']);
    assert.strictEqual(json.price.options_price, 59000);
    assert.strictEqual(json.price.price, 79000);
    assert.deepStrictEqual(optionsJson, ['bundle_boost']);
  }

  {
    const { res, json, optionsJson } = await postRecruitment([{ key: 'open_chat_post', count: 2, slot: 'evil' }]);
    assert.strictEqual(res.status, 200, 'invalid open_chat_post slot should not reject registration');
    assert.strictEqual(json.price.options_price, 50000);
    assert.deepStrictEqual(optionsJson, [{ key: 'open_chat_post', count: 2 }]);
  }

  console.log('red options registration tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
