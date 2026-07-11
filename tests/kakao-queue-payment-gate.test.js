const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function importFresh(rel) {
  return import(pathToFileURL(path.join(root, rel)).href + `?t=${Date.now()}${Math.random()}`);
}

/** fulfillment용 mock env — 카톡 대기열/수신동의 카운트 응답 포함 */
function makeEnv({ order, adType = 'recruit', optin = 3, adRow = {} } = {}) {
  const calls = [];
  const tableByType = { recruit: 'ic_recruitments', lecture: 'ic_lectures', meetup: 'ic_meetings' };
  const table = tableByType[adType] || 'ic_recruitments';
  const env = {
    KAKAO_REST_KEY: 'dummy-rest-key',
    DB: {
      prepare(sql) {
        const rec = {
          sql,
          values: [],
          bind(...values) { rec.values = values; return rec; },
          run() { return Promise.resolve({ meta: { changes: 1 } }); },
          first() {
            if (/SELECT id, options_json, fulfilled_json, status, final_price FROM ad_orders/.test(sql)) {
              return Promise.resolve(order || null);
            }
            if (sql === `SELECT * FROM ${table} WHERE id = ?`) {
              return Promise.resolve({ id: rec.values[0], title: '큐 게이트 테스트 공고', company_name: '테스트사', ...adRow });
            }
            if (/COUNT\(\*\) AS n FROM ic_members WHERE alert_optin/.test(sql)) {
              return Promise.resolve({ n: optin });
            }
            if (/COUNT\(\*\) AS n FROM ic_kakao_queue WHERE batch_key/.test(sql)) {
              return Promise.resolve({ n: 0 }); // 중복 배치 없음
            }
            if (/COUNT\(\*\) AS n FROM ic_kakao_queue WHERE status = 'pending'/.test(sql)) {
              return Promise.resolve({ n: optin });
            }
            return Promise.resolve(null);
          },
          all() { return Promise.resolve({ results: [] }); },
        };
        calls.push(rec);
        return rec;
      },
    },
  };
  return { env, calls };
}

async function fulfill(opts) {
  const mod = await importFresh('functions/_lib/fulfillment.js');
  const { env, calls } = makeEnv(opts);
  const result = await mod.fulfillApprovedOptions(env, { adType: opts.adType || 'recruit', adId: 77 });
  const orderUpdate = calls.find((c) => /UPDATE ad_orders\s+SET status =/.test(c.sql));
  assert(orderUpdate, 'fulfillment should persist fulfilled_json');
  return { result, fulfilled: JSON.parse(orderUpdate.values[0]), calls };
}

