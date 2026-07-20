const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../functions/_lib/seo-cta.js'), 'utf8');
const script = `${source.replace(/^import .*;\r?\n/gm, '').replace(/\bexport\s+/g, '')}\nthis.__exports = { seoCtaFooter };`;
const sandbox = { coupangModal: () => '' };
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename: 'seo-cta.js' });

const html = sandbox.__exports.seoCtaFooter('https://insureconnect.co.kr');

assert(html.includes('var cfg=d.config;'), 'SEO popup should read the multi-campaign home-ad config');
assert(html.includes('if(!popup || popup.enabled===false) return false;'), 'SEO popup should honor the popup master switch like home popupAllowed');
assert(!html.includes('if(!c.enabled || !imgs.length) return;'), 'SEO popup must not use the retired single-campaign enabled flag');
assert(html.includes("document.addEventListener('mouseout'"), 'SEO popup should retain desktop exit intent');
assert(html.includes("JSON.stringify({menu:'홈광고',card:card})"), 'SEO popup tracking should use the home-ad stats menu');
assert(html.includes("track('popimp:'+c.id);"), 'SEO popup impressions should be attributed to the selected campaign');
assert(html.includes("track('click:'+c.id);"), 'SEO popup clicks should be attributed to the selected campaign');
assert(!html.includes("menu:'광고팝업'"), 'SEO popup tracking should not use the retired unaggregated menu');
assert(!html.includes("track('노출')"), 'SEO popup impressions should not use an unattributed card');
assert(!html.includes("track('클릭')"), 'SEO popup clicks should not use an unattributed card');

/* v2.135.0: 홈 광고 정책 통일 — 하드코딩 딜레이/쿨다운 제거, 관리자 popup 설정 준수 */
assert(!html.includes('ic_adpop_v1'), 'SEO popup must no longer read or write the retired 3-day cooldown key');
assert(!html.includes('3*86400000'), 'SEO popup must no longer hardcode a three-day cooldown');
assert(!html.includes('setTimeout(show, 5000);'), 'SEO popup must no longer hardcode a five-second delay');
assert(html.includes('(cfg.popup && cfg.popup.delay_ms!=null)?cfg.popup.delay_ms:900'), 'SEO popup delay should follow admin delay_ms with the home 900ms default');
assert(html.includes("var freq=popup.frequency||'once_day';"), 'SEO popup should default to once_day like home');
assert(html.includes("if(freq==='off') return false;"), 'SEO popup should honor frequency off');
assert(html.includes("if(freq==='always') return true;"), 'SEO popup should show every pageview on frequency always');
assert(html.includes("sessionStorage.getItem('ic_homead_pop')"), 'SEO popup session frequency should share the home sessionStorage key');
assert(html.includes("localStorage.getItem('ic_homead_pop_day')"), 'SEO popup once_day frequency should share the home localStorage key');

/* 스토리지 마킹은 gate 판정이 아닌 show() 시점 — 딜레이 전 이탈 시 노출 기회를 소진하면 안 됨 */
const gateBody = html.slice(html.indexOf('function freqAllowed('), html.indexOf('function markShown('));
assert(gateBody.length > 0 && !gateBody.includes('setItem'), 'frequency gate must not consume the exposure at check time');
const showBody = html.slice(html.indexOf('function show(){'), html.indexOf('var delay='));
assert(showBody.includes('markShown(cfg.popup);'), 'storage marking must happen inside show()');

/* 캠페인 로테이션 — 홈 pickCampaign과 동일 로직 (sequential 카운터 공유) */
assert(html.includes('function pickCampaign(cfg)'), 'SEO popup should pick campaigns via the home pickCampaign logic');
assert(!html.includes('var c=arr[0];'), 'SEO popup must not pin the first campaign anymore');
assert(html.includes("localStorage.getItem('ic_homead_seq')"), 'sequential rotation should share the home ic_homead_seq counter');
assert(html.includes("rot==='random'") && html.includes("rot==='weight'"), 'SEO popup should support random and weight rotation');

console.log('seo CTA home-ad schema regression test passed');
