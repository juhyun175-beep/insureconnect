#!/usr/bin/env node

const USER_AGENT = 'Mediapartners-Google';
const TEXT_PLAIN = 'text/plain';

const checks = [
  {
    url: 'https://insureconnect.co.kr/ads.txt',
    requiredText: 'pub-7787620251169899',
    missingTextReason: 'ads.txt is missing pub-7787620251169899',
  },
  {
    url: 'https://insureconnect.co.kr/robots.txt',
    requiredText: 'Sitemap:',
    missingTextReason: 'robots.txt is missing Sitemap:',
  },
];

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  return {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    body: await response.text(),
  };
}

async function verify({ url, requiredText, missingTextReason }) {
  const failures = [];

  try {
    const { status, contentType, body } = await fetchText(url);
    if (status !== 200) failures.push(`status ${status} (expected 200)`);
    if (!contentType.toLowerCase().includes(TEXT_PLAIN)) {
      failures.push(`content-type ${contentType || '<missing>'} is missing ${TEXT_PLAIN}`);
    }
    if (!body.includes(requiredText)) failures.push(missingTextReason);
  } catch (error) {
    failures.push(`request failed: ${error?.message || String(error)}`);
  }

  if (failures.length === 0) {
    console.log(`[OK] ${url}`);
    return true;
  }

  for (const failure of failures) console.error(`[FAIL] ${url} -> ${failure}`);
  return false;
}

const results = await Promise.all(checks.map(verify));
if (!results.every(Boolean)) process.exitCode = 1;
