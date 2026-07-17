export const HOME_AD_CONFIG_KEY = 'home_ad';

const PUBLIC_SITE = 'https://insureconnect.co.kr';
const DEFAULT_IMAGE = '/logo-banner.png';
const MAX_CAMPAIGNS = 20;
const DEFAULT_CTA = '자세히 보기';
const POSTING_QUERY = { recruit: 'recruit', lecture: 'lecture', meetup: 'meeting', meeting: 'meeting' };

export async function ensureHomeAdTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_site_config (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
}

function cleanText(value, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

function safeAssetUrl(value) {
  const s = cleanText(value).slice(0, 500);
  if (!s) return '';
  if (s.startsWith('/')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

function safeHttpUrl(value) {
  const s = cleanText(value).slice(0, 500);
  return /^https?:\/\//i.test(s) ? s : '';
}

function isImageFile(fileUrl, fileType) {
  const type = cleanText(fileType).toLowerCase();
  const url = cleanText(fileUrl).toLowerCase();
  return type === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/.test(url);
}

function campaignsFromRaw(raw) {
  if (Array.isArray(raw.campaigns)) return raw.campaigns.filter(Boolean);

  let images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
  if (!images.length && raw.banner_url) images = [raw.banner_url];
  if (!images.length && raw.popup_url) images = [raw.popup_url];
  if (!images.length) return [];

  return [{
    id: 'main',
    name: 'Main campaign',
    enabled: raw.enabled === true,
    images,
    link_url: raw.link_url || '',
    alt: raw.alt || '',
    cta_text: DEFAULT_CTA,
    weight: 1,
    start_at: '',
    end_at: '',
  }];
}

async function readHomeAdConfig(env) {
  await ensureHomeAdTable(env);
  const row = await env.DB.prepare(
    `SELECT value FROM ic_site_config WHERE key = ?`
  ).bind(HOME_AD_CONFIG_KEY).first().catch(() => null);
  let raw = {};
  if (row && row.value) {
    try { raw = JSON.parse(row.value) || {}; } catch (_) { raw = {}; }
  }
  return {
    enabled: raw.enabled !== false,
    campaigns: campaignsFromRaw(raw),
    rotation: raw.rotation || 'sequential',
    popup: (raw.popup && typeof raw.popup === 'object')
      ? raw.popup
      : { enabled: true, frequency: 'once_day', delay_ms: 900 },
  };
}

export function postingHomeAdCampaignId(adType, adId) {
  const type = cleanText(adType, 'posting').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 16) || 'posting';
  const id = cleanText(adId, '0').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 20) || '0';
  return `posting_${type}_${id}`.slice(0, 40);
}

export function postingHomeAdUrl(adType, adId) {
  const url = new URL(PUBLIC_SITE);
  const queryKey = POSTING_QUERY[cleanText(adType).toLowerCase()] || 'recruit';
  url.searchParams.set(queryKey, cleanText(adId));
  url.searchParams.set('utm_source', 'home_banner');
  url.searchParams.set('utm_campaign', postingHomeAdCampaignId(adType, adId));
  return url.toString();
}

export function buildPostingHomeAdCampaign({ adType, adId, title, fileUrl, fileType, formUrl }) {
  const titleText = cleanText(title, 'InsureConnect posting').slice(0, 200);
  const image = isImageFile(fileUrl, fileType) ? (safeAssetUrl(fileUrl) || DEFAULT_IMAGE) : DEFAULT_IMAGE;
  const linkUrl = safeHttpUrl(formUrl) || postingHomeAdUrl(adType, adId);
  return {
    id: postingHomeAdCampaignId(adType, adId),
    name: `Home banner: ${titleText}`.slice(0, 80),
    enabled: true,
    images: [image],
    link_url: linkUrl,
    alt: titleText,
    cta_text: DEFAULT_CTA,
    weight: 100,
    start_at: kstDate(0),
    end_at: kstDate(6),
  };
}

export async function upsertPostingHomeAdCampaign(env, posting) {
  const config = await readHomeAdConfig(env);
  const campaign = buildPostingHomeAdCampaign(posting);
  let campaigns = config.campaigns.filter(Boolean);
  const existingIndex = campaigns.findIndex((c) => String(c.id || '') === campaign.id);
  if (existingIndex >= 0) campaigns[existingIndex] = { ...campaigns[existingIndex], ...campaign };
  else campaigns.unshift(campaign);

  if (campaigns.length > MAX_CAMPAIGNS) {
    const disposable = campaigns.findIndex((c) => c.id !== campaign.id && String(c.id || '').startsWith('posting_'));
    if (disposable >= 0) campaigns.splice(disposable, 1);
    campaigns = campaigns.slice(0, MAX_CAMPAIGNS);
  }

  const next = { ...config, campaigns };
  await env.DB.prepare(
    `INSERT INTO ic_site_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(HOME_AD_CONFIG_KEY, JSON.stringify(next)).run();
  return { ok: true, campaign };
}
