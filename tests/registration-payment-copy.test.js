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
  '입금완료·신청제출',
  '관리자가 입금 확인 + 승인 후 공고가 업로드됩니다',
]) {
  assert(
    indexHtml.includes(phrase),
    `bank-transfer posting flow should remain: ${phrase}`,
  );
}

console.log('registration payment copy tests passed');
