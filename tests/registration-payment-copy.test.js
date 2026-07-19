const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const phrase of [
  '등록비 바로 결제',
  '카드·간편결제',
  '카드로 결제',
  '/api/payments/ad-checkout',
  '/api/payments/ad-confirm',
  'smPayWithToss',
]) {
  assert(
    !indexHtml.includes(phrase),
    `posting payment modal should not activate card-payment guidance: ${phrase}`,
  );
}

for (const phrase of [
  '등록비 입금 안내',
  '입금자명',
  '신청 제출 →',
  '관리자가 결제(입금) 확인 + 승인 후 공고가 업로드됩니다',
]) {
  assert(
    indexHtml.includes(phrase),
    `bank-transfer posting flow should remain: ${phrase}`,
  );
}

assert(indexHtml.includes('id="sm-submit-btn"'), 'posting modal should keep the submit button id');
assert.match(
  indexHtml,
  /id="sm-submit-btn"[\s\S]{0,300}>\s*신청 제출 →\s*<\/button>/,
  'posting modal should expose the current submit button copy',
);

console.log('registration payment copy tests passed');
