/**
 * v2.63.0: 홈 광고배너(삼따AI 옆) 설정 — /api/home-ad
 * v2.66.0: 다중 이미지(순번) 지원 — images 배열(1번부터 순서대로). 팝업은 카드뉴스처럼 여러 장 표시.
 *   GET (공개) : { enabled, images:[url...], link_url, alt }
 *   PUT (관리자): images 배열·CTA 링크·노출여부 설정.
 *   저장: 범용 ic_site_config (key='home_ad', value=JSON), 런타임 lazy.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

const KEY = 'home_ad';
const MAX_IMAGES = 20;
const DEFAULTS = { enabled: false, images: [], link_url: '', alt: '' };

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_site_config (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
}

// 이미지 URL: 상대경로(/...) 또는 http(s)만. CTA 링크: http(s)만(javascript: 등 차단).
function safeUrl(v, { allowRelative }) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (allowRelative && s.startsWith('/')) return s.slice(0, 500);
  if (/^https?:\/\//i.test(s)) return s.slice(0, 500);
  return undefined; // 무효
}

async function getConfig(env) {
  await ensureTable(env);
  const row = await env.DB.prepare(`SELECT value FROM ic_site_config WHERE key = ?`).bind(KEY).first().catch(() => null);
  let c = { ...DEFAULTS };
  if (row && row.value) { try { c = { ...DEFAULTS, ...JSON.parse(row.value) }; } catch (_) {} }
  if (!Array.isArray(c.images)) c.images = [];
  // 레거시 단일(banner_url/popup_url) → images 폴백
  if (!c.images.length) {
    if (c.banner_url) c.images.push(c.banner_url);
    else if (c.popup_url) c.images.push(c.popup_url);
  }
  c.images = c.images.filter(Boolean).slice(0, MAX_IMAGES);
  return { enabled: c.enabled === true, images: c.images, link_url: c.link_url || '', alt: c.alt || '' };
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env }) => handle(async () => {
  const config = await getConfig(env);
  return json({ ok: true, config });
});

export const onRequestPut = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureTable(env);
  const b = await request.json().catch(() => ({}));
  const cur = await getConfig(env);

  const next = { enabled: cur.enabled, images: cur.images, link_url: cur.link_url, alt: cur.alt };
  if (typeof b.enabled === 'boolean') next.enabled = b.enabled;
  if (b.alt != null) next.alt = String(b.alt).slice(0, 200);
  if (b.link_url != null && b.link_url !== '') {
    const u = safeUrl(b.link_url, { allowRelative: false });
    if (u === undefined) return error('link_url: http(s) URL만 허용됩니다.');
    next.link_url = u;
  } else if (b.link_url === '') {
    next.link_url = '';
  }
  if (Array.isArray(b.images)) {
    const out = [];
    for (const im of b.images.slice(0, MAX_IMAGES)) {
      const u = safeUrl(im, { allowRelative: true });
      if (u === undefined) return error('images: 상대경로(/...) 또는 http(s) URL만 허용됩니다.');
      if (u) out.push(u);
    }
    next.images = out;
  }

  await env.DB.prepare(
    `INSERT INTO ic_site_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(KEY, JSON.stringify(next)).run();
  return json({ ok: true, config: next });
});
