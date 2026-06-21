/**
 * 홈 광고배너 — /api/home-ad
 * v2.63.0: 단일 배너(삼따AI 옆) 설정.
 * v2.66.0: 다중 이미지(순번) — images 배열.
 * v2.94.0: 다중 캠페인·로테이션·노출 스케줄·팝업 제어·성과 추적으로 확장.
 *
 *   GET (공개)         : { ok, config:{ campaigns:[active only], rotation, popup } }  — 홈 렌더가 로테이션 선택
 *   GET ?all=1  (관리) : { ok, config:{ campaigns:[전체], rotation, popup } }          — 관리자 편집용(초안 포함)
 *   GET ?stats=1(관리) : { ok, stats:[{campaign_id,name,impressions,clicks,ctr,...}], days }
 *   PUT (관리)         : campaigns 배열·rotation·popup 저장
 *
 *   저장: 범용 ic_site_config (key='home_ad', value=JSON), 런타임 lazy.
 *   캠페인: { id, name, enabled, images:[url...], link_url, alt, cta_text, weight, start_at, end_at }
 *     - 배너=images[0], 클릭/자동팝업=images 전체(순서대로) · start_at/end_at='YYYY-MM-DD'|''
 *   레거시 {enabled,images,link_url,alt} → campaigns[0]('main') 자동 이관.
 *   성과: 홈에서 trackCardClick('홈광고', 'imp:'+id | 'click:'+id | 'cta:'+id | 'popimp:'+id)
 *         → ic_card_clicks_daily(menu='홈광고') 집계. 레거시 '배너클릭'/'상담클릭'은 'main' 귀속.
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

const KEY = 'home_ad';
const MAX_IMAGES = 20;
const MAX_CAMPAIGNS = 20;
const ROTATIONS = ['sequential', 'random', 'weight'];
const FREQS = ['always', 'session', 'once_day', 'off'];
const DEFAULT_CTA = '💬 자세히 보기 →';

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

// 'YYYY-MM-DD' 또는 '' 만 허용
function safeDate(v) {
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function normalizeCampaign(c, idx) {
  c = (c && typeof c === 'object') ? c : {};
  const images = Array.isArray(c.images) ? c.images.filter(Boolean).slice(0, MAX_IMAGES) : [];
  return {
    id: String(c.id || ('c' + (idx + 1))).slice(0, 40),
    name: String(c.name || ('캠페인 ' + (idx + 1))).slice(0, 80),
    enabled: c.enabled === true,
    images,
    link_url: c.link_url || '',
    alt: String(c.alt || '').slice(0, 200),
    cta_text: String(c.cta_text || DEFAULT_CTA).slice(0, 60) || DEFAULT_CTA,
    weight: Math.max(1, Math.min(100, parseInt(c.weight, 10) || 1)),
    start_at: safeDate(c.start_at),
    end_at: safeDate(c.end_at),
  };
}

function isActive(c, today) {
  if (!c.enabled) return false;
  if (c.start_at && c.start_at > today) return false;
  if (c.end_at && c.end_at < today) return false;
  return (c.images && c.images.length > 0);
}

async function getConfig(env) {
  await ensureTable(env);
  const row = await env.DB.prepare(`SELECT value FROM ic_site_config WHERE key = ?`).bind(KEY).first().catch(() => null);
  let raw = {};
  if (row && row.value) { try { raw = JSON.parse(row.value) || {}; } catch (_) {} }

  let campaigns;
  if (Array.isArray(raw.campaigns)) {
    campaigns = raw.campaigns;
  } else {
    // 레거시 단일 배너 → 캠페인 1개로 이관
    let imgs = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
    if (!imgs.length && raw.banner_url) imgs = [raw.banner_url];
    else if (!imgs.length && raw.popup_url) imgs = [raw.popup_url];
    campaigns = [{
      id: 'main', name: '기본 캠페인', enabled: raw.enabled === true,
      images: imgs, link_url: raw.link_url || '', alt: raw.alt || '',
      cta_text: DEFAULT_CTA, weight: 1, start_at: '', end_at: '',
    }];
  }
  campaigns = campaigns.slice(0, MAX_CAMPAIGNS).map(normalizeCampaign);

  const popup = (raw.popup && typeof raw.popup === 'object') ? raw.popup : {};
  return {
    campaigns,
    rotation: ROTATIONS.includes(raw.rotation) ? raw.rotation : 'sequential',
    popup: {
      enabled: popup.enabled !== false,
      frequency: FREQS.includes(popup.frequency) ? popup.frequency : 'once_day',
      delay_ms: Math.max(0, Math.min(10000, parseInt(popup.delay_ms, 10) || 900)),
    },
  };
}

async function getStats(env, days) {
  await ensureTable(env);
  const from = new Date(Date.now() + 9 * 3600 * 1000 - (days - 1) * 86400 * 1000).toISOString().slice(0, 10);
  const rs = await env.DB.prepare(
    `SELECT card, SUM(clicks) AS n FROM ic_card_clicks_daily
      WHERE menu = '홈광고' AND date >= ? GROUP BY card`
  ).bind(from).all().catch(() => ({ results: [] }));

  const byCamp = new Map();
  const ev = (id) => {
    if (!byCamp.has(id)) byCamp.set(id, { campaign_id: id, imp: 0, click: 0, cta: 0, popimp: 0 });
    return byCamp.get(id);
  };
  (rs.results || []).forEach((r) => {
    const card = String(r.card || ''); const n = r.n || 0;
    const m = card.match(/^(imp|click|cta|popimp):(.+)$/);
    if (m) { ev(m[2])[m[1]] += n; }
    else if (card === '배너클릭') { ev('main').click += n; }
    else if (card === '상담클릭') { ev('main').cta += n; }
  });

  const config = await getConfig(env);
  const nameOf = {};
  config.campaigns.forEach((c) => { nameOf[c.id] = c.name; });

  return Array.from(byCamp.values()).map((o) => {
    const impressions = o.imp + o.popimp;
    const clicks = o.click + o.cta;
    return {
      campaign_id: o.campaign_id,
      name: nameOf[o.campaign_id] || o.campaign_id,
      banner_imp: o.imp, popup_imp: o.popimp, banner_click: o.click, cta_click: o.cta,
      impressions, clicks,
      ctr: impressions ? +((clicks / impressions) * 100).toFixed(1) : 0,
    };
  }).sort((a, b) => b.impressions - a.impressions);
}

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);

  // 성과 통계 (관리자)
  if (url.searchParams.get('stats') === '1') {
    if (!verifyAdmin(request, env)) return unauthorized();
    const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get('days'), 10) || 14));
    return json({ ok: true, stats: await getStats(env, days), days });
  }

  const config = await getConfig(env);

  // 관리자 편집용 — 전체 캠페인(초안·예약·비활성 포함)
  if (url.searchParams.get('all') === '1') {
    if (!verifyAdmin(request, env)) return unauthorized();
    return json({ ok: true, config });
  }

  // 공개(홈 렌더) — 노출중인 캠페인만(활성 + 스케줄 내 + 이미지 보유)
  const today = kstToday();
  const active = config.campaigns.filter((c) => isActive(c, today));
  return json({ ok: true, config: { campaigns: active, rotation: config.rotation, popup: config.popup } });
});

export const onRequestPut = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureTable(env);
  const b = await request.json().catch(() => ({}));
  const cur = await getConfig(env);
  const next = { campaigns: cur.campaigns, rotation: cur.rotation, popup: cur.popup };

  if (Array.isArray(b.campaigns)) {
    const inb = b.campaigns.slice(0, MAX_CAMPAIGNS);
    const out = [];
    for (let i = 0; i < inb.length; i++) {
      const src = (inb[i] && typeof inb[i] === 'object') ? inb[i] : {};
      // 이미지 URL 검증
      const imgs = [];
      for (const im of (Array.isArray(src.images) ? src.images : []).slice(0, MAX_IMAGES)) {
        const u = safeUrl(im, { allowRelative: true });
        if (u === undefined) return error('images: 상대경로(/...) 또는 http(s) URL만 허용됩니다.');
        if (u) imgs.push(u);
      }
      // CTA 링크 검증
      let link = '';
      if (src.link_url != null && String(src.link_url).trim() !== '') {
        const lu = safeUrl(src.link_url, { allowRelative: false });
        if (lu === undefined) return error('link_url: http(s) URL만 허용됩니다.');
        link = lu;
      }
      out.push(normalizeCampaign({ ...src, images: imgs, link_url: link }, i));
    }
    next.campaigns = out;
  }

  if (ROTATIONS.includes(b.rotation)) next.rotation = b.rotation;

  if (b.popup && typeof b.popup === 'object') {
    next.popup = {
      enabled: b.popup.enabled !== false,
      frequency: FREQS.includes(b.popup.frequency) ? b.popup.frequency : next.popup.frequency,
      delay_ms: Math.max(0, Math.min(10000, parseInt(b.popup.delay_ms, 10) || next.popup.delay_ms)),
    };
  }

  await env.DB.prepare(
    `INSERT INTO ic_site_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(KEY, JSON.stringify(next)).run();
  return json({ ok: true, config: next });
});
