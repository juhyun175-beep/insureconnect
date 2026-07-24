const PREVIEW_BASE = process.env.PREVIEW_BASE;
const PROD_BASE = process.env.PROD_BASE;

if (!PREVIEW_BASE || !PROD_BASE) {
  throw new Error('PREVIEW_BASE and PROD_BASE are required');
}

async function fetchChecked(label, base, path, method = 'GET') {
  const url = new URL(path, base).toString();
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const started = performance.now();
      const response = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? '{}' : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      const elapsed = Math.round(performance.now() - started);
      console.log(`${label}: ${method} ${url} -> ${response.status} (${elapsed}ms)`);

      if (!response.ok) {
        console.log(`${label} body: ${text.slice(0, 1000)}`);
        lastError = new Error(`${label} returned HTTP ${response.status}`);
      } else {
        return { response, text };
      }
    } catch (error) {
      lastError = error;
      console.log(`${label}: attempt ${attempt} failed: ${error.message}`);
    }

    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw lastError || new Error(`${label} failed`);
}

function parseJson(label, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}; body=${text.slice(0, 500)}`);
  }
}

function sameKeys(a, b, label) {
  const left = Object.keys(a).sort();
  const right = Object.keys(b).sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${label} key mismatch\npreview=${left.join(',')}\nproduction=${right.join(',')}`);
  }
}

const admin = await fetchChecked('preview admin', PREVIEW_BASE, '/admin.html');
if (!admin.text.includes('loadDashboard') || !admin.text.includes('startAutoRefresh')) {
  throw new Error('preview admin.html is missing dashboard bootstrap functions');
}

const previewStatsGetRaw = await fetchChecked('preview stats GET', PREVIEW_BASE, '/api/stats');
const previewStatsPostRaw = await fetchChecked('preview stats POST', PREVIEW_BASE, '/api/stats', 'POST');
const previewSessionsRaw = await fetchChecked('preview sessions', PREVIEW_BASE, '/api/stats/sessions');
const previewTopRaw = await fetchChecked('preview top-items', PREVIEW_BASE, '/api/top-items', 'POST');

const prodStatsRaw = await fetchChecked('production stats', PROD_BASE, '/api/stats');
const prodSessionsRaw = await fetchChecked('production sessions', PROD_BASE, '/api/stats/sessions');
const prodTopRaw = await fetchChecked('production top-items', PROD_BASE, '/api/top-items', 'POST');

const previewStats = parseJson('preview stats GET', previewStatsGetRaw.text);
const previewStatsPost = parseJson('preview stats POST', previewStatsPostRaw.text);
const previewSessions = parseJson('preview sessions', previewSessionsRaw.text);
const previewTop = parseJson('preview top-items', previewTopRaw.text);
const prodStats = parseJson('production stats', prodStatsRaw.text);
const prodSessions = parseJson('production sessions', prodSessionsRaw.text);
const prodTop = parseJson('production top-items', prodTopRaw.text);

const requiredStats = [
  'today_visits', 'week_visits', 'total_visits', 'today_clicks', 'total_clicks',
  'week_start_date', 'week_end_date', 'today_date', 'daily_visits_7d', 'daily_clicks_7d',
];
for (const key of requiredStats) {
  if (!(key in previewStats)) throw new Error(`preview stats missing ${key}`);
}
sameKeys(previewStats, previewStatsPost, 'GET/POST stats');
sameKeys(previewStats, prodStats, 'preview/production stats');
if (previewStats.daily_visits_7d?.length !== 7) throw new Error('daily_visits_7d must contain 7 rows');
if (previewStats.daily_clicks_7d?.length !== 7) throw new Error('daily_clicks_7d must contain 7 rows');

const requiredSessions = [
  'today_count', 'today_avg', 'total_avg', 'distribution', 'recent',
  'today_sessions', 'today_avg_sec', 'total_sessions', 'total_avg_sec',
  'recent_sessions', 'last_7_days',
];
for (const key of requiredSessions) {
  if (!(key in previewSessions)) throw new Error(`preview sessions missing ${key}`);
}
sameKeys(previewSessions, prodSessions, 'preview/production sessions');

sameKeys(previewTop, prodTop, 'preview/production top-items');
if (Object.keys(previewTop).length !== 20) {
  throw new Error(`top-items must contain 20 keys; got ${Object.keys(previewTop).length}`);
}
for (const [key, value] of Object.entries(previewTop)) {
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  if (value.length > 5) throw new Error(`${key} returned more than 5 rows`);
}

const cacheExpectations = [
  ['stats', previewStatsGetRaw.response, 's-maxage=35'],
  ['sessions', previewSessionsRaw.response, 's-maxage=60'],
  ['top-items', previewTopRaw.response, 's-maxage=60'],
];
for (const [label, response, expected] of cacheExpectations) {
  const value = response.headers.get('cache-control') || '';
  console.log(`${label} cache-control: ${value}`);
  if (!value.includes(expected)) throw new Error(`${label} cache-control missing ${expected}`);
}

console.log('Preview KPI', {
  today_visits: previewStats.today_visits,
  week_visits: previewStats.week_visits,
  total_visits: previewStats.total_visits,
  today_clicks: previewStats.today_clicks,
  total_clicks: previewStats.total_clicks,
});
console.log('Production KPI', {
  today_visits: prodStats.today_visits,
  week_visits: prodStats.week_visits,
  total_visits: prodStats.total_visits,
  today_clicks: prodStats.today_clicks,
  total_clicks: prodStats.total_clicks,
});
console.log('PR44 preview smoke validation passed');
