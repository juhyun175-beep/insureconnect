import assert from 'node:assert/strict';
import { normalizeDisease, caseDiseaseUrl, isCasesIndexable, CASES_INDEX_WHERE } from '../functions/_lib/cases-seo.js';
import { insurerSlugForName } from '../functions/_lib/insurers.js';

assert.equal(normalizeDisease('  무릎 수술  '.normalize('NFD')), '무릎 수술');
assert.equal(caseDiseaseUrl('  무릎 수술  '), '/cases/%EB%AC%B4%EB%A6%8E%20%EC%88%98%EC%88%A0');
assert.equal(isCasesIndexable({ count: 3, underwriting: 1 }), true);
assert.equal(isCasesIndexable({ count: 2, underwriting: 1 }), false);
assert.equal(isCasesIndexable({ count: 3, underwriting: 0 }), false);
assert.match(CASES_INDEX_WHERE, /verify_status = 'approved'/);
assert.equal(typeof insurerSlugForName, 'function');
console.log('cases disease page tests: ok');
