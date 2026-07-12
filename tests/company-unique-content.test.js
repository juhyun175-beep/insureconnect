import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSURERS, INSURER_ALIASES, insurerNames } from '../functions/_lib/insurers.js';
import { loadCompanyContent } from '../functions/_lib/company-content.js';
import { loadCompanyLastmods } from '../functions/sitemap.xml.js';

test('insurer aliases include the official name without absorbing known typo data', () => {
  assert.equal(INSURERS.length, 32);
  for (const ins of INSURERS) {
    const names = insurerNames(ins.slug);
    assert.ok(names.includes(ins.name), `${ins.slug} official name`);
    assert.equal(names.length, new Set(names).size, `${ins.slug} aliases are unique`);
  }
  assert.deepEqual(insurerNames('lotte-insurance'), ['롯데손해보험', '롯데손보']);
  assert.ok(insurerNames('db-insurance').includes('DB'));
  assert.ok(!Object.values(INSURER_ALIASES).flat().includes('라이프생명'));
});

test('company content loads three bound queries concurrently', async () => {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const DB = {
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          return {
            async all() {
              active += 1;
              maxActive = Math.max(maxActive, active);
              await new Promise((resolve) => setTimeout(resolve, 5));
              active -= 1;
              if (sql.includes('ic_product_coverages')) return { results: [{ coverage_name: '암', join_amount: '1억' }] };
              if (sql.includes('ic_insurance_cases')) return { results: [{ disease: '암', reliability: 80 }] };
              return { results: [{ id: 7, title: '삼성생명 이야기' }] };
            },
          };
        },
      };
    },
  };
  const ins = INSURERS.find((item) => item.slug === 'samsung-life');
  const result = await loadCompanyContent({ DB }, ins);

  assert.equal(maxActive, 3);
  assert.equal(calls.length, 3);
  assert.equal(result.coverages.length, 1);
  assert.equal(result.cases.length, 1);
  assert.equal(result.boardPosts.length, 1);
  assert.match(calls[0].sql, /insurer IN \(\?, \?, \?, \?, \?, \?, \?, \?\)/);
  assert.match(calls[0].sql, /TRIM\(join_amount\) NOT IN \('', '-'\)/);
  assert.ok(calls[0].binds.includes('삼성생명'));
  assert.ok(calls[0].binds.includes('삼성'));
  assert.deepEqual(calls[2].binds, ['%삼성생명%', '%삼성생명%']);
});

test('company content falls back per query without hiding successful datasets', async () => {
  const DB = {
    prepare(sql) {
      return {
        bind() {
          return {
            all() {
              if (sql.includes('ic_insurance_cases')) return Promise.reject(new Error('missing table'));
              return Promise.resolve({ results: [{ ok: true }] });
            },
          };
        },
      };
    },
  };
  const result = await loadCompanyContent({ DB }, INSURERS[0]);
  assert.equal(result.coverages.length, 1);
  assert.deepEqual(result.cases, []);
  assert.equal(result.boardPosts.length, 1);
});

test('company sitemap lastmod uses one grouped, parameter-bound D1 query', async () => {
  const calls = [];
  const DB = {
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          return { all: async () => ({ results: [{ slug: 'samsung-life', lastmod: '2026-07-12 01:02:03' }] }) };
        },
      };
    },
  };
  const map = await loadCompanyLastmods({ DB });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM json_each\(\?\)/);
  assert.match(calls[0].sql, /GROUP BY 1/);
  assert.match(calls[0].sql, /MAX\(created_at\) AS lastmod/);
  assert.ok(!calls[0].sql.includes('${'));
  const boundNames = JSON.parse(calls[0].binds[0]);
  assert.ok(boundNames.some((row) => row.slug === 'samsung-life' && row.name === '삼성생명' && row.official === 1));
  assert.equal(map.get('samsung-life'), '2026-07-12 01:02:03');
});

test('company route omits empty sections and keeps all unique-content markers', () => {
  const source = readFileSync(new URL('../functions/company/[slug].js', import.meta.url), 'utf8');
  assert.match(source, /if \(!coverages\.length\) return \{ html: '', jsonLd: '' \}/);
  assert.match(source, /if \(cases\.length < 3\) return ''/);
  assert.match(source, /if \(!boardPosts\.length\) return ''/);
  assert.match(source, /주요 담보 · 가입금액/);
  assert.match(source, /인수 · 보상 사례/);
  assert.match(source, /설계사들이 .*에 대해 나눈 이야기/);
  assert.match(source, /\/og\/board\/\$\{encodeURIComponent\(post\.id\)\}/);
  assert.ok(!source.includes('CF_ALIAS'));
});
