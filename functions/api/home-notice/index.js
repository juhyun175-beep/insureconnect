import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

const KEY = 'home_notice';
const MAX_BLOCKS = 30;

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_site_config (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
}

function safeUrl(v, { allowRelative }) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (allowRelative && s.startsWith('/')) return s.slice(0, 500);
  if (/^https?:\/\//i.test(s)) return s.slice(0, 500);
  return undefined;
}

function cut(v, n) {
  return String(v == null ? '' : v).slice(0, n);
}

function normalizeBlock(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const type = String(b.type || '');
  if (type === 'text') {
    const value = cut(b.value, 4000);
    return value.trim() ? { type: 'text', value } : null;
  }
  if (type === 'image') {
    const url = safeUrl(b.url, { allowRelative: true });
    if (!url) return null;
    if (url === undefined) return null;
    return {
      type: 'image',
      url,
      alt: cut(b.alt, 200),
      caption: cut(b.caption, 200),
    };
  }
  if (type === 'table') {
    const rows = Array.isArray(b.rows) ? b.rows : [];
    const out = rows.slice(0, 30).map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return cells.slice(0, 10).map((cell) => cut(cell, 300));
    }).filter((row) => row.some((cell) => String(cell || '').trim()));
    return out.length ? { type: 'table', header: b.header === true, rows: out } : null;
  }
  return null;
}

function normalizeNotice(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const blocks = Array.isArray(b.blocks)
    ? b.blocks.slice(0, MAX_BLOCKS).map(normalizeBlock).filter(Boolean)
    : [];
  return {
    enabled: b.enabled === true,
    title: cut(b.title || '운영자 공지', 80) || '운영자 공지',
    blocks,
  };
}

async function getNotice(env) {
  await ensureTable(env);
  const row = await env.DB.prepare(`SELECT value, updated_at FROM ic_site_config WHERE key = ?`).bind(KEY).first().catch(() => null);
  if (!row || !row.value) return null;
  let raw = null;
  try { raw = JSON.parse(row.value); } catch (_) { raw = null; }
  const notice = normalizeNotice(raw);
  notice.updated_at = raw?.updated_at || row.updated_at || '';
  return notice;
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const notice = await getNotice(env);
  if (url.searchParams.get('all') === '1') {
    if (!verifyAdmin(request, env)) return unauthorized();
    return json({ ok: true, notice: notice || { enabled: false, title: '운영자 공지', blocks: [] } });
  }
  if (!notice || !notice.enabled || !notice.blocks.length) return json({ ok: true, notice: null });
  return json({ ok: true, notice });
});

export const onRequestPut = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureTable(env);
  const body = await request.json().catch(() => ({}));
  const notice = normalizeNotice(body);
  notice.updated_at = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO ic_site_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(KEY, JSON.stringify(notice)).run();
  return json({ ok: true, notice });
});
