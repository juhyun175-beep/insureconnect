/**
 * v2.137.0: 홈 제휴 파트너 존 + 파트너 API + B2B 스트립 + 푸터/문구 정비 테스트
 *
 *   - 소스 문자열의 공백·속성 순서에 과도하게 의존하지 않도록 토큰 단위로 검증한다.
 *   - 파트너 API는 mock D1(인메모리)로 공개/관리자 경계·검증·소프트 삭제를 검증한다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const indexHtml = read('index.html');
const adminHtml = read('admin.html');
const aboutHtml = read('about.html');
const contactHtml = read('contact.html');
const termsHtml = read('terms.html');
const disclaimerHtml = read('disclaimer.html');
const partnersApi = read('functions/api/partners/index.js');
const partnersIdApi = read('functions/api/partners/[id].js');
const schemaSql = read('schema.sql');
const migrationSql = read('migrations/d1_v2_137_0_partners.sql');

// 홈 파트너 존 로더 스크립트 · B2B 스트립을 소스에서 추출(구획 단위 검증용)
function extractScript(html, marker) {
  const idx = html.indexOf(marker);
  assert(idx >= 0, `script marker not found: ${marker}`);
  const open = html.lastIndexOf('<script>', idx);
  const close = html.indexOf('</script>', idx);
  assert(open >= 0 && close > open, `script bounds not found for: ${marker}`);
  return html.slice(open + '<script>'.length, close);
}
function extractSection(html, startNeedle, endNeedle) {
  const s = html.indexOf(startNeedle);
  assert(s >= 0, `section start not found: ${startNeedle}`);
  const e = html.indexOf(endNeedle, s);
  assert(e > s, `section end not found: ${endNeedle}`);
  return html.slice(s, e + endNeedle.length);
}

const partnerScript = extractScript(indexHtml, '제휴 서비스 존 로더');
const b2bSection = extractSection(indexHtml, 'id="b2b-partner"', '</section>');

// ── ESM 모듈 지연 로드 ─────────────────────────────────────────────
let _mods;
async function mods() {
  if (!_mods) {
    _mods = {
      index: await import(pathToFileURL(path.join(root, 'functions/api/partners/index.js')).href),
      byId: await import(pathToFileURL(path.join(root, 'functions/api/partners/[id].js')).href),
      lib: await import(pathToFileURL(path.join(root, 'functions/_lib/partners.js')).href),
    };
  }
  return _mods;
}

// ── mock D1 (인메모리) ─────────────────────────────────────────────
function selectCols(sql) {
  const m = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
  return m ? m[1].split(',').map((s) => s.trim()) : [];
}
function insertCols(sql) {
  const m = sql.match(/INSERT INTO\s+\w+\s*\(([^)]+)\)/i);
  return m ? m[1].split(',').map((s) => s.trim()) : [];
}
function updateSetCols(sql) {
  const m = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim())
    .filter((s) => /=\s*\?/.test(s))
    .map((s) => s.split('=')[0].trim());
}
function makeDb(seed = []) {
  let auto = seed.reduce((mx, r) => Math.max(mx, r.id || 0), 0);
  const rows = seed.map((r) => Object.assign(
    { tagline: null, category: null, img: null, sort_order: 0, is_active: 1, created_at: 't0', updated_at: 't0', deleted_at: null }, r,
  ));
  function prepare(sql) {
    let bound = [];
    const stmt = {
      bind(...v) { bound = v; return stmt; },
      async all() {
        let res = rows.filter((r) => r.deleted_at == null);
        if (/is_active\s*=\s*1/.test(sql)) res = res.filter((r) => r.is_active === 1);
        res = res.slice().sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
        if (/LIMIT\s+12/.test(sql)) res = res.slice(0, 12);
        const cols = selectCols(sql);
        return { results: res.map((r) => { const o = {}; cols.forEach((c) => { o[c] = r[c]; }); return o; }) };
      },
      async first() {
        if (/^\s*INSERT/i.test(sql)) {
          const cols = insertCols(sql);
          const row = { id: ++auto, name: null, tagline: null, category: null, href: null, img: null, sort_order: 0, is_active: 1, created_at: 't0', updated_at: 't0', deleted_at: null };
          cols.forEach((c, i) => { row[c] = bound[i]; });
          rows.push(row);
          return { id: row.id };
        }
        // 존재 확인: SELECT id ... WHERE id = ? AND deleted_at IS NULL
        const id = bound[0];
        const found = rows.find((r) => r.id === id && r.deleted_at == null);
        return found ? { id: found.id } : null;
      },
      async run() {
        // 소프트 삭제
        if (/is_active\s*=\s*0/.test(sql) && /deleted_at\s*=\s*datetime/.test(sql)) {
          const id = bound[bound.length - 1];
          const row = rows.find((r) => r.id === id && r.deleted_at == null);
          if (!row) return { meta: { changes: 0 } };
          row.is_active = 0; row.deleted_at = 'tDel'; row.updated_at = 'tDel';
          return { meta: { changes: 1 } };
        }
        if (/^\s*UPDATE/i.test(sql)) {
          const id = bound[bound.length - 1];
          const setCols = updateSetCols(sql);
          const row = rows.find((r) => r.id === id && r.deleted_at == null);
          if (!row) return { meta: { changes: 0 } };
          setCols.forEach((c, i) => { row[c] = bound[i]; });
          if (/updated_at\s*=\s*datetime/.test(sql)) row.updated_at = 'tPatch';
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
    };
    return stmt;
  }
  return { rows, prepare };
}
const SECRET = 'test-secret';
function envWith(db) { return { DB: db, ADMIN_SECRET: SECRET }; }
function req(url, { method = 'GET', admin = false, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers['x-admin-secret'] = SECRET;
  return new Request(url, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
}

// ════════════════════════════════════════════════════════════════
//  파트너 존 (홈 index.html)
// ════════════════════════════════════════════════════════════════

test('1. 홈에 제휴 파트너 존 마크업 존재', () => {
  assert(indexHtml.includes('id="home-partner-zone"'), 'partner zone section missing');
  assert(indexHtml.includes('id="pz-grid"'), 'partner grid missing');
});

test('2. 섹션 헤더와 각 카드에 AD 표시', () => {
  assert(/class="pz-ad"[^>]*>AD</.test(indexHtml), 'header AD badge missing');
  assert(partnerScript.includes("ad.className = 'pz-card-ad'"), 'card AD element missing');
  assert(partnerScript.includes("ad.textContent = 'AD'"), 'card AD text missing');
});

test('3. 파트너 링크 rel 토큰에 sponsored/nofollow/noopener/noreferrer 포함', () => {
  const m = partnerScript.match(/a\.rel\s*=\s*'([^']+)'/);
  assert(m, 'rel assignment missing');
  const tokens = m[1].split(/\s+/);
  ['noopener', 'noreferrer', 'nofollow', 'sponsored'].forEach((t) => {
    assert(tokens.includes(t), `rel token missing: ${t}`);
  });
});

test('4. 카드 하단 광고 고지 문구 존재', () => {
  assert(indexHtml.includes('위 서비스는 제휴 파트너의 광고이며, 신청·상담·계약은 각 파트너사에서 직접 진행됩니다.'),
    'partner zone disclosure text missing');
});

test('5/6. 존은 기본 숨김 · 빈배열/오류 시 노출하지 않음', () => {
  assert(/id="home-partner-zone"[^>]*style="display:none"/.test(indexHtml), 'zone should start hidden');
  // 빈 배열 가드
  assert(/!Array\.isArray\(list\)\s*\|\|\s*!list\.length\)\s*return/.test(partnerScript), 'empty-array guard missing');
  // 오류 시 숨김 유지 — catch 존재, 노출은 성공 경로에서만 1회
  assert(partnerScript.includes('.catch(function(){'), 'catch handler missing');
  const shows = partnerScript.match(/section\.style\.display\s*=\s*''/g) || [];
  assert.strictEqual(shows.length, 1, 'zone should be shown exactly once (success path only)');
  const showIdx = partnerScript.indexOf("section.style.display = ''");
  const appendIdx = partnerScript.indexOf('grid.appendChild(frag)');
  assert(appendIdx >= 0 && showIdx > appendIdx, 'zone shown only after cards appended');
});

test('7. 추적키가 파트너명이 아니라 partner.id 기반', () => {
  assert(partnerScript.includes("trackClick('partner-' + p.id, 'partner')"), 'id-based tracking key missing');
  assert(!/trackClick\([^)]*p\.name/.test(partnerScript), 'tracking must not use partner name');
});

test('8. name/tagline/category는 textContent로 렌더(HTML 실행 안 함)', () => {
  assert(partnerScript.includes('nameEl.textContent = nm'), 'name should render via textContent');
  assert(partnerScript.includes('tag.textContent = String(p.tagline)'), 'tagline should render via textContent');
  assert(partnerScript.includes('chip.textContent = String(p.category)'), 'category should render via textContent');
  // 카드 빌더가 innerHTML 문자열 보간을 쓰지 않음
  assert(!partnerScript.includes('.innerHTML'), 'partner card builder must not use innerHTML');
});

test('9. 외부 이미지에 loading/decoding/referrerpolicy 적용', () => {
  assert(partnerScript.includes("img.loading = 'lazy'"), 'img loading=lazy missing');
  assert(partnerScript.includes("img.decoding = 'async'"), 'img decoding=async missing');
  assert(partnerScript.includes("img.referrerPolicy = 'no-referrer'"), 'img referrerpolicy missing');
  assert(!/icImg\(/.test(partnerScript), 'external partner images must not use icImg()');
});

test('10. 이미지 실패 시 이니셜 폴백(addEventListener 사용)', () => {
  assert(partnerScript.includes("img.addEventListener('error'"), 'image error listener missing');
  assert(partnerScript.includes('thumb.textContent = initial(nm)'), 'initial fallback missing');
  assert(!/onerror\s*=/.test(partnerScript), 'inline onerror must not be used');
});

test('홈 파트너 존/ B2B 스크립트가 문법적으로 유효', () => {
  assert.doesNotThrow(() => new vm.Script(partnerScript, { filename: 'index.html#partner-zone' }));
  const b2bScript = extractScript(indexHtml, 'B2B 카카오톡 CTA는 푸터');
  assert.doesNotThrow(() => new vm.Script(b2bScript, { filename: 'index.html#b2b-sync' }));
});

// ════════════════════════════════════════════════════════════════
//  파트너 API
// ════════════════════════════════════════════════════════════════

test('11. GET /api/partners?active=1 은 공개 접근 가능', async () => {
  const { index } = await mods();
  const db = makeDb([{ id: 1, name: 'A', href: 'https://a.example', is_active: 1 }]);
  const res = await index.onRequestGet({ request: req('https://x/api/partners?active=1'), env: envWith(db) });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert(Array.isArray(body) && body.length === 1);
});

test('12. active=1 이 아닌 GET(빈값·다른값·미지정)은 관리자 인증 요구', async () => {
  const { index } = await mods();
  for (const q of ['?active=0', '?active=', '?active=2', '']) {
    const db = makeDb([{ id: 1, name: 'A', href: 'https://a.example' }]);
    const res = await index.onRequestGet({ request: req('https://x/api/partners' + q), env: envWith(db) });
    assert.strictEqual(res.status, 401, `GET ${q} should require admin`);
  }
  // 관리자 시크릿이 있으면 200
  const db = makeDb([{ id: 1, name: 'A', href: 'https://a.example' }]);
  const ok = await index.onRequestGet({ request: req('https://x/api/partners', { admin: true }), env: envWith(db) });
  assert.strictEqual(ok.status, 200);
});

test('13/14/15. 공개 조회: 활성·미삭제만, 공개 컬럼만, sort ASC·최대 12', async () => {
  const { index } = await mods();
  const seed = [];
  for (let i = 1; i <= 15; i += 1) seed.push({ id: i, name: 'P' + i, href: 'https://p' + i + '.example', sort_order: 20 - i, is_active: 1 });
  seed.push({ id: 100, name: 'inactive', href: 'https://x.example', is_active: 0, sort_order: -50 });
  seed.push({ id: 101, name: 'deleted', href: 'https://y.example', is_active: 1, sort_order: -60, deleted_at: 'tDel' });
  const db = makeDb(seed);
  const res = await index.onRequestGet({ request: req('https://x/api/partners?active=1'), env: envWith(db) });
  const body = await res.json();
  // 최대 12
  assert.strictEqual(body.length, 12, 'public list capped at 12');
  // 비활성·삭제 제외
  assert(!body.some((r) => r.name === 'inactive'), 'inactive card leaked');
  assert(!body.some((r) => r.name === 'deleted'), 'deleted card leaked');
  // 공개 컬럼만
  const allowed = ['id', 'name', 'tagline', 'category', 'href', 'img'];
  body.forEach((r) => {
    assert.deepStrictEqual(Object.keys(r).sort(), allowed.slice().sort(), 'public response exposes only public columns');
    ['sort_order', 'is_active', 'created_at', 'updated_at', 'deleted_at'].forEach((k) => {
      assert(!(k in r), `private column leaked: ${k}`);
    });
  });
  // 정렬 sort_order ASC, id ASC
  for (let i = 1; i < body.length; i += 1) {
    // sort_order 는 응답에 없으므로 seed 매핑으로 확인
    const prev = seed.find((s) => s.name === body[i - 1].name);
    const cur = seed.find((s) => s.name === body[i].name);
    assert(prev.sort_order <= cur.sort_order, 'not sorted by sort_order ASC');
  }
});

test('16. POST/PATCH/DELETE 에 verifyAdmin 가드', async () => {
  const { index, byId } = await mods();
  const db = makeDb([{ id: 1, name: 'A', href: 'https://a.example' }]);
  const post = await index.onRequestPost({ request: req('https://x/api/partners', { method: 'POST', body: { name: 'B', href: 'https://b.example' } }), env: envWith(db) });
  assert.strictEqual(post.status, 401, 'POST requires admin');
  const patch = await byId.onRequestPatch({ params: { id: '1' }, request: req('https://x/api/partners/1', { method: 'PATCH', body: { name: 'B' } }), env: envWith(db) });
  assert.strictEqual(patch.status, 401, 'PATCH requires admin');
  const del = await byId.onRequestDelete({ params: { id: '1' }, request: req('https://x/api/partners/1', { method: 'DELETE' }), env: envWith(db) });
  assert.strictEqual(del.status, 401, 'DELETE requires admin');
});

test('17. 위험 프로토콜 URL 거부 (javascript/data/file/ftp/blob)', async () => {
  const { index } = await mods();
  const bad = ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://h/x', 'blob:https://h/uuid'];
  for (const href of bad) {
    const db = makeDb();
    const res = await index.onRequestPost({ request: req('https://x/api/partners', { method: 'POST', admin: true, body: { name: 'N', href } }), env: envWith(db) });
    assert.strictEqual(res.status, 400, `href must be rejected: ${href}`);
    assert.strictEqual(db.rows.length, 0, 'no row inserted for bad url');
  }
  // img 도 동일
  const db = makeDb();
  const res = await index.onRequestPost({ request: req('https://x/api/partners', { method: 'POST', admin: true, body: { name: 'N', href: 'https://ok.example', img: 'javascript:alert(1)' } }), env: envWith(db) });
  assert.strictEqual(res.status, 400, 'bad img url must be rejected');
});

test('18. 잘못된 sort_order/is_active/길이 초과 거부', async () => {
  const { index } = await mods();
  const cases = [
    { name: 'x'.repeat(61), href: 'https://ok.example' },                 // name 초과
    { name: 'N', href: 'https://ok.example', tagline: 't'.repeat(121) },  // tagline 초과
    { name: 'N', href: 'https://ok.example', category: 'c'.repeat(31) },  // category 초과
    { name: 'N', href: 'https://ok.example', sort_order: 99999 },         // sort 범위 초과
    { name: 'N', href: 'https://ok.example', sort_order: 'abc' },         // sort 비정수
    { name: 'N', href: 'https://ok.example', is_active: 2 },              // is_active 이상값
    { name: 'N', href: 'https://ok.example', is_active: 'yes' },          // is_active 문자열
  ];
  for (const body of cases) {
    const db = makeDb();
    const res = await index.onRequestPost({ request: req('https://x/api/partners', { method: 'POST', admin: true, body }), env: envWith(db) });
    assert.strictEqual(res.status, 400, `should reject: ${JSON.stringify(body)}`);
  }
});

test('19. PATCH 는 서버 관리 필드를 변경하지 못함', async () => {
  const { byId } = await mods();
  const db = makeDb([{ id: 7, name: 'Old', href: 'https://old.example', created_at: 'C0', deleted_at: null }]);
  const res = await byId.onRequestPatch({
    params: { id: '7' },
    request: req('https://x/api/partners/7', { method: 'PATCH', admin: true, body: { name: 'New', id: 999, created_at: 'evil', updated_at: 'evil', deleted_at: 'evil' } }),
    env: envWith(db),
  });
  assert.strictEqual(res.status, 200);
  const row = db.rows.find((r) => r.id === 7);
  assert.strictEqual(row.name, 'New', 'allowed field updated');
  assert.strictEqual(row.id, 7, 'id must not change');
  assert.strictEqual(row.created_at, 'C0', 'created_at must not change');
  assert.strictEqual(row.deleted_at, null, 'deleted_at must not be set via patch');
  // 허용 필드가 하나도 없으면 400
  const db2 = makeDb([{ id: 8, name: 'X', href: 'https://x.example' }]);
  const empty = await byId.onRequestPatch({ params: { id: '8' }, request: req('https://x/api/partners/8', { method: 'PATCH', admin: true, body: { id: 5, deleted_at: 'x' } }), env: envWith(db2) });
  assert.strictEqual(empty.status, 400, 'patch with no allowed fields must be 400');
});

test('20/21/22. DELETE 는 소프트 삭제 · 목록 제외 · updated_at 갱신', async () => {
  const { index, byId } = await mods();
  const db = makeDb([{ id: 3, name: 'Del', href: 'https://d.example', is_active: 1, updated_at: 't0' }]);
  const res = await byId.onRequestDelete({ params: { id: '3' }, request: req('https://x/api/partners/3', { method: 'DELETE', admin: true }), env: envWith(db) });
  assert.strictEqual(res.status, 200);
  const row = db.rows.find((r) => r.id === 3);
  assert(row, 'row must physically remain (soft delete)');
  assert.strictEqual(row.is_active, 0, 'is_active set to 0');
  assert(row.deleted_at != null, 'deleted_at set');
  assert.notStrictEqual(row.updated_at, 't0', 'updated_at refreshed on delete');
  // 공개·관리자 목록에서 제외
  const pub = await index.onRequestGet({ request: req('https://x/api/partners?active=1'), env: envWith(db) });
  assert.strictEqual((await pub.json()).length, 0, 'deleted card excluded from public list');
  const adm = await index.onRequestGet({ request: req('https://x/api/partners', { admin: true }), env: envWith(db) });
  assert.strictEqual((await adm.json()).length, 0, 'deleted card excluded from admin list');
  // 이미 삭제된 ID 재삭제 → 404
  const again = await byId.onRequestDelete({ params: { id: '3' }, request: req('https://x/api/partners/3', { method: 'DELETE', admin: true }), env: envWith(db) });
  assert.strictEqual(again.status, 404, 'deleting already-deleted id is 404');
});

test('PATCH: 존재하지 않는 ID는 404 · updated_at 갱신', async () => {
  const { byId } = await mods();
  const db = makeDb([{ id: 5, name: 'A', href: 'https://a.example', updated_at: 't0' }]);
  const notFound = await byId.onRequestPatch({ params: { id: '999' }, request: req('https://x/api/partners/999', { method: 'PATCH', admin: true, body: { name: 'Z' } }), env: envWith(db) });
  assert.strictEqual(notFound.status, 404);
  const ok = await byId.onRequestPatch({ params: { id: '5' }, request: req('https://x/api/partners/5', { method: 'PATCH', admin: true, body: { name: 'Z' } }), env: envWith(db) });
  assert.strictEqual(ok.status, 200);
  assert.notStrictEqual(db.rows.find((r) => r.id === 5).updated_at, 't0', 'updated_at refreshed on patch');
});

test('API 소스: 소프트 삭제·updated_at 유지 · no-store', () => {
  assert(partnersIdApi.includes("deleted_at = datetime('now')"), 'DELETE must soft-delete');
  assert(partnersIdApi.includes('is_active = 0'), 'DELETE must set is_active=0');
  assert(!/DELETE\s+FROM\s+ic_partner_cards/i.test(partnersIdApi), 'must not hard-delete');
  const patchIdx = partnersIdApi.indexOf('onRequestPatch');
  const delIdx = partnersIdApi.indexOf('onRequestDelete');
  assert(partnersIdApi.slice(patchIdx, delIdx).includes("updated_at = datetime('now')"), 'PATCH updates updated_at');
  assert(partnersIdApi.slice(delIdx).includes("updated_at = datetime('now')"), 'DELETE updates updated_at');
});

test('lib: buildPartnerWrite/isSafeUrl 검증 로직', async () => {
  const { lib } = await mods();
  assert.strictEqual(lib.isSafeUrl('https://ok.example'), true);
  assert.strictEqual(lib.isSafeUrl('http://ok.example'), true);
  ['javascript:x', 'data:x', 'file:///x', 'ftp://x', 'blob:https://x/y', '', '   '].forEach((u) => {
    assert.strictEqual(lib.isSafeUrl(u), false, `unsafe url: ${u}`);
  });
  // 허용 필드만 추출 — 임의 키 무시
  const built = lib.buildPartnerWrite({ name: 'N', href: 'https://ok.example', evil: 'x', deleted_at: 'z' }, { partial: false });
  assert(!built.error, 'valid input should build');
  assert(!built.columns.includes('evil'), 'arbitrary key must be dropped');
  assert(!built.columns.includes('deleted_at'), 'server field must be dropped');
});

// ════════════════════════════════════════════════════════════════
//  B2B 스트립 · 푸터
// ════════════════════════════════════════════════════════════════

test('23. id="b2b-partner" 존재', () => {
  assert(indexHtml.includes('id="b2b-partner"'), 'b2b anchor missing');
  assert(b2bSection.includes('인슈어커넥트에 광고·제휴하기'), 'b2b headline missing');
});

test('24. 인코딩된 정적 mailto 링크(런타임 인코딩 없음)', () => {
  assert(b2bSection.includes('mailto:insureconnect@naver.com?subject=%5B%EA%B4%91%EA%B3%A0%C2%B7%EC%A0%9C%ED%9C%B4%20%EB%AC%B8%EC%9D%98%5D%20'),
    'encoded static mailto missing');
  assert(!/encodeURIComponent/.test(b2bSection), 'must not call encodeURIComponent in markup');
});

test('25. 카카오톡 CTA 가 기존 운영자 오픈채팅 링크 재사용', () => {
  // 푸터 운영자 문의 링크
  assert(/foot-links[\s\S]*open\.kakao\.com\/o\/sAZWQ7pi/.test(indexHtml), 'footer operator kakao link missing');
  // B2B 카카오 CTA 가 동일 URL 사용
  assert(b2bSection.includes('https://open.kakao.com/o/sAZWQ7pi'), 'b2b kakao must reuse operator openchat url');
  assert(b2bSection.includes('data-ic-operator-kakao'), 'b2b kakao should mark operator-kakao source');
});

test('26. b2b-inquiry / b2b-kakao 이벤트 키 존재', () => {
  assert(b2bSection.includes("trackCardClick('home','b2b-inquiry')") || b2bSection.includes("trackCardClick('home', 'b2b-inquiry')"), 'b2b-inquiry event key missing');
  assert(b2bSection.includes("trackCardClick('home','b2b-kakao')") || b2bSection.includes("trackCardClick('home', 'b2b-kakao')"), 'b2b-kakao event key missing');
});

test('27. B2B 카피에 시점형 숫자(회원수 등) 하드코딩 없음', () => {
  const title = (b2bSection.match(/class="b2b-title">([^<]*)</) || [])[1] || '';
  const sub = (b2bSection.match(/class="b2b-sub">([^<]*)</) || [])[1] || '';
  assert(title.length > 0 && sub.length > 0, 'b2b copy extractable');
  assert(!/\d/.test(title), 'b2b title should not hardcode numbers');
  assert(!/\d/.test(sub), 'b2b sub should not hardcode numbers');
});

test('28/33. 푸터: 광고 게재 매체 고지 + 보험 판매·중개·자문 면책 유지', () => {
  assert(indexHtml.includes('본 서비스는 보험 상품 판매·중개·자문을 하지 않으며, 정보 안내 도구입니다.'), 'insurance disclaimer must remain');
  assert(/foot-note[\s\S]*광고 게재 매체/.test(indexHtml), 'ad media notice missing in footer');
});

test('29/30. 푸터 광고·제휴 링크: 홈 #b2b-partner, 홈 외 /#b2b-partner', () => {
  assert(/foot-links[\s\S]*<a href="#b2b-partner">광고·제휴<\/a>/.test(indexHtml), 'home footer 광고·제휴 → #b2b-partner missing');
  [aboutHtml, contactHtml, disclaimerHtml].forEach((html) => {
    assert(html.includes('<a href="/#b2b-partner">광고·제휴</a>'), 'non-home footer 광고·제휴 → /#b2b-partner missing');
  });
});

// ════════════════════════════════════════════════════════════════
//  문구 정비 · 약관 · 면책
// ════════════════════════════════════════════════════════════════

const publicPages = { 'index.html': indexHtml, 'about.html': aboutHtml, 'contact.html': contactHtml, 'terms.html': termsHtml, 'disclaimer.html': disclaimerHtml };

test('31. 사용자 노출 페이지에 "비영리" 없음', () => {
  Object.entries(publicPages).forEach(([name, html]) => {
    assert(!html.includes('비영리'), `비영리 must be removed from ${name}`);
  });
});

test('32. "회원가입 없음" 등 현행 구조 불일치 문구 없음', () => {
  Object.entries(publicPages).forEach(([name, html]) => {
    assert(!html.includes('회원가입 없음'), `회원가입 없음 must be removed from ${name}`);
  });
  assert(!aboutHtml.includes('무료 서비스 운영 원칙'), 'about heading must be updated');
  assert(aboutHtml.includes('운영: 인슈어커넥트 (대표 최주현)'), 'about signature updated');
  assert(contactHtml.includes('운영: 인슈어커넥트 (대표 최주현)'), 'contact signature updated');
});

test('34. terms.html: 직접 게재 광고 + 광고매체 조항', () => {
  assert(termsHtml.includes('직접 판매·게재하는 제휴 광고'), 'direct-placement ad clause missing');
  assert(termsHtml.includes('광고 게재 매체로서'), 'ad media clause missing');
  assert(termsHtml.includes('판매·계약 당사자가 아닙니다'), 'not-a-party clause missing');
  assert(termsHtml.includes('AD를 표시'), 'AD label clause missing');
});

test('35. disclaimer.html: AD 표시 + 파트너 직접 상담·계약 + 판매·중개 당사자 아님', () => {
  assert(disclaimerHtml.includes('AD'), 'AD marker missing');
  assert(disclaimerHtml.includes('신청·상담·계약은 각 파트너사에서 직접 진행'), 'partner direct handling clause missing');
  assert(disclaimerHtml.includes('판매·중개·계약 당사자가 아닙니다'), 'not-a-party clause missing');
  // 기존 AdSense 자동 광고 설명 유지
  assert(disclaimerHtml.includes('Google AdSense'), 'existing AdSense clause must remain');
});

test('36. 광고 거절·중단 권한 문구 존재', () => {
  assert(termsHtml.includes('거절·중단·삭제할 수 있습니다'), 'terms ad refusal clause missing');
  assert(disclaimerHtml.includes('게재를 거절·중단할 수 있습니다'), 'disclaimer ad refusal clause missing');
});

// ════════════════════════════════════════════════════════════════
//  관리자 · D1
// ════════════════════════════════════════════════════════════════

test('관리자 페이지에 제휴 파트너 관리 섹션', () => {
  assert(adminHtml.includes('id="up-partners"'), 'admin partner panel missing');
  assert(adminHtml.includes("'up-partners': loadPartners"), 'admin loader registration missing');
  ['function savePartner', 'function loadPartners', 'function savePartnerEdit', 'function togglePartner', 'function deletePartner']
    .forEach((fn) => assert(adminHtml.includes(fn), `admin fn missing: ${fn}`));
  assert(/deletePartner[\s\S]{0,200}confirm\(/.test(adminHtml), 'delete confirmation missing');
});

test('D1: ic_partner_cards 마이그레이션·스키마 동기화', () => {
  [migrationSql, schemaSql].forEach((sql) => {
    assert(/CREATE TABLE IF NOT EXISTS ic_partner_cards/.test(sql), 'table def missing');
    assert(/deleted_at\s+TEXT/.test(sql), 'deleted_at column missing');
    assert(/is_active\s+INTEGER NOT NULL DEFAULT 1 CHECK/.test(sql), 'is_active check constraint missing');
    assert(/idx_partner_cards_active_sort/.test(sql), 'index missing');
  });
  // 특정 파트너 시드 데이터 없음
  assert(!/INSERT INTO ic_partner_cards/i.test(migrationSql), 'migration must not seed partner rows');
});

console.log('home partner zone / API / footer / copy tests defined');