module.exports = (async () => {
  // 1) 입금대기(final_price>0) → 카톡 발송 보류(manual_required), 대기열 등록 없음
  {
    const { fulfilled, calls } = await fulfill({
      order: { id: 601, options_json: JSON.stringify(['kakao_blast']), fulfilled_json: null, status: 'pending_payment', final_price: 29000 },
    });
    assert.strictEqual(fulfilled.kakao_blast.status, 'manual_required');
    assert.strictEqual(fulfilled.kakao_blast.gated, 'pending_payment');
    assert.match(fulfilled.kakao_blast.message, /입금대기/);
    assert.match(fulfilled.kakao_blast.message, /입금확인\(결제완료\)/);
    assert(!calls.some((c) => /INSERT INTO ic_kakao_queue/.test(c.sql)), 'gated blast must not enqueue');
  }

  // 2) 결제완료(paid) → 대기열 일괄 등록(INSERT..SELECT) + auto_queued
  {
    const { fulfilled, calls } = await fulfill({
      order: { id: 602, options_json: JSON.stringify(['kakao_blast']), fulfilled_json: null, status: 'paid', final_price: 29000 },
    });
    assert.strictEqual(fulfilled.kakao_blast.status, 'auto_queued');
    assert.strictEqual(fulfilled.kakao_blast.mode, 'kakao_queue');
    assert.strictEqual(fulfilled.kakao_blast.batch_key, 'blast:602');
    assert.strictEqual(fulfilled.kakao_blast.total, 3);
    const enq = calls.find((c) => /INSERT INTO ic_kakao_queue/.test(c.sql));
    assert(enq, 'paid blast should enqueue all opted-in members in one statement');
    assert.match(enq.sql, /SELECT id, \?, \? FROM ic_members WHERE alert_optin = 1/);
    assert.strictEqual(enq.values[1], 'blast:602');
  }

  // 3) 재승인 멱등성 — auto_queued 기록이 있으면 재등록하지 않음
  {
    const { fulfilled, calls } = await fulfill({
      order: {
        id: 602, options_json: JSON.stringify(['kakao_blast']), status: 'published', final_price: 29000,
        fulfilled_json: JSON.stringify({ kakao_blast: { status: 'auto_queued', mode: 'kakao_queue' } }),
      },
    });
    assert.strictEqual(fulfilled.kakao_blast.status, 'auto_queued');
    assert(!calls.some((c) => /INSERT INTO ic_kakao_queue/.test(c.sql)), 'reapproval must not re-enqueue');
  }

  // 4) 유료 추천공고 = 상단노출 7일 가산 (+ 재승인 멱등)
  {
    const { fulfilled, calls } = await fulfill({
      order: { id: 603, options_json: JSON.stringify(['featured_listing']), fulfilled_json: null, status: 'paid', final_price: 18000 },
    });
    assert.strictEqual(fulfilled.featured_listing.status, 'auto_done');
    assert.strictEqual(fulfilled.featured_listing.mode, 'featured_until_plus7');
    assert.match(fulfilled.featured_listing.message, /상단노출 7일/);
    const upd = calls.find((c) => /SET featured_until = datetime\(/.test(c.sql));
    assert(upd, 'featured_listing should extend featured_until');
    assert.match(upd.sql, /\+7 days/);
    assert.match(upd.sql, /CASE WHEN featured_until IS NOT NULL AND featured_until > datetime\('now'\)/);
  }
  {
    const { calls } = await fulfill({
      order: {
        id: 603, options_json: JSON.stringify(['featured_listing']), status: 'published', final_price: 18000,
        fulfilled_json: JSON.stringify({ featured_listing: { status: 'auto_done', mode: 'featured_until_plus7' } }),
      },
    });
    assert(!calls.some((c) => /SET featured_until = datetime\(/.test(c.sql)), 'featured reapproval must not stack another 7 days');
  }

  // 5) 서버·관리자 배선 소스 검증 — mark_paid 액션, 대기열 엔드포인트, 관리자 버튼/배지
  {
    const refunds = fs.readFileSync(path.join(root, 'functions/api/admin/refunds.js'), 'utf8');
    assert(refunds.includes("action === 'mark_paid'"), 'refunds should support mark_paid');
    assert(refunds.includes("SET status = 'paid' WHERE id = ? AND status = 'pending_payment'"), 'mark_paid must be a guarded transition');
    assert(refunds.includes('fulfillApprovedOptions'), 'mark_paid should retry held fulfillment');

    const cron = fs.readFileSync(path.join(root, 'functions/api/cron/kakao-queue.js'), 'utf8');
    assert(cron.includes('drainKakaoQueue'), 'cron endpoint should drain the queue');
    assert(cron.includes('constantTimeEqual'), 'cron endpoint should use constant-time secret compare');

    const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
    assert(admin.includes('markOrderPaid'), 'admin should expose 입금확인 action');
    assert(admin.includes('💰 입금확인'), 'pending card should render 입금확인 button');
    assert(admin.includes("status==='auto_queued'"), 'admin badges should render auto_queued state');
    assert(admin.includes("fetch('/api/cron/kakao-queue', { method: 'POST'"), 'dashboard should kick queue drain');

    const worker = fs.readFileSync(path.join(root, 'scripts/cron-worker/worker.js'), 'utf8');
    assert(worker.includes("'*/5 * * * *'"), 'cron worker should route the 5-minute schedule');
    const workerToml = fs.readFileSync(path.join(root, 'scripts/cron-worker/wrangler.toml'), 'utf8');
    assert(workerToml.includes('*/5 * * * *'), 'cron worker schedule should include the 5-minute drain');
  }

  console.log('kakao queue payment gate tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
