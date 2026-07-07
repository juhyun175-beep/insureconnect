#!/usr/bin/env node
/**
 * v2.15.8: 릴리즈 자동화 — MEMORY 배포 루틴을 한 번에.
 *   보안스캔(HIGH 0 게이트) → 배포(--branch=main, ASCII 메시지) → 배포URL 검증 → 로컬 커밋
 *
 *   사용:
 *     node scripts/release.mjs            # 스캔 → 배포 → 커밋
 *     node scripts/release.mjs --dry      # 스캔/버전만 확인(배포·커밋 X)
 *     node scripts/release.mjs --no-commit
 *     node scripts/release.mjs --verify=marker1,marker2   # 배포URL에서 마커 존재 확인
 *
 *   버전·CHANGELOG 내용은 작업별로 사람이 작성(자동화 불가) — 이 스크립트는 그 '이후' 반복 단계를 자동화.
 *   커밋/배포 메시지는 ASCII(윈도우에서 한글 메시지 = UTF-8 오류 회피).
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const PROJECT = 'insureconnect-hub';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const NO_COMMIT = args.includes('--no-commit');
const verifyArg = (args.find((a) => a.startsWith('--verify=')) || '').slice('--verify='.length);

const log = (...a) => console.log('[release]', ...a);
const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
const runSafe = (cmd) => { try { return run(cmd); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };
const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
const NODE = q(process.execPath);
const DLX = process.env.RELEASE_DLX || 'pnpm dlx';

// v2.75.0: 배포 산출물만 안전 미니파이(소스 불변). html-minifier-terser(npx, 로컬 node_modules 없음).
//   설정 scripts/htmlmin.json — compress/mangle OFF(전역명·onclick 보존), caseSensitive(인라인 SVG viewBox 보존).
//   실패/미설치 시 graceful skip → 원본 그대로 배포. 배포 직후 원본 복원(아래 deploy 단계).
const MINIFY_CFG = 'scripts/htmlmin.json';
function minifyInPlace(file) {
  const tmp = file + '.tmpmin';
  try {
    run(`${DLX} html-minifier-terser@7.2.0 --config-file ${MINIFY_CFG} "${file}" -o "${tmp}"`);
    const min = readFileSync(tmp, 'utf8');
    rmSync(tmp, { force: true });
    const orig = readFileSync(file, 'utf8');
    if (!min || min.length < 1000 || min.length >= orig.length) return null; // sanity / no-gain → skip
    writeFileSync(file, min);
    return orig; // caller restores this after deploy
  } catch (e) {
    try { rmSync(tmp, { force: true }); } catch (_) {}
    log(`minify skip ${file}: ${String((e && e.message) || e).slice(0, 100)}`);
    return null;
  }
}

// 1) 버전 (CHANGELOG 최상단 [x.y.z])
let version = '0.0.0';
try {
  const m = readFileSync('CHANGELOG.md', 'utf8').match(/^##\s*\[(\d+\.\d+\.\d+)\]/m);
  if (m) version = m[1];
} catch (_) {}
log('version', version);

// 2) 보안 스캔 — HIGH 0 게이트
log('security scan…');
const scanOut = runSafe(`${NODE} scripts/security-scan.mjs`);
const hm = scanOut.match(/HIGH\s*(\d+)/i);
const high = hm ? parseInt(hm[1], 10) : -1;
log('HIGH =', high, high === 0 ? '(ok)' : '(BLOCK)');
if (high !== 0) { console.error('[release] ABORT: security HIGH != 0 (or scan unreadable).'); process.exit(1); }

if (DRY) { log('--dry: scan passed, version', version, '— skipping deploy/commit.'); process.exit(0); }

// 2.5) 안전 미니파이 — 배포 산출물만(소스 불변, 배포 직후 복원). v2.75.0
log('minify (deploy artifact only)…');
const MIN_FILES = ['index.html', 'admin.html'];
const restoreMap = {};
for (const f of MIN_FILES) {
  const orig = minifyInPlace(f);
  if (orig != null) { restoreMap[f] = orig; log(`  ${f}: minified for deploy`); }
}

// 3) 배포 (--branch=main, 프로덕션 도메인 갱신)
log('deploy --branch=main…');
const dep = runSafe(`${DLX} wrangler pages deploy . --project-name=${PROJECT} --branch=main --commit-message="release v${version}" --commit-dirty=true`);
// 업로드 완료 직후 읽기 좋은 원본 복원(어떤 process.exit보다 먼저) — 커밋·작업트리에는 항상 원본이 남도록
for (const f of Object.keys(restoreMap)) { try { writeFileSync(f, restoreMap[f]); } catch (_) {} }
if (Object.keys(restoreMap).length) log('restored readable source');
const url = (dep.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/i) || [])[0];
if (!url) { console.error('[release] ABORT: deploy URL not found.\n', dep.slice(-600)); process.exit(1); }
log('deployed', url);

// 4) 배포URL 마커 검증 (옵션)
if (verifyArg) {
  const markers = verifyArg.split(',').map((s) => s.trim()).filter(Boolean);
  const html = runSafe(`curl -sL "https://insureconnect.co.kr/"`);
  const missing = markers.filter((mk) => !html.includes(mk));
  if (missing.length) console.error('[release] WARN: markers missing on prod:', missing.join(', '));
  else log('verify ok:', markers.join(', '));
}

// 5) 로컬 커밋 (ASCII, 임시파일로 trailer 안전 처리)
if (!NO_COMMIT) {
  runSafe('git add -A');
  try {
    writeFileSync('.release-msg.tmp', `release v${version}\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\n`);
    run('git commit -F .release-msg.tmp');
    log('committed v' + version);
  } catch (_) { log('commit skipped (nothing to commit / hook).'); }
  finally { try { rmSync('.release-msg.tmp', { force: true }); } catch (_) {} }

  // 6) GitHub push
  try {
    run('git push origin HEAD:main');
    log('pushed to github');
  } catch (e) {
    console.error('[release] GitHub push failed. Deployment may be live while GitHub is stale. Run: git push origin HEAD:main');
    console.error(String((e && e.message) || e).slice(0, 500));
    process.exit(1);
  }
  runSafe('git fetch origin --prune');
  const localHead = run('git rev-parse HEAD').trim();
  const remoteHead = run('git rev-parse origin/main').trim();
  if (localHead !== remoteHead) {
    console.error('[release] GitHub verification failed: HEAD != origin/main. Push manually before considering release complete.');
    console.error('[release] HEAD:        ' + localHead);
    console.error('[release] origin/main: ' + remoteHead);
    process.exit(1);
  }
  log('verified github sync');
}

console.log(`\n[release] OK  v${version} -> ${url}  (HIGH 0)`);
