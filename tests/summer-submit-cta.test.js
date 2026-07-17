const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const marker of [
  'class="menu-pill is-cta summer-submit-cta"',
  'aria-label="7-8월 이벤트 내 공고 직접 등록"',
  'class="summer-submit-badge"',
  '7-8월 EVENT',
  'class="summer-submit-label"',
  '<span class="summer-submit-label"><span>내공고</span><span>직접등록</span></span>',
  '@keyframes summerSubmitSheen',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert(indexHtml.includes(marker), `summer direct-submit CTA should include marker: ${marker}`);
}

assert(
  !/summer-submit-[\s\S]{0,800}letter-spacing\s*:\s*-/.test(indexHtml),
  'summer submit CTA should not use negative letter spacing',
);

console.log('summer submit CTA tests passed');
