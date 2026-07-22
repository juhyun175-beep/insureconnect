import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPage, shellStyle } from '../functions/_lib/ssr-shell.js';

test('renderPage returns a complete responsive SSR document with the shared shell', () => {
  const html = renderPage({
    title: '사례 모음',
    description: '사례 설명',
    robots: 'index,follow',
    canonical: 'https://example.test/cases',
    breadcrumb: [
      { label: '홈', href: '/' },
      { label: '사례', href: '/cases' },
    ],
    bodyHtml: '<section class="card"><h1>사례</h1></section>',
    site: 'https://example.test',
  });

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<header class="c-head">/);
  assert.match(html, /<a href="\/"[^>]*>InsureConnect<\/a>/);
  assert.match(html, /<main(?:\s|>)/);
  assert.match(html, /<section class="card"><h1>사례<\/h1><\/section>/);
  assert.match(html, /class="seo-cta"/);
  assert.match(html, /<style>[\s\S]*\.card[\s\S]*header\.c-head/);
  assert.match(html, /href="https:\/\/example\.test\/cases"/);
});

test('renderPage omits canonical for noindex pages and emits it for index pages', () => {
  const noindex = renderPage({
    title: '비색인',
    description: '설명',
    robots: 'noindex,follow',
    canonical: 'https://example.test/should-not-render',
    bodyHtml: '',
    site: 'https://example.test',
  });
  const index = renderPage({
    title: '색인',
    description: '설명',
    robots: 'index,follow',
    canonical: 'https://example.test/index',
    bodyHtml: '',
    site: 'https://example.test',
  });

  assert.match(noindex, /<meta name="robots" content="noindex,follow">/);
  assert.doesNotMatch(noindex, /<link rel="canonical"/);
  assert.match(index, /<meta name="robots" content="index,follow">/);
  assert.match(index, /<link rel="canonical" href="https:\/\/example\.test\/index">/);
});

test('renderPage injects multiple escaped JSON-LD blocks', () => {
  const html = renderPage({
    title: '구조화 데이터',
    description: '설명',
    robots: 'index,follow',
    canonical: 'https://example.test/structured',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', name: '</script><script>alert(1)</script>' },
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '두 번째' },
    ],
    bodyHtml: '',
    site: 'https://example.test',
  });

  assert.equal((html.match(/type="application\/ld\+json"/g) || []).length, 2);
  assert.match(html, /\\u003c\/script>/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('shellStyle exposes the company page style source', () => {
  const style = shellStyle();
  assert.match(style, /\.card\{/);
  assert.match(style, /header\.c-head\{/);
  assert.match(style, /\.coverage-table\{/);
  assert.match(style, /\.case-card\{/);
  assert.match(style, /@media\(max-width:640px\)/);
});
