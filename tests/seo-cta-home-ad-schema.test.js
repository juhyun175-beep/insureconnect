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
assert(html.includes('cfg.popup && cfg.popup.enabled===false'), 'SEO popup should honor the popup master switch');
assert(html.includes("var arr=(cfg.campaigns||[]).filter(function(x){ return x && x.images && x.images.length; });"), 'SEO popup should select an image-bearing campaign');
assert(html.includes('var c=arr[0];'), 'SEO popup should keep its existing first-campaign behavior');
assert(!html.includes('if(!c.enabled || !imgs.length) return;'), 'SEO popup must not use the retired single-campaign enabled flag');
assert(html.includes('setTimeout(show, 5000);'), 'SEO popup should retain the five-second delay');
assert(html.includes("document.addEventListener('mouseout'"), 'SEO popup should retain desktop exit intent');
assert(html.includes('3*86400000'), 'SEO popup should retain the three-day cooldown');
assert(html.includes("JSON.stringify({menu:'홈광고',card:card})"), 'SEO popup tracking should use the home-ad stats menu');
assert(html.includes("track('popimp:'+c.id);"), 'SEO popup impressions should be attributed to the selected campaign');
assert(html.includes("track('click:'+c.id);"), 'SEO popup clicks should be attributed to the selected campaign');
assert(!html.includes("menu:'광고팝업'"), 'SEO popup tracking should not use the retired unaggregated menu');
assert(!html.includes("track('노출')"), 'SEO popup impressions should not use an unattributed card');
assert(!html.includes("track('클릭')"), 'SEO popup clicks should not use an unattributed card');

console.log('seo CTA home-ad schema regression test passed');
