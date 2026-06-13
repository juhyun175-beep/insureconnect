/**
 * v2.63.0: 홈 광고배너(삼따AI 옆) 설정 — /api/home-ad
 *   GET (공개) : 현재 배너 설정 반환. 미설정이면 기존 하드코딩 기본값 → 동작 무변경.
 *   PUT (관리자): 배너 이미지/팝업 이미지/CTA 링크/노출여부 설정.
 *   저장: 범용 ic_site_config (key='home_ad', value=JSON), 런타임 lazy.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

const KEY = 'home_ad';
// 현재 하드코딩과 동일한 기본값(관리자가 바꾸기 전까지 화면 무변경)
const DEFAULTS = {
  enabled: true,
  banner_url: '/connect.webp',
  popup_url: '/connect.webp',
  link_url: 'https://naver.me/xD8zNndZ',
  alt: '보험만 하실 건가요? 고객 한 명으로 7가지 수익 창출 — 제휴상품 안내',
};

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_site_config (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
}

async function getConfig(env) {
  await ensureTable(env);
  const row = await env.DB.prepare(`SELECT value FROM ic_site_config WHERE key = ?`).bind(KEY).first().catch(() => null);
  if (!row || !row.value) return { ...DEFAULTS };
  try { return { ...DEFAULTS, ...JSON.parse(row.value) }; } catch (_) { return { ...DEFAULTS }; }
}

// 이미지 URL: 상대경로(/...) 또는 http(s) 만 허용. CTA 링크: http(s) 만 허용(javascript: 등 차단).
function safeUrl(v, { allowRelative }) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (allowRelative && s.startsWith('/')) return s.slice(0, 500);
  if (/^https?:\/\//i.test(s)) return s.slice(0, 500);
  return undefined; // 무효
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

  const next = { ...cur };
  if (typeof b.enabled === 'boolean') next.enabled = b.enabled;
  if (b.alt != null) next.alt = String(b.alt).slice(0, 200);
  for (const f of ['banner_url', 'popup_url']) {
    if (b[f] != null && b[f] !== '') {
      const u = safeUrl(b[f], { allowRelative: true });
      if (u === undefined) return error(`${f}: 상대경로(/...) 또는 http(s) URL만 허용됩니다.`);
      next[f] = u;
    }
  }
  if (b.link_url != null && b.link_url !== '') {
    const u = safeUrl(b.link_url, { allowRelative: false });
    if (u === undefined) return error('link_url: http(s) URL만 허용됩니다.');
    next.link_url = u;
  }

  await env.DB.prepare(
    `INSERT INTO ic_site_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(KEY, JSON.stringify(next)).run();
  return json({ ok: true, config: next });
});
