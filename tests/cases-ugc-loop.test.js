import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { onRequestGet as diseasePage } from '../functions/cases/[disease].js';
import { onRequestGet as casesIndex } from '../functions/cases/index.js';
import { onRequestGet as casesGet } from '../functions/api/cases/index.js';
import { onRequestPatch as casePatch, queueApprovalPush } from '../functions/api/cases/[id].js';
import { insurerSlugForName } from '../functions/_lib/insurers.js';
import { mask, loadCaseContributors } from '../functions/_lib/contributors.js';

function makeEnv({ diseaseRows = [], contributorRows = [], mineRows = [], user = null } = {}) {
  const calls = [];
  const DB = {
    prepare(sql) {
      const all = async () => {
        if (sql.includes('ic_member_sessions')) return { results: [] };
        if (sql.includes('ic_insurance_cases c LEFT JOIN ic_members')) return { results: contributorRows };
        if (sql.includes('submitter_id = ?')) return { results: mineRows };
        if (sql.includes('FROM ic_insurance_cases')) return { results: diseaseRows };
        return { results: [] };
      };
      const first = async () => {
        if (sql.includes('ic_member_sessions')) return user;
        if (sql.includes('COUNT(*) AS n') && sql.includes('submitter_id = ?')) return { n: mineRows.length };
        if (sql.includes('SELECT verify_status, submitter_id')) return { verify_status: 'pending', submitter_id: 7, excellent: 0, disease: '치매' };
        return null;
      };
      const statement = { all, first, run: async () => ({ success: true }) };
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          return statement;
        },
        ...statement,
      };
    },
  };
  return { DB, calls };
}

const rows = [
  { category: 'underwrite', insurer: '삼성생명', gender: 'F', age: 34, elapsed_period: '1년', join_condition: '표준체', result: '승인', summary: '요약 1', reliability: 90, created_at: '2026-07-01' },
  { category: 'disclosure', insurer: '한화', gender: 'F', age: 42, elapsed_period: '2년', join_condition: '고지', result: '승인', summary: '요약 2', reliability: 80, created_at: '2026-07-02' },
  { category: 'claim', insurer: '현대해상', gender: 'M', age: 55, elapsed_period: '3년', join_condition: '청구', result: '지급', summary: '요약 3', reliability: 70, created_at: '2026-07-03' },
];

test('exact insurer matches link, while ambiguous aliases stay plain text', async () => {
  assert.equal(insurerSlugForName(' 삼성생명 '), 'samsung-life');
  assert.equal(insurerSlugForName('한화'), null);
  assert.equal(insurerSlugForName('없는 보험사'), null);

  const { DB } = makeEnv({ diseaseRows: rows, contributorRows: [{ nickname: '김설계사', n: 2 }] });
  const html = await (await diseasePage({ params: { disease: '치매' }, env: { DB } })).text();
  assert.match(html, /href="\/company\/samsung-life">삼성생명<\/a>/);
  assert.doesNotMatch(html, /href="\/company\/[^" ]+">한화<\/a>/);
});

test('contributor count and masked names are page-level only', async () => {
  const { DB } = makeEnv({ diseaseRows: rows, contributorRows: [{ nickname: '김설계사', n: 2 }, { nickname: '박', n: 1 }] });
  const html = await (await diseasePage({ params: { disease: '치매' }, env: { DB } })).text();
  assert.match(html, /설계사 2명의 실제 사례 기여/);
  assert.match(html, /김●●●/);
  assert.match(html, /박●/);
  assert.doesNotMatch(html, /김설계사/);
});

test('zero contributors omit the contribution section', async () => {
  const { DB } = makeEnv({ diseaseRows: rows, contributorRows: [] });
  const html = await (await diseasePage({ params: { disease: '치매' }, env: { DB } })).text();
  assert.doesNotMatch(html, /사례 기여/);
});

test('cases index renders a masked top-five leaderboard and reward CTA', async () => {
  const { DB } = makeEnv({ diseaseRows: [{ disease: '치매', count: 3, underwriting: 1 }], contributorRows: [{ nickname: '김설계사', n: 4 }] });
  const html = await (await casesIndex({ env: { DB } })).text();
  assert.match(html, /사례 기여 TOP 5/);
  assert.match(html, /김●●●/);
  assert.match(html, /제출 \+10P · 승인 \+20P · 우수 사례 \+50P/);
});

