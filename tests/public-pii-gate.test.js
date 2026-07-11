const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function importFresh(rel) {
  return import(pathToFileURL(path.join(root, rel)).href + `?t=${Date.now()}${Math.random()}`);
}

/** 목록/단건 GET 용 mock env — first()/all() 반환값 주입 + 실행된 SQL 기록 */
function makeEnv({ firstRow = null, allRows = [] } = {}) {
  const calls = [];
  const env = {
    ADMIN_SECRET: 'test-admin-secret',
    DB: {
      prepare(sql) {
        const rec = {
          sql,
          values: [],
          bind(...values) { rec.values = values; return rec; },
          run() { return Promise.resolve({ meta: { changes: 1 } }); },
          first() { return Promise.resolve(sql.startsWith('SELECT') ? firstRow : null); },
          all() { return Promise.resolve({ results: allRows }); },
        };
        calls.push(rec);
        return rec;
      },
    },
  };
  return { env, calls };
}

const FULL_ROW = {
  id: 7, title: '공개 채용공고', company_name: '테스트사', description: '설명',
  file_url: null, file_type: null, form_url: null, created_at: '2026-07-01T00:00:00Z',
  status: 'approved', approved_at: '2026-07-02T00:00:00Z', featured_until: null, dm_enabled: 0,
  submitter_name: '홍길동', submitter_contact: '010-1234-5678',
  price: 50000, coupon_id: 3, coupon_rate: 20, submitter_id: 42,
};

module.exports = (async () => {
  // 1) 목록 GET — 비관리자 SQL에는 submitter/reject_reason 컬럼이 없어야 하고, 관리자 SQL에는 있어야 한다
  for (const rel of ['functions/api/recruitments/index.js', 'functions/api/lectures/index.js']) {
    {
      const mod = await importFresh(rel);
      const { env, calls } = makeEnv();
      const res = await mod.onRequestGet({ request: new Request('https://x/api/list'), env });
      assert.strictEqual(res.status, 200, `${rel} public list should be 200`);
      const sel = calls.find((c) => /^SELECT id, title/.test(c.sql.trim()));
      assert(sel, `${rel} should run the list SELECT`);
      for (const col of ['submitter_name', 'submitter_contact', 'reject_reason']) {
        assert(!sel.sql.includes(col), `${rel} public list SQL must not select ${col}`);
      }
    }
    {
      const mod = await importFresh(rel);
      const { env, calls } = makeEnv();
      const req = new Request('https://x/api/list?status=all', { headers: { 'x-admin-secret': 'test-admin-secret' } });
      const res = await mod.onRequestGet({ request: req, env });
      assert.strictEqual(res.status, 200, `${rel} admin list should be 200`);
      const sel = calls.find((c) => /^SELECT id, title/.test(c.sql.trim()));
      assert(sel.sql.includes('submitter_contact'), `${rel} admin list SQL should keep submitter_contact`);
    }
    {
      // 비관리자 status=pending 은 401
      const mod = await importFresh(rel);
      const { env } = makeEnv();
      const res = await mod.onRequestGet({ request: new Request('https://x/api/list?status=pending'), env });
      assert.strictEqual(res.status, 401, `${rel} pending list without admin should be 401`);
    }
  }

  // 2) 단건 GET — 비관리자: approved만 + 안전 필드만 / 관리자: 전체 필드
  for (const rel of ['functions/api/recruitments/[id].js', 'functions/api/lectures/[id].js']) {
    {
      const mod = await importFresh(rel);
      const { env } = makeEnv({ firstRow: { ...FULL_ROW } });
      const res = await mod.onRequestGet({ params: { id: '7' }, request: new Request('https://x/api/one/7'), env });
      assert.strictEqual(res.status, 200, `${rel} public approved detail should be 200`);
      const body = await res.json();
      assert.strictEqual(body.title, '공개 채용공고');
      for (const col of ['submitter_name', 'submitter_contact', 'submitter_id', 'price', 'coupon_id', 'coupon_rate']) {
        assert(!(col in body), `${rel} public detail must not expose ${col}`);
      }
    }
    {
      // pending 공고는 비관리자에게 404
      const mod = await importFresh(rel);
      const { env } = makeEnv({ firstRow: { ...FULL_ROW, status: 'pending' } });
      const res = await mod.onRequestGet({ params: { id: '7' }, request: new Request('https://x/api/one/7'), env });
      assert.strictEqual(res.status, 404, `${rel} public detail for pending posting should be 404`);
    }
    {
      // 관리자는 전체 필드(연락처 포함) 유지 — 승인 UI(getSubmitterContact)가 사용
      const mod = await importFresh(rel);
      const { env } = makeEnv({ firstRow: { ...FULL_ROW, status: 'pending' } });
      const req = new Request('https://x/api/one/7', { headers: { 'x-admin-secret': 'test-admin-secret' } });
      const res = await mod.onRequestGet({ params: { id: '7' }, request: req, env });
      assert.strictEqual(res.status, 200, `${rel} admin detail should be 200 for any status`);
      const body = await res.json();
      assert.strictEqual(body.submitter_contact, '010-1234-5678', `${rel} admin detail should keep submitter_contact`);
    }
  }

  console.log('public pii gate tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
