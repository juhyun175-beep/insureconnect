const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function makeEnv({ order, adType = 'recruit', adRow = {}, seoUntil = '2026-07-17 12:00:00', members = [], kakaoRestKey, homeAdConfig = { campaigns: [] } } = {}) {
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
            if (/SELECT id, options_json, fulfilled_json, status, final_price FROM ad_orders/.test(sql)) {
              return Promise.resolve(order || null);
            }
            if (/SELECT value FROM ic_site_config/.test(sql)) {
              return Promise.resolve({ value: JSON.stringify(homeAdConfig) });
            }
            if (sql === `SELECT * FROM ${table} WHERE id = ?`) {
              return Promise.resolve({
                id: rec.values[0],
                title: '테스트 공고',
                company_name: '테스트 회사',
                instructor: '테스트 강사',
                host: '테스트 모임',
                description: '옵션 이행 테스트',
                ...adRow,
              });
            }
            if (sql === `SELECT seo_boost_until FROM ${table} WHERE id = ?`) {
              return Promise.resolve({ seo_boost_until: seoUntil });
            }
            return Promise.resolve(null);
          },
          all() {
            if (/FROM ic_members/.test(sql)) return Promise.resolve({ results: members });
            return Promise.resolve({ results: [] });
          },
        };
        calls.push(rec);
        return rec;
      },
    },
    KAKAO_REST_KEY: kakaoRestKey,
  };
  return { env, calls };
}

async function fulfill({ order, adType = 'recruit', seoUntil, members, kakaoRestKey, homeAdConfig } = {}) {
  const mod = await import(pathToFileURL(path.join(root, 'functions/_lib/fulfillment.js')).href + `?t=${Date.now()}${Math.random()}`);
  const { env, calls } = makeEnv({ order, adType, seoUntil, members, kakaoRestKey, homeAdConfig });
  const result = await mod.fulfillApprovedOptions(env, { adType, adId: 77 });
  const orderUpdate = calls.find((c) => /UPDATE ad_orders\s+SET status =/.test(c.sql));
  assert(orderUpdate, 'fulfillment should persist fulfilled_json to ad_orders');
  const fulfilled = JSON.parse(orderUpdate.values[0]);
  return { result, fulfilled, calls };
}

