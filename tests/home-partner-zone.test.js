const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const partnersApi = read(path.join('functions', 'api', 'partners', 'index.js'));
const partnerIdApi = read(path.join('functions', 'api', 'partners', '[id].js'));

assert.match(index, /id="home-partner-zone"[\s\S]*?제휴 서비스[\s\S]*?AD/);
assert.match(index, /rel="noopener noreferrer nofollow sponsored"/);
assert.match(index, /위 서비스는 제휴 파트너의 광고이며, 신청·상담·계약은 각 파트너사에서 직접 진행됩니다\./);
assert.match(index, /if \(!Array\.isArray\(items\) \|\| !items\.length\) \{ box\.style\.display = 'none'/);
assert.match(index, /fetch\('\/api\/partners\?active=1'\)/);
assert.match(index, /trackClick\(this\.dataset\.partnerName,\\?['"]partner\\?['"]\)/);

const partnerStart = index.indexOf('id="home-partner-zone"');
const newsStart = index.indexOf('class="ic-top-row"');
assert.ok(partnerStart >= 0 && newsStart >= 0 && partnerStart < newsStart, 'partner zone should precede news');

assert.match(partnersApi, /GET\s+\/api\/partners\?active=1/);
assert.match(partnersApi, /SELECT id, name, tagline, category, href, img FROM ic_partner_cards/);
assert.match(partnersApi, /WHERE is_active = 1/);
assert.match(partnersApi, /ORDER BY sort_order ASC, id ASC LIMIT 12/);
assert.match(partnersApi, /if \(!verifyAdmin\(request, env\)\) return unauthorized\(\);/);
assert.match(partnerIdApi, /onRequestPatch[\s\S]*?verifyAdmin\(request, env\)/);
assert.match(partnerIdApi, /onRequestDelete[\s\S]*?verifyAdmin\(request, env\)/);
assert.match(partnersApi, /isHttp/);
assert.match(partnerIdApi, /isHttp/);

assert.match(index, /id="b2b-partner"/);
const b2b = index.slice(index.indexOf('id="b2b-partner"'), index.indexOf('id="b2b-partner"') + 1800);
assert.match(b2b, /mailto:insureconnect@naver\.com\?subject=/);
assert.match(b2b, /encodeURIComponent\('\[광고·제휴 문의\] '\)/);
assert.match(b2b, /trackCardClick\('home','b2b-inquiry'\)/);
assert.match(b2b, /trackCardClick\('home','b2b-kakao'\)/);
assert.doesNotMatch(b2b, /\d+\s*만?\s*명/);

assert.match(index, /인슈어커넥트는 광고 게재 매체로서 일부 콘텐츠에 광고\(AD\)가 포함될 수 있습니다\./);
assert.match(index, /href="#b2b-partner">광고·제휴<\/a>/);

for (const file of ['index.html', 'about.html', 'contact.html', 'terms.html', 'disclaimer.html']) {
  const html = read(file);
  assert.doesNotMatch(html, new RegExp(['비', '영', '리'].join('')));
  assert.match(html, /판매·중개·자문을 하지 않/);
}
assert.match(read('terms.html'), /직접 판매·게재하는 제휴 광고\(AD 표기\)/);
assert.match(read('disclaimer.html'), /직접 게재하는 광고에는 AD를 표기/);

console.log('home partner zone tests passed');
