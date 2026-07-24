/**
 * v2.138.1 + v2.139.0: 레거시 DB(폐기 수파베이스) 의존 재유입 + 관리자 로드/외부화 회귀 방지
 *
 *   v2.139.0 방침: '단어' 매칭이 아니라 '살아있는 의존' 3패턴만 감시한다.
 *   이력 주석·문서 속 벤더명(예: "Supabase")은 아무것도 호출하지 않으므로 잡지 않는다.
 *     1) 폐기 프로젝트 도메인(살아있는 외부 호출)
 *     2) JWT 로 보이는 하드코딩 자격증명
 *     3) 벤더 환경변수/상수 접두어 잔재
 *   스캐너 자기참조 회피: 환경변수 패턴은 조각으로 조립, 도메인/JWT 패턴은 이스케이프라
 *   이 파일 자신엔 걸리지 않는다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const adminHtml = read('admin.html');
const indexHtml = read('index.html');
const deployYml = read('.github/workflows/deploy.yml');
const releaseMjs = read('scripts/release.mjs');
const knowledgeIdJs = read('functions/knowledge/[id].js');

// '살아있는 의존' 3패턴 — 매 호출 새 인스턴스로 반환(global lastIndex 상태 회피)
const LEGACY_URL = () => /supabase\.co/gi;                       // 폐기 프로젝트 도메인
const JWT_CRED   = () => /eyJ[A-Za-z0-9_-]{15,}\./g;             // JWT 형태 자격증명
const LEGACY_ENV = () => new RegExp('SUPABASE' + '_[A-Z_]*', 'g'); // 환경변수/상수 접두어(자기참조 회피 조립)
const LIVE_PATTERNS = [
  ['legacy-url', LEGACY_URL],
  ['hardcoded-jwt', JWT_CRED],
  ['legacy-env', LEGACY_ENV],
];

function walkFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === '.wrangler') continue;
    const p = path.join(dir, e);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p, exts));
    else if (exts.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
}

test('1. admin.html 에 SB_ANON(미선언 변수 버그) 없음', () => {
  assert.strictEqual((adminHtml.match(/SB_ANON/g) || []).length, 0,
    'SB_ANON 참조가 admin.html 에 남아 있으면 안 된다');
});

test('2. index.html 에 SB_ANON 없음', () => {
  assert.strictEqual((indexHtml.match(/SB_ANON/g) || []).length, 0, 'index.html SB_ANON leak');
});

test('3. adminLoadFail 헬퍼 1건 + 로더 호출 22회 이상', () => {
  const defs = adminHtml.match(/function adminLoadFail\s*\(/g) || [];
  assert.strictEqual(defs.length, 1, 'adminLoadFail 헬퍼 정의는 정확히 1건이어야 한다');
  const total = adminHtml.match(/adminLoadFail\s*\(/g) || [];
  const calls = total.length - defs.length;
  assert(calls >= 22, `adminLoadFail 호출은 22회 이상이어야 한다(현재 ${calls})`);
});

test('4. deploy.yml 이 index.html·admin.html 둘 다 외부화', () => {
  assert(deployYml.includes('externalize.mjs index.html admin.html'),
    'deploy.yml 외부화 단계가 admin.html 을 포함해야 한다');
});

test('5. release.mjs 가 externalize 를 MIN_FILES 기준으로 실행', () => {
  assert(releaseMjs.includes("scripts/externalize.mjs ${MIN_FILES.join(' ')}"),
    'release.mjs 는 MIN_FILES 전체를 외부화해야 한다');
  assert(/MIN_FILES\s*=\s*\[[^\]]*'admin\.html'/.test(releaseMjs),
    'MIN_FILES 에 admin.html 이 포함돼야 한다');
});

// ── v2.139.0: '살아있는 의존' 3패턴 (단어 매칭 아님) ─────────────────
test('6. 레포 전역(.js/.html/.mjs)에 살아있는 레거시 DB 의존 0건', () => {
  const files = walkFiles(root, ['.js', '.html', '.mjs']);
  const hits = [];
  for (const p of files) {
    const t = fs.readFileSync(p, 'utf8');
    for (const [label, reOf] of LIVE_PATTERNS) {
      const m = t.match(reOf());
      if (m) hits.push(`${path.relative(root, p)} :: ${label} (${m.length})`);
    }
  }
  assert.deepStrictEqual(hits, [], `살아있는 레거시 의존 발견:\n${hits.join('\n')}`);
});

test('7. functions/knowledge/[id].js: 레거시 상수·외부 fetch 제거, D1 사용', () => {
  ['SB_URL', 'SB_ANON', 'SB_HDR'].forEach((k) => {
    assert.strictEqual((knowledgeIdJs.match(new RegExp(k, 'g')) || []).length, 0,
      `${k} 상수가 남아 있으면 안 된다`);
  });
  for (const [label, reOf] of LIVE_PATTERNS) {
    assert.strictEqual((knowledgeIdJs.match(reOf()) || []).length, 0,
      `knowledge/[id].js 에 ${label} 잔재`);
  }
  assert.strictEqual((knowledgeIdJs.match(/fetch\s*\(/g) || []).length, 0,
    '외부 fetch 호출이 남아 있으면 안 된다(D1 전환)');
  assert(/env\.DB\.prepare/.test(knowledgeIdJs), 'D1 env.DB.prepare 사용이 있어야 한다');
});

test('8. index.html: 보험지식 진입점 제거, 데이터센터 프리뷰 1건 유지', () => {
  assert.strictEqual(
    (indexHtml.match(/<button[^>]*ic-m-core-card[^>]*goToPage\('knowledge'\)/g) || []).length, 0,
    '모바일 코어카드 보험지식 진입점이 남아 있으면 안 된다');
  assert.strictEqual(
    (indexHtml.match(/id:\s*'knowledge'/g) || []).length, 0,
    'NAV_PAGES 보험지식 항목이 남아 있으면 안 된다');
  const gotos = (indexHtml.match(/goToPage\('knowledge'\)/g) || []).length;
  assert.strictEqual(gotos, 1,
    `goToPage('knowledge')는 데이터센터 프리뷰 1건만 남아야 한다(현재 ${gotos})`);
});

console.log('admin/knowledge legacy-dependency regression tests defined');
