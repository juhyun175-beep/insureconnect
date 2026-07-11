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

console.log('seo CTA home-ad schema regression test passed');