module.exports = (async () => {
  {
    const { fulfilled, calls, result } = await fulfill({
      order: {
        id: 501,
        options_json: JSON.stringify([{ key: 'bundle_boost', slot: 'pm9' }]),
        fulfilled_json: null,
        status: 'pending_payment',
      },
    });

    assert.ok(fulfilled.bundle_boost, 'bundle_boost should leave an expansion record in fulfilled_json');
    assert.strictEqual(fulfilled.bundle_boost.status, 'auto_done');
    assert.strictEqual(fulfilled.bundle_boost.mode, 'bundle_expand');
    assert.match(fulfilled.bundle_boost.message, /패키지 구성 옵션으로 전개/);

    assert.strictEqual(fulfilled.seo_boost.status, 'auto_done');
    assert.strictEqual(fulfilled.seo_boost.mode, 'seo_boost_until');
    assert.match(fulfilled.seo_boost.message, /SEO 전 페이지 위젯 상단 고정 7일/);
    assert.match(fulfilled.seo_boost.message, /KST/);

    assert.strictEqual(fulfilled.open_chat_post.status, 'manual_required');
    assert.strictEqual(fulfilled.open_chat_post.mode, 'open_chat_post');
    assert.strictEqual(fulfilled.open_chat_post.count, 2);
    assert.strictEqual(fulfilled.open_chat_post.slot, 'pm9');
    assert.match(fulfilled.open_chat_post.message, /오픈채팅 골든타임 게시 2회 \(저녁 9시\)/);

    assert.strictEqual(fulfilled.kakao_blast.status, 'auto_failed', 'bundle should expand kakao_blast and attempt its fulfillment');
    assert.strictEqual(fulfilled.kakao_blast.mode, 'kakao_broadcast');

    const seoUpdate = calls.find((c) => /SET seo_boost_until/.test(c.sql));
    assert(seoUpdate, 'seo_boost should update the posting row');
    assert.match(seoUpdate.sql, /CASE\s+WHEN seo_boost_until IS NULL OR seo_boost_until <= datetime\('now'\)/);
    assert(!/updated_at/.test(seoUpdate.sql), 'seo_boost update should not assume updated_at exists');

    const adRead = calls.find((c) => c.sql === 'SELECT * FROM ic_recruitments WHERE id = ?');
    assert(adRead, 'expanded kakao_blast should trigger ad row lookup');
    assert.deepStrictEqual(result.options, [{ key: 'seo_boost' }, { key: 'open_chat_post', count: 2, slot: 'pm9' }, { key: 'kakao_blast' }]);
  }

  {
    const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
    assert(admin.includes('function _rfFulfillLabel(key, st)'), 'admin should render labels from fulfilled_json keys');
    assert(admin.includes("['bundle_boost','seo_boost','open_chat_post','kakao_blast']"), 'admin should show expanded bundle fulfillment keys');
    assert(admin.includes("if(key==='open_chat_post' && st)"), 'admin should display open_chat_post count and slot from fulfillment status');
    assert(admin.includes('시간대 미지정'), 'admin should visibly show unspecified open_chat_post slots');
  }

  {
    const { fulfilled, calls } = await fulfill({
      adType: 'meetup',
      seoUntil: '2026-07-18 00:30:00',
      order: {
        id: 502,
        options_json: JSON.stringify(['seo_boost']),
        fulfilled_json: JSON.stringify({ seo_boost: { status: 'auto_done', mode: 'seo_boost_until' } }),
        status: 'published',
      },
    });
    assert.strictEqual(fulfilled.seo_boost.status, 'auto_done');
    const seoUpdate = calls.find((c) => /SET seo_boost_until/.test(c.sql));
    assert(seoUpdate, 'seo_boost reapproval should remain idempotent via CASE guard');
    assert.match(seoUpdate.sql, /ELSE seo_boost_until/);
    assert(!/updated_at/.test(seoUpdate.sql), 'meetup seo boost should not update updated_at');
  }

  {
    const { fulfilled } = await fulfill({
      kakaoRestKey: 'dummy-rest-key',
      members: [],
      order: {
        id: 504,
        options_json: JSON.stringify(['kakao_blast']),
        fulfilled_json: null,
        status: 'pending_payment',
      },
    });
    assert.strictEqual(fulfilled.kakao_blast.status, 'manual_required');
    assert.strictEqual(fulfilled.kakao_blast.mode, 'kakao_broadcast');
    assert.strictEqual(fulfilled.kakao_blast.total, 0);
    assert.strictEqual(fulfilled.kakao_blast.sent, 0);
    assert.strictEqual(fulfilled.kakao_blast.failed, 0);
    assert.strictEqual(fulfilled.kakao_blast.revoked, 0);
    assert.match(fulfilled.kakao_blast.message, /알림 수신 동의 회원이 0명/);
    assert.match(fulfilled.kakao_blast.message, /환불\/대체 이행/);
  }

  {
    const { fulfilled } = await fulfill({
      order: {
        id: 503,
        options_json: JSON.stringify(['bundle_boost']),
        fulfilled_json: null,
        status: 'pending_payment',
      },
    });
    assert.strictEqual(fulfilled.open_chat_post.status, 'manual_required');
    assert.strictEqual(fulfilled.open_chat_post.count, 2);
    assert.strictEqual(fulfilled.open_chat_post.slot, null);
    assert.match(fulfilled.open_chat_post.message, /시간대 미지정 — 등록자와 협의 필요/);
    assert(!fulfilled.open_chat_post.message.includes('점심 12:30'), 'unspecified bundle slot should not fall back to noon');
  }

  {
    const { fulfilled, calls } = await fulfill({
      homeAdConfig: {
        enabled: true,
        campaigns: [{ id: 'manual', enabled: true, images: ['/manual.png'] }],
      },
      order: {
        id: 505,
        options_json: JSON.stringify(['home_banner7']),
        fulfilled_json: null,
        status: 'paid',
        final_price: 300000,
      },
    });

    assert.ok(fulfilled.home_banner7);
    assert.strictEqual(fulfilled.home_banner7.status, 'auto_done');
    assert.strictEqual(fulfilled.home_banner7.label, '홈 배너 노출 7일');
    assert.strictEqual(fulfilled.home_banner7.mode, 'home_banner_campaign');

    const save = calls.find((c) => /INSERT INTO ic_site_config/.test(c.sql));
    assert(save, 'home_banner7 fulfillment should persist the home_ad config');
    assert.strictEqual(save.values[0], 'home_ad');
    const config = JSON.parse(save.values[1]);

    assert(Array.isArray(config.campaigns));
    const campaign = config.campaigns.find(
      (item) => item.id === fulfilled.home_banner7.campaign_id,
    );
    assert(campaign, 'fulfilled campaign should be present in the saved home_ad config');
    assert.strictEqual(campaign.enabled, true);
    assert(campaign.start_at);
    assert(campaign.end_at);
    assert.strictEqual(campaign.start_at, fulfilled.home_banner7.start_at);
    assert.strictEqual(campaign.end_at, fulfilled.home_banner7.end_at);
    assert(campaign.link_url.includes('insureconnect.co.kr'));
    assert(Array.isArray(campaign.images));
    assert(campaign.images.length > 0);
    assert(config.campaigns.some((item) => item.id === 'manual'));
  }

  {
    const { fulfilled, calls } = await fulfill({
      order: {
        id: 505,
        options_json: JSON.stringify(['home_banner7']),
        status: 'published',
        final_price: 300000,
        fulfilled_json: JSON.stringify({
          home_banner7: {
            status: 'auto_done',
            mode: 'home_banner_campaign',
            campaign_id: 'existing_campaign',
          },
        }),
      },
    });

    assert.strictEqual(fulfilled.home_banner7.status, 'auto_done');
    assert(
      !calls.some((c) => /INSERT INTO ic_site_config/.test(c.sql)),
      'home_banner7 reapproval must not create a duplicate campaign',
    );
  }

  {
    const { fulfilled, calls } = await fulfill({
      kakaoRestKey: 'dummy-rest-key',
      members: [],
      order: {
        id: 506,
        options_json: JSON.stringify(['kakao_blast']),
        fulfilled_json: null,
        status: 'refunded',
        final_price: 29000,
      },
    });

    const orderUpdate = calls.find((c) => /UPDATE ad_orders\s+SET status =/.test(c.sql));
    assert(orderUpdate, 'refunded fulfillment should persist its fulfillment record');
    assert.match(
      orderUpdate.sql,
      /CASE\s+WHEN status = 'refunded' THEN status ELSE 'published' END/,
      'refunded orders must preserve their status during fulfillment',
    );
    assert.strictEqual(fulfilled.kakao_blast.mode, 'kakao_broadcast');
  }

  console.log('fulfillment red option tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
