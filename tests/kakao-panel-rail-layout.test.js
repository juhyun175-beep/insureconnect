const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function cssBlock(source, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = source.match(re);
  assert(m, `${selector} block should exist`);
  return m[1];
}

function compact(source) {
  return source.replace(/\s+/g, ' ');
}

module.exports = (async () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const panel = cssBlock(html, '.ic-kakao-panel');
  assert(panel.includes('align-self: start;'), 'kakao panel should use natural height instead of stretching');
  assert(!panel.includes('align-self: stretch'), 'kakao panel should not stretch to the left column height');
  assert(html.includes('v2.119.0: 좌측 공고 컬럼이 가변 높이가 되어 stretch 제거'), 'kakao panel comment should document v2.119.0 layout fix');
  assert(
    compact(html).includes('@media (min-width: 1025px) { .ic-kakao-panel { position: sticky; top: 14px; } }'),
    'kakao panel should be sticky only on desktop layouts',
  );

  const rankList = cssBlock(html, '.ic-kakao-rank-list');
  assert(rankList.includes('gap: 5px'), 'rank list should keep compact natural spacing');
  assert(!rankList.includes('justify-content: space-between'), 'rank list should not distribute items across leftover height');
  assert(!rankList.includes('flex: 1 1 auto'), 'rank list should not force-fill the stretched panel');

  const highlighted = cssBlock(html, '.ic-kakao-panel.has-highlight .ic-kakao-rank-list');
  assert(!highlighted.includes('justify-content: space-between'), 'highlighted rank list override should not rely on space-between');

  console.log('kakao panel and rail layout source tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
