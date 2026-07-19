const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const ctaButton = indexHtml.match(
  /<button\b(?=[^>]*\bclass="menu-pill is-cta")(?=[^>]*\bonclick="openSubmitModal\(\)")[^>]*>\s*내 공고 직접 등록\s*<\/button>/,
);

assert(ctaButton, 'home navigation should keep the direct-submit CTA in one button');

for (const marker of [
  'class="menu-pill is-cta"',
  'onclick="openSubmitModal()"',
  '내 공고 직접 등록',
]) {
  assert(indexHtml.includes(marker), `direct-submit CTA should include marker: ${marker}`);
}

for (const marker of [
  'summer-submit-cta',
  'summer-submit-badge',
  'summer-submit-label',
  '7-8월 EVENT',
]) {
  assert(!indexHtml.includes(marker), `legacy summer CTA marker should be absent: ${marker}`);
}

console.log('home submit CTA tests passed');
