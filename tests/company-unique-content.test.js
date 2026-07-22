import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSURERS, INSURER_ALIASES, insurerNames, safeInsurerNames } from '../functions/_lib/insurers.js';
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

  assert.deepEqual(safeInsurerNames('hanwha-life'), ['한화생명']);
  assert.deepEqual(safeInsurerNames('hanwha-general'), ['한화손해보험', '한화손보']);
  assert.deepEqual(safeInsurerNames('fubon-hyundai-life'), ['푸본현대생명', '푸본현대']);
  assert.deepEqual(safeInsurerNames('hyundai-marine'), ['현대해상']);
  assert.deepEqual(safeInsurerNames('db-life'), ['DB생명']);
  assert.deepEqual(safeInsurerNames('db-insurance'), ['DB손해보험', 'DB손보']);
});

test('company content loads two approved datasets concurrently with accurate coverage totals', async () => {
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
              if (sql.includes('ic_product_coverages')) return { results: [{ coverage_name: '암', join_amount: '1억', total_count: 23 }] };
              if (sql.includes('ic_insurance_cases')) return { results: [{ disease: '암', reliability: 80 }] };
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const ins = INSURERS.find((item) => item.slug === 'samsung-life');
  const result = await loadCompanyContent({ DB }, ins);

  assert.equal(maxActive, 2);
  assert.equal(calls.length, 2);
  assert.equal(result.coverages.length, 1);
  assert.equal(result.coverages[0].total_count, 23);
  assert.equal(result.cases.length, 1);
  assert.match(calls[0].sql, /insurer IN \(\?, \?, \?, \?, \?, \?, \?, \?\)/);
  assert.match(calls[0].sql, /COUNT\(\*\) OVER\(\) AS total_count/);
  assert.match(calls[0].sql, /TRIM\(join_amount\) NOT IN \('', '-'\)/);
  assert.ok(calls[0].binds.includes('삼성생명'));
  assert.ok(calls[0].binds.includes('삼성'));
  assert.match(calls[0].sql, /LIMIT 15/);
  assert.match(calls[1].sql, /LIMIT 6/);
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
  assert.match(calls[0].sql, /JOIN ic_product_coverages coverages/);
  assert.match(calls[0].sql, /coverages\.verify_status = 'approved'/);
  assert.ok(!calls[0].sql.includes('${'));
  const boundNames = JSON.parse(calls[0].binds[0]);
  assert.ok(boundNames.some((row) => row.slug === 'samsung-life' && row.name === '삼성생명' && row.official === 1));
  assert.ok(!boundNames.some((row) => ['한화', '현대', 'DB'].includes(row.name)));
  assert.equal(map.get('samsung-life'), '2026-07-12 01:02:03');
});

test('company content and route keep their unique-content responsibilities', () => {
  const source = readFileSync(new URL('../functions/company/[slug].js', import.meta.url), 'utf8');
  const content = readFileSync(new URL('../functions/_lib/company-content.js', import.meta.url), 'utf8');
  assert.match(content, /ic_product_coverages/);
  assert.match(content, /ic_insurance_cases/);
  assert.doesNotMatch(content, /ic_board_posts/);
  assert.match(content, /return \{ coverages, cases \}/);
  assert.match(content, /safeInsurerNames\(/);
  assert.match(source, /loadCompanyContent\(/);
  assert.match(source, /safeInsurerNames\(/);
  assert.match(source, /coveragesHtml/);
  assert.match(source, /casesHtml/);
  assert.match(source, /renderPage\(/);
  assert.match(source, /caseLinks\.length/);
  assert.match(source, /faqHtml/);
  assert.match(source, /jsonLd: \[orgLd, faqLd, breadcrumbLd\]/);
  assert.doesNotMatch(source, /대표전화 \$\{ins\.call\}/);
  assert.doesNotMatch(source, /청구 팩스 \$\{ins\.fax\}/);
  assert.doesNotMatch(source, /<style>/);
  assert.doesNotMatch(source, /<!DOCTYPE html>/);
});