test('mine=1 requires login and returns only the current member without original_text', async () => {
  const unauth = await casesGet({ request: new Request('https://example.test/api/cases?mine=1'), env: makeEnv().DB ? makeEnv() : {} });
  assert.equal(unauth.status, 401);

  const mineRows = [
    { id: 1, disease: '치매', category: 'underwrite', verify_status: 'approved', created_at: '2026-07-01' },
    { id: 2, disease: '당뇨', category: 'claim', verify_status: 'pending', created_at: '2026-07-02' },
  ];
  const env = makeEnv({ mineRows, user: { id: 7, nickname: '김설계사', role: 'member' } });
  const res = await casesGet({
    request: new Request('https://example.test/api/cases?mine=1', { headers: { Cookie: 'ic_sess=mine-token' } }),
    env,
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.cases.length, 2);
  assert.equal(body.cases[0].page_url, '/cases/%EC%B9%98%EB%A7%A4');
  assert.equal('page_url' in body.cases[1], false);
  assert.equal(JSON.stringify(body).includes('original_text'), false);
});

test('approval push is queued only on the first pending-to-approved transition', async () => {
  const makePatch = (cur, body) => {
    const waits = [];
    const env = makeEnv({ user: null });
    env.DB.prepare = (sql) => ({
      bind(...binds) {
        return {
          first: async () => sql.includes('SELECT verify_status') ? cur : null,
          run: async () => ({ success: true }),
          all: async () => ({ results: [] }),
        };
      },
    });
    return { context: { params: { id: '1' }, request: new Request('https://example.test', { method: 'PATCH', headers: { 'x-admin-secret': 'secret' } }), env: { ...env, ADMIN_SECRET: 'secret' }, waitUntil: (p) => waits.push(p) }, body, waits };
  };

  const first = makePatch({ verify_status: 'pending', submitter_id: 7, excellent: 0, disease: '치매' }, { verify_status: 'approved' });
  const firstRes = await casePatch({ ...first.context, request: new Request('https://example.test', { method: 'PATCH', headers: { 'x-admin-secret': 'secret', 'Content-Type': 'application/json' }, body: JSON.stringify(first.body) }) });
  assert.equal(firstRes.status, 200);
  assert.ok(first.waits.length >= 1);

  const edited = makePatch({ verify_status: 'approved', submitter_id: 7, excellent: 0, disease: '치매' }, { summary: '수정' });
  const editedRes = await casePatch({ ...edited.context, request: new Request('https://example.test', { method: 'PATCH', headers: { 'x-admin-secret': 'secret', 'Content-Type': 'application/json' }, body: JSON.stringify(edited.body) }) });
  assert.equal(editedRes.status, 200);
  assert.equal(edited.waits.length, 1);

  const noSubmitter = makePatch({ verify_status: 'pending', submitter_id: null, excellent: 0, disease: '치매' }, { verify_status: 'approved' });
  const noSubmitterRes = await casePatch({ ...noSubmitter.context, request: new Request('https://example.test', { method: 'PATCH', headers: { 'x-admin-secret': 'secret', 'Content-Type': 'application/json' }, body: JSON.stringify(noSubmitter.body) }) });
  assert.equal(noSubmitterRes.status, 200);
  assert.equal(noSubmitter.waits.length, 1);
});

test('approval push failures are logged', async () => {
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const waits = [];
    await queueApprovalPush({ env: {}, waitUntil: (p) => waits.push(p) }, 7, '치매', async () => { throw new Error('push failed'); });
    await Promise.all(waits);
  } finally {
    console.error = original;
  }
  assert.ok(logs.some((args) => args[0] === '[push]'));
});

test('contributor helper masks the first character and binds disease filters', async () => {
  assert.equal(mask('김설계사'), '김●●●');
  assert.equal(mask('박'), '박●');
  const calls = [];
  const env = { DB: { prepare(sql) { return { bind(...binds) { calls.push({ sql, binds }); return { all: async () => ({ results: [] }) }; } }; } } };
  await loadCaseContributors(env, ' 치매 ', 3);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].sql.includes('TRIM(COALESCE(c.disease,\'\')) = ?'));
  assert.deepEqual(calls[0].binds, ['치매', 3]);
});

test('member page and case form expose the UGC loop copy', () => {
  const meSource = readFileSync(new URL('../functions/me.js', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(meSource, /\/api\/cases\?mine=1/);
  assert.match(meSource, /검수중/);
  assert.match(meSource, /게시됨/);
  assert.match(meSource, /반려/);
  assert.match(indexSource, /제출 \+10P · 승인 \+20P · 우수 사례 \+50P/);
  assert.match(indexSource, /승인된 사례는 질병별 페이지에 게시됩니다/);
  assert.match(indexSource, /닉네임은 마스킹된 집계로만 표시/);
});

console.log('cases UGC loop tests: ok');
