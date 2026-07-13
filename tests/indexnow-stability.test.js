const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const HARD_CODED_KEY = 'baec816b6c916fb26e8f3258def82499535482f7689db1fd76c0f279a9b5a818';

function importFresh(rel) {
  return import(pathToFileURL(path.join(root, rel)).href + `?t=${Date.now()}${Math.random()}`);
}

async function withFetch(mock, task) {
  const oldFetch = global.fetch;
  global.fetch = mock;
  try { return await task(); } finally { global.fetch = oldFetch; }
}

module.exports = (async () => {
  const indexnow = await importFresh('functions/_lib/indexnow.js');

  {
    const calls = [];
    const urls = Array.from({ length: 205 }, (_, i) => `https://insureconnect.co.kr/insurance/claim/chunk-${i}`);
    const result = await withFetch(async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return new Response('', { status: 200 });
    }, () => indexnow.submitUrls({ INDEXNOW_KEY: 'not-a-valid-secret' }, urls, { sleep: async () => {} }));

    assert.strictEqual(calls.length, 3, '205 URLs should be split into three requests');
    assert.deepStrictEqual(calls.map((call) => call.body.urlList.length), [100, 100, 5]);
    assert(calls.every((call) => call.body.key === HARD_CODED_KEY), 'invalid env key should use the built-in key');
    assert(calls.every((call) => call.body.keyLocation.endsWith(`/${HARD_CODED_KEY}.txt`)));
    assert.match(result.keyWarning, /INDEXNOW_KEY/);
    assert.strictEqual(result.succeeded, 205);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.attempts.length, 3);
  }

  {
    const calls = [];
    const delays = [];
    const urls = Array.from({ length: 101 }, (_, i) => `https://insureconnect.co.kr/insurance/claim/failover-${i}`);
    const result = await withFetch(async (url, init) => {
      const body = JSON.parse(init.body);
      const chunk = body.urlList[0].endsWith('failover-100') ? 2 : 1;
      const api = String(url).includes('api.indexnow.org');
      calls.push({ endpoint: String(url), chunk });
      if (chunk === 1) return new Response('', { status: api ? 429 : 200 });
      return new Response('', { status: api ? 500 : 503 });
    }, () => indexnow.submitUrls({}, urls, { sleep: async (ms) => { delays.push(ms); } }));

    assert.strictEqual(calls.length, 10, 'retryable failures should retry three times before failover');
    assert.deepStrictEqual(delays, [500, 1500, 500, 1500, 500, 1500]);
    assert.strictEqual(result.ok, true, 'one successful chunk should keep the overall response successful');
    assert.strictEqual(result.complete, false);
    assert.strictEqual(result.succeeded, 100);
    assert.strictEqual(result.failed, 1);
    assert.deepStrictEqual(result.attempts.map((a) => [new URL(a.endpoint).host, a.chunk, a.status, a.ok, a.retries]), [
      ['api.indexnow.org', 1, 429, false, 2],
      ['www.bing.com', 1, 200, true, 0],
      ['api.indexnow.org', 2, 500, false, 2],
      ['www.bing.com', 2, 503, false, 2],
    ]);
  }

  {
    const admin = await importFresh('functions/api/admin/indexnow.js');
    const urls = Array.from({ length: 101 }, (_, i) => `https://insureconnect.co.kr/insurance/claim/partial-${i}`);
    const response = await withFetch(async (_url, init) => {
      const body = JSON.parse(init.body);
      return new Response('', { status: body.urlList[0].endsWith('partial-0') ? 202 : 400 });
    }, () => admin.onRequestPost({
      request: new Request('https://insureconnect.co.kr/api/admin/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
        body: JSON.stringify({ urls }),
      }),
      env: { ADMIN_SECRET: 'secret' },
    }));
    const json = await response.json();
    assert.strictEqual(response.status, 200, 'partial success should return HTTP 200');
    assert.strictEqual(json.succeeded, 100);
    assert.strictEqual(json.failed, 1);
  }

  {
    const admin = await importFresh('functions/api/admin/indexnow.js');
    const response = await withFetch(async () => new Response('', { status: 400 }), () => admin.onRequestPost({
      request: new Request('https://insureconnect.co.kr/api/admin/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
        body: JSON.stringify({ url: 'https://insureconnect.co.kr/insurance/claim/all-failed' }),
      }),
      env: { ADMIN_SECRET: 'secret' },
    }));
    const json = await response.json();
    assert.strictEqual(response.status, 502, 'all failed chunks should return HTTP 502');
    assert.strictEqual(json.status, 400);
    assert.strictEqual(json.succeeded, 0);
    assert.strictEqual(json.failed, 1);
  }

  {
    const adminSource = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
    assert(adminSource.includes("const code = data.status ? ` · IndexNow ${data.status}` : '';"));
    assert(adminSource.includes('indexnow-key-warning'));
    assert(adminSource.includes('data.attempts'));
    for (const rel of [
      'functions/api/recruitments/[id].js',
      'functions/api/lectures/[id].js',
      'functions/api/meetings/[id].js',
    ]) {
      const source = fs.readFileSync(path.join(root, rel), 'utf8');
      assert(source.includes('if (!result.ok) console.error'), `${rel} should log non-throwing IndexNow failures`);
      assert(source.includes(".catch(e => console.error('[indexnow]', e?.message || e))"), `${rel} should log IndexNow errors`);
      assert(!source.includes('.catch(() => {})'), `${rel} should not swallow IndexNow errors`);
    }
  }

  console.log('indexnow stability tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
