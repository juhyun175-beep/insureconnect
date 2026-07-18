const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const marker of [
  'id="home-posts-grid"',
  'data-kind="all"',
  'data-kind="recruit"',
  'data-kind="lecture"',
  'data-kind="meetup"',
  'async function loadHomePosts()',
  '/api/recruitments?limit=8',
  '/api/lectures?limit=8',
  '/api/meetings?limit=8',
  'async function loadHomeMeetups()',
]) {
  assert(indexHtml.includes(marker), `home posts source should include: ${marker}`);
}

for (const marker of [
  'id="home-jobs-grid"',
  'id="home-lectures-grid"',
  'id="home-meetups-grid"',
]) {
  assert(!indexHtml.includes(marker), `legacy home grid should be removed: ${marker}`);
}

const mobileStart = indexHtml.indexOf('async function loadMobileHome()');
const mobileEnd = indexHtml.indexOf('\n    if (document.readyState', mobileStart);
assert(mobileStart >= 0 && mobileEnd > mobileStart, 'loadMobileHome source should be extractable');
const mobileSource = indexHtml.slice(mobileStart, mobileEnd);
assert(!mobileSource.includes('m-home-jobs'), 'mobile home should not fetch the removed jobs target');
assert(!mobileSource.includes('m-home-lectures'), 'mobile home should not fetch the removed lectures target');

const helperStartMarker = '/* HOME_POST_SELECTION_START */';
const helperEndMarker = '/* HOME_POST_SELECTION_END */';
const helperStart = indexHtml.indexOf(helperStartMarker);
const helperEnd = indexHtml.indexOf(helperEndMarker, helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'home post selection helper markers should exist');
const helperSource = indexHtml.slice(helperStart + helperStartMarker.length, helperEnd);
const sandbox = { Date, Number, Array, Object, Set, String };
vm.createContext(sandbox);
vm.runInContext(`${helperSource}\nthis.__selectHomePosts = _selectHomePosts;`, sandbox, {
  filename: 'index.html#home-post-selection',
});

const fixture = [
  { kind: 'recruit', id: 1, featured: 1, created_at: '2026-07-10T00:00:00Z' },
  { kind: 'recruit', id: 2, created_at: '2026-07-09T00:00:00Z' },
  { kind: 'recruit', id: 3, created_at: '2026-07-08T00:00:00Z' },
  { kind: 'recruit', id: 4, created_at: '2026-07-07T00:00:00Z' },
  { kind: 'recruit', id: 5, created_at: '2026-07-06T00:00:00Z' },
  { kind: 'recruit', id: 6, created_at: '2026-07-05T00:00:00Z' },
  { kind: 'recruit', id: 7, created_at: '2026-07-04T00:00:00Z' },
  { kind: 'lecture', id: 8, created_at: '2026-07-03T00:00:00Z' },
  { kind: 'meetup', id: 9, created_at: '2026-07-02T00:00:00Z' },
];
const all = sandbox.__selectHomePosts(fixture, 'all');
assert.strictEqual(all.length, 8, 'all tab should render at most eight cards');
assert.strictEqual(all[0].id, 1, 'featured card should sort before newer non-featured cards');
assert(all.some((item) => item.kind === 'recruit'), 'all tab should contain recruit');
assert(all.some((item) => item.kind === 'lecture'), 'all tab should contain lecture');
assert(all.some((item) => item.kind === 'meetup'), 'all tab should contain meetup');
assert.strictEqual(sandbox.__selectHomePosts(fixture, 'lecture').length, 1, 'kind filter should use the cache');

console.log('home posts merged tests passed');
