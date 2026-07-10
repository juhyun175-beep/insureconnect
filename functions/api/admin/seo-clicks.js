import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const CLICK_TYPE = 'seo_widget_click';
const NAME_RE = /^seo_(widget|rail)_(recruit|lecture|meetup)_(\d+)$/;
const TABLES = {
  recruit: 'ic_recruitments',
  lecture: 'ic_lectures',
  meetup: 'ic_meetings',
};

function validDays(raw) {
  const n = parseInt(raw || '14', 10);
  return [7, 14, 30].includes(n) ? n : 14;
}

function parseName(name) {
  const m = String(name || '').match(NAME_RE);
  if (!m) return null;
  return { placement: m[1], type: m[2], id: parseInt(m[3], 10) };
}

function boosted(until) {
  const s = String(until || '').trim();
  if (!s) return false;
  const t = Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isFinite(t) && t > Date.now();
}

function keyOf(type, id) {
  return `${type}:${id}`;
}

async function loadTitles(env, idsByType) {
  const titles = new Map();
  for (const [type, ids] of Object.entries(idsByType)) {
    if (!ids.size) continue;
    const table = TABLES[type];
    const list = [...ids];
    const placeholders = list.map(() => '?').join(',');
    const rs = await env.DB.prepare(
      `SELECT id, title, seo_boost_until FROM ${table} WHERE id IN (${placeholders})`
    ).bind(...list).all().catch(() => ({ results: [] }));
    for (const row of rs.results || []) {
      titles.set(keyOf(type, Number(row.id)), {
        title: row.title || `${type} #${row.id}`,
        boosted: boosted(row.seo_boost_until),
      });
    }
  }
  return titles;
}

async function summary(env, days) {
  const since = `-${days} days`;
  const rs = await env.DB.prepare(
    `SELECT company_name, SUM(clicks) AS clicks
       FROM ic_link_clicks_daily
      WHERE company_type = ? AND date >= date('now', ?)
      GROUP BY company_name`
  ).bind(CLICK_TYPE, since).all().catch(() => ({ results: [] }));

  const grouped = new Map();
  const idsByType = { recruit: new Set(), lecture: new Set(), meetup: new Set() };
  const totals = { widget: 0, rail: 0, all: 0 };

  for (const row of rs.results || []) {
    const parsed = parseName(row.company_name);
    if (!parsed) continue;
    const clicks = Number(row.clicks || 0);
    const k = keyOf(parsed.type, parsed.id);
    if (!grouped.has(k)) {
      grouped.set(k, { type: parsed.type, id: parsed.id, widget_clicks: 0, rail_clicks: 0 });
    }
    const item = grouped.get(k);
    if (parsed.placement === 'rail') item.rail_clicks += clicks;
    else item.widget_clicks += clicks;
    totals[parsed.placement] += clicks;
    totals.all += clicks;
    idsByType[parsed.type].add(parsed.id);
  }

  const titles = await loadTitles(env, idsByType);
  const rows = [...grouped.values()].map((r) => {
    const meta = titles.get(keyOf(r.type, r.id)) || {};
    const total = r.widget_clicks + r.rail_clicks;
    return {
      type: r.type,
      id: r.id,
      title: meta.title || `${r.type} #${r.id}`,
      widget_clicks: r.widget_clicks,
      rail_clicks: r.rail_clicks,
      total,
      boosted: !!meta.boosted,
    };
  }).sort((a, b) => b.total - a.total);

  return { days, totals, rows };
}

async function dailySeries(env, days, type, id) {
  const n = parseInt(id, 10);
  if (!TABLES[type] || !Number.isFinite(n) || n <= 0) return { days, type, id: n || null, series: [] };
  const since = `-${days} days`;
  // Per-posting daily series is kept separate so owner-facing Kakao reports can reuse this endpoint later.
  const rs = await env.DB.prepare(
    `SELECT date, company_name, SUM(clicks) AS clicks
       FROM ic_link_clicks_daily
      WHERE company_type = ? AND date >= date('now', ?)
        AND company_name IN (?, ?)
      GROUP BY date, company_name
      ORDER BY date ASC`
  ).bind(CLICK_TYPE, since, `seo_widget_${type}_${n}`, `seo_rail_${type}_${n}`).all().catch(() => ({ results: [] }));

  const byDate = new Map();
  for (const row of rs.results || []) {
    const parsed = parseName(row.company_name);
    if (!parsed || parsed.type !== type || parsed.id !== n) continue;
    if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date, widget: 0, rail: 0 });
    byDate.get(row.date)[parsed.placement] += Number(row.clicks || 0);
  }
  return { days, type, id: n, series: [...byDate.values()] };
}

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const days = validDays(url.searchParams.get('days'));
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');
  if (type && id) return json(await dailySeries(env, days, type, id));
  return json(await summary(env, days));
});
