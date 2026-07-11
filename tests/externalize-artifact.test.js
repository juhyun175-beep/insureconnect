const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

/** scripts/externalize.mjs — 배포 아티팩트 변환이 index.html 구조 변화에도 안전한지 회귀 검증 */
module.exports = (async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ic-ext-'));
  try {
    const original = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    fs.writeFileSync(path.join(work, 'index.html'), original);

    execFileSync(process.execPath, [path.join(root, 'scripts/externalize.mjs'), 'index.html'], { cwd: work, stdio: 'pipe' });

    const out = fs.readFileSync(path.join(work, 'index.html'), 'utf8');
    const assets = fs.readdirSync(path.join(work, 'assets'));
    const js = assets.filter((f) => f.endsWith('.js'));
    const css = assets.filter((f) => f.endsWith('.css'));

    // 인라인 블록이 전부 참조로 대체됐는지 (속성 있는 태그·ld+json 은 인라인 유지)
    const srcRefs = (out.match(/<script src="\/assets\/[^"]+\.js"><\/script>/g) || []).length;
    const cssRefs = (out.match(/<link rel="stylesheet" href="\/assets\/[^"]+\.css">/g) || []).length;
    assert.strictEqual(srcRefs, js.length, 'every extracted JS should be referenced exactly once');
    assert.strictEqual(cssRefs, css.length, 'every extracted CSS should be referenced exactly once');
    assert(js.length >= 20, `expected 20+ extracted scripts, got ${js.length}`);
    assert(css.length >= 5, `expected 5+ extracted styles, got ${css.length}`);
    assert(!/<script>[\s\S]*?<\/script>/.test(out), 'no attribute-less inline <script> should remain');
    assert(!/<style>[\s\S]*?<\/style>/.test(out), 'no attribute-less inline <style> should remain');

    // 반드시 인라인으로 남아야 하는 것들
    assert.strictEqual((out.match(/application\/ld\+json/g) || []).length, (original.match(/application\/ld\+json/g) || []).length, 'JSON-LD must stay inline');
    assert(out.includes('<!-- OG:START -->') && out.includes('<!-- OG:END -->'), 'OG markers must survive');

    // 내용 무손실: 추출 파일 합 + 산출 HTML 이 원본 코드량을 보존
    const extractedBytes = assets.reduce((n, f) => n + fs.statSync(path.join(work, 'assets', f)).size, 0);
    assert(out.length < original.length * 0.35, 'HTML should shrink substantially');
    assert(extractedBytes > original.length * 0.5, 'most content should move into assets');

    // 추출된 JS 전수 구문 검증 (externalize.mjs 자체도 하지만 여기서 이중 안전)
    for (const f of js) execFileSync(process.execPath, ['--check', path.join(work, 'assets', f)], { stdio: 'pipe' });

    // 동일 입력 → 동일 해시 파일명 (결정적 출력 = 캐시 안정)
    const again = fs.mkdtempSync(path.join(os.tmpdir(), 'ic-ext2-'));
    fs.writeFileSync(path.join(again, 'index.html'), original);
    execFileSync(process.execPath, [path.join(root, 'scripts/externalize.mjs'), 'index.html'], { cwd: again, stdio: 'pipe' });
    assert.deepStrictEqual(fs.readdirSync(path.join(again, 'assets')).sort(), assets.slice().sort(), 'output must be deterministic');
    fs.rmSync(again, { recursive: true, force: true });

    console.log(`externalize artifact tests passed (js ${js.length} / css ${css.length} / html ${original.length}B → ${out.length}B)`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
