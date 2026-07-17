const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const marker of [
  'id="home-main-featured-section"',
  'id="home-main-featured-recruit"',
  'id="home-main-featured-lecture"',
  'id="home-main-featured-meetup"',
  'function loadHomeMainFeatured',
  '/api/recruitments?main_featured=1&limit=2',
  '/api/lectures?main_featured=1&limit=2',
  '/api/meetings?main_featured=1&limit=2',
  'loadHomeMainFeatured();',
]) {
  assert(indexHtml.includes(marker), `home dashboard should include main featured marker: ${marker}`);
}

for (const file of [
  'functions/api/recruitments/index.js',
  'functions/api/lectures/index.js',
  'functions/api/meetings/index.js',
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert(
    source.includes("url.searchParams.get('main_featured') === '1'"),
    `${file} should accept ?main_featured=1`,
  );
  assert(
    source.includes('COALESCE(main_featured_enabled,0) = 1'),
    `${file} should filter to main featured rows`,
  );
}

console.log('home main featured tests passed');
