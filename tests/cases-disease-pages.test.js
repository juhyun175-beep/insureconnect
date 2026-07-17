import assert from 'node:assert/strict';
import { normalizeDisease, caseDiseaseUrl, diseaseFromParam, isCasesIndexable, CASES_INDEX_WHERE } from '../functions/_lib/cases-seo.js';
import { insurerSlugForName } from '../functions/_lib/insurers.js';
import { onRequestGet as diseasePage } from '../functions/cases/[disease].js';

assert.equal(normalizeDisease('  무릎 수술  '.normalize('NFD')), '무릎 수술');
assert.equal(caseDiseaseUrl('  무릎 수술  '), '/cases/%EB%AC%B4%EB%A6%8E%20%EC%88%98%EC%88%A0');
assert.equal(diseaseFromParam('%EC%B9%98%EB%A7%A4'), '치매');
assert.equal(diseaseFromParam('치매'), '치매');
assert.equal(diseaseFromParam('%zz질병'), '%zz질병');
assert.equal(isCasesIndexable({ count: 3, underwriting: 1 }), true);
assert.equal(isCasesIndexable({ count: 2, underwriting: 1 }), false);
assert.equal(isCasesIndexable({ count: 3, underwriting: 0 }), false);
assert.match(CASES_INDEX_WHERE, /verify_status = 'approved'/);
assert.equal(typeof insurerSlugForName, 'function');

function mockEnv() {
  const rows = [
    { category: 'underwrite', insurer: '삼성생명', gender: 'F', age: 34, elapsed_period: '1년', join_condition: '표준체', result: '승인', summary: '요약 1', reliability: 90, created_at: '2026-07-01' },
    { category: 'disclosure', insurer: '삼성생명', gender: 'F', age: 42, elapsed_period: '2년', join_condition: '고지', result: '승인', summary: '요약 2', reliability: 80, created_at: '2026-07-02' },
    { category: 'claim', insurer: '현대해상', gender: 'M', age: 55, elapsed_period: '3년', join_condition: '청구', result: '지급', summary: '요약 3', reliability: 70, created_at: '2026-07-03' },
  ];
  return {
    DB: {
      prepare() {
        return {
          bind(disease) {
            return {
              async all() {
                return { results: disease === '치매' ? rows : [] };
              },
            };
          },
        };
      },
    },
  };
}

let res = await diseasePage({ params: { disease: '%EC%B9%98%EB%A7%A4' }, env: mockEnv() });
assert.equal(res.status, 200);
assert.match(await res.text(), /<title>치매 보험 가입·고지·보상 사례 3건 \| InsureConnect<\/title>/);

res = await diseasePage({ params: { disease: '치매' }, env: mockEnv() });
assert.equal(res.status, 200);
assert.match(await res.text(), /<title>치매 보험 가입·고지·보상 사례 3건 \| InsureConnect<\/title>/);

res = await diseasePage({ params: { disease: '%zz질병' }, env: mockEnv() });
assert.equal(res.status, 404);

console.log('cases disease page tests: ok');
