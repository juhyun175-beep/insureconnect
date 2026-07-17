const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadHomeAdModule() {
  const source = fs.readFileSync(path.join(root, 'functions/_lib/home-ad.js'), 'utf8');
  const script = source.replace(/\bexport\s+/g, '') + `
this.__exports = {
  HOME_AD_CONFIG_KEY,
  postingHomeAdCampaignId,
  buildPostingHomeAdCampaign,
  upsertPostingHomeAdCampaign,
};`;
  const sandbox = { console, Date, URL };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox.__exports;
}

function makeD1Env(existingConfig = { campaigns: [] }) {
  const calls = [];
  let savedConfig = null;
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
            if (/INSERT INTO ic_site_config/.test(sql)) {
              savedConfig = JSON.parse(rec.values[1]);
            }
            return Promise.resolve({ meta: { changes: 1 } });
          },
          first() {
            if (/SELECT value FROM ic_site_config/.test(sql)) {
              return Promise.resolve({ value: JSON.stringify(existingConfig) });
            }
            return Promise.resolve(null);
          },
        };
        calls.push(rec);
        return rec;
      },
    },
  };
  return { env, calls, getSavedConfig: () => savedConfig };
}

(async () => {
  const {
    HOME_AD_CONFIG_KEY,
    postingHomeAdCampaignId,
    buildPostingHomeAdCampaign,
    upsertPostingHomeAdCampaign,
  } = loadHomeAdModule();

  assert.strictEqual(HOME_AD_CONFIG_KEY, 'home_ad');
  assert.strictEqual(postingHomeAdCampaignId('recruit', 123), 'posting_recruit_123');

  const campaign = buildPostingHomeAdCampaign({
    adType: 'lecture',
    adId: 33,
    title: '손해사정 실무 특강',
    fileUrl: 'https://cdn.example.com/banner.jpg',
    fileType: 'image',
    formUrl: 'https://forms.example.com/apply',
  });
  assert.strictEqual(campaign.id, 'posting_lecture_33');
  assert.strictEqual(campaign.enabled, true);
  assert.deepStrictEqual(Array.from(campaign.images), ['https://cdn.example.com/banner.jpg']);
  assert.strictEqual(campaign.link_url, 'https://forms.example.com/apply');
  assert(campaign.start_at, 'campaign should have a start date');
  assert(campaign.end_at, 'campaign should have an end date');

  const { env, calls, getSavedConfig } = makeD1Env({
    enabled: true,
    campaigns: [{ id: 'manual', enabled: true, images: ['/manual.png'] }],
  });
  const result = await upsertPostingHomeAdCampaign(env, {
    adType: 'recruit',
    adId: 123,
    title: '보상 담당자 채용',
    fileUrl: 'https://cdn.example.com/recruit.png',
    fileType: 'image',
  });

  assert.strictEqual(result.ok, true);
  const saved = getSavedConfig();
  assert(saved, 'home_ad config should be saved');
  assert.strictEqual(saved.enabled, true);
  assert(saved.campaigns.some((c) => c.id === 'manual'), 'manual campaigns should be preserved');
  const auto = saved.campaigns.find((c) => c.id === 'posting_recruit_123');
  assert(auto, 'home banner option should create a posting campaign');
  assert.strictEqual(auto.enabled, true);
  assert.deepStrictEqual(auto.images, ['https://cdn.example.com/recruit.png']);
  assert(auto.link_url.includes('insureconnect.co.kr'), 'posting campaign should link back to the site when no form URL exists');
  assert(
    calls.some((c) => /CREATE TABLE IF NOT EXISTS ic_site_config/.test(c.sql)),
    'upsert should ensure the home_ad config table exists',
  );

  for (const file of [
    'functions/api/recruitments/[id].js',
    'functions/api/lectures/[id].js',
    'functions/api/meetings/[id].js',
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert(source.includes('upsertPostingHomeAdCampaign'), `${file} should activate the selected home banner option on approval`);
    assert(source.includes('home_banner7_enabled'), `${file} should read the selected home banner option flag`);
  }

  console.log('home banner option activation tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
