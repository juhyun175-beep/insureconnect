import { ensureOrderTables, ensureOrderFulfillmentCols } from './orders.js';
import { ensureOrderOptionCols } from './options.js';
import { sendMemoToMember } from './kakao-msg.js';

const AD_META = {
  recruit: { table: 'ic_recruitments', label: '채용' },
  lecture: { table: 'ic_lectures', label: '강의' },
  meetup: { table: 'ic_meetings', label: '모임' },
};

const PUBLIC_SITE = 'https://insureconnect.co.kr';
const HOME_AD_KEY = 'home_ad';
const HOME_BANNER_DAYS = 7;
const MAX_HOME_AD_CAMPAIGNS = 20;

const OPTION_LABELS = {
  featured_listing: '추천공고 등록',
  dm_inquiry: '1:1 문의 기능',
  kakao_blast: '카카오톡 전 회원 알림 1회',
  home_banner7: '홈 배너 노출 7일',
  open_chat_promo: '오픈채팅 풀데이 점유',
};

function optionKey(opt) {
  if (opt && typeof opt === 'object') return String(opt.key || opt.id || opt.option || '');
  return String(opt || '');
}

export function parseOrderOptions(raw) {
  let arr = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch (_) { arr = []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const opt of arr) {
    const key = optionKey(opt);
    if (!key || out.some((x) => x.key === key)) continue;
    out.push({ key, raw: opt });
  }
  return out;
}

function status(label, state, message, extra = {}) {
  return {
    label,
    status: state,
    message,
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

function manualMessage(key) {
  if (key === 'open_chat_promo') return '오픈채팅 풀데이 점유는 운영자가 등록자와 직접 대화로 안내합니다.';
  return '관리자 확인이 필요합니다.';
}

function cut(s, n) {
  return String(s || '').trim().slice(0, n);
}

function compact(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function kstDate(offsetDays = 0) {
  return new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000)
    .toISOString()
    .slice(0, 10);
}

function absoluteUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return 'https:' + s;
  if (s.startsWith('/')) return PUBLIC_SITE + s;
  return PUBLIC_SITE + '/' + s;
}

function ogType(adType) {
  return adType === 'meetup' ? 'meetup' : adType;
}

function detailUrl(adType, id) {
  return `${PUBLIC_SITE}/og/${encodeURIComponent(ogType(adType))}/${encodeURIComponent(id)}`;
}

function dynamicOgImage(adType, id) {
  const svgUrl = `${PUBLIC_SITE}/og-image/${encodeURIComponent(ogType(adType))}/${encodeURIComponent(id)}`;
  return `https://wsrv.nl/?url=${encodeURIComponent(svgUrl)}&output=png&w=1200&h=630&fit=cover`;
}

function imageForAd(adType, id, ad) {
  if (ad && ad.file_type === 'image' && ad.file_url) return absoluteUrl(ad.file_url);
  return dynamicOgImage(adType, id);
}

function adTitle(meta, ad) {
  return `[${meta.label}] ${cut(ad?.title || '새 공고', 80)}`;
}

function adDescription(adType, ad) {
  if (adType === 'recruit') {
    return cut(compact([ad?.company_name, ad?.description].filter(Boolean).join(' - ')), 180)
      || '인슈어커넥트 채용공고를 확인하세요.';
  }
  if (adType === 'lecture') {
    return cut(compact([ad?.instructor, ad?.description].filter(Boolean).join(' - ')), 180)
      || '인슈어커넥트 강의공고를 확인하세요.';
  }
  return cut(compact([ad?.host, ad?.title].filter(Boolean).join(' - ')), 180)
    || '인슈어커넥트 모임공고를 확인하세요.';
}

function homeAdName(meta, ad, orderId) {
  return cut(`유료 홈배너 ${meta.label} #${orderId} - ${ad?.title || ''}`, 80);
}

async function getAdRow(env, adType, id) {
  if (adType === 'recruit') {
    return await env.DB.prepare('SELECT * FROM ic_recruitments WHERE id = ?').bind(id).first().catch(() => null);
  }
  if (adType === 'lecture') {
    return await env.DB.prepare('SELECT * FROM ic_lectures WHERE id = ?').bind(id).first().catch(() => null);
  }
  if (adType === 'meetup') {
    return await env.DB.prepare('SELECT * FROM ic_meetings WHERE id = ?').bind(id).first().catch(() => null);
  }
  return null;
}

async function sendKakaoBlast(env, meta, adType, id, ad) {
  if (!env.KAKAO_REST_KEY) {
    return status(OPTION_LABELS.kakao_blast, 'auto_failed', 'KAKAO_REST_KEY가 없어 카카오톡 자동 발송을 실행하지 못했습니다.', {
      mode: 'kakao_broadcast',
      total: 0,
      sent: 0,
      failed: 0,
      revoked: 0,
    });
  }

  const rs = await env.DB.prepare(
    `SELECT id, kakao_access_token, kakao_refresh_token, kakao_token_expires
       FROM ic_members
      WHERE alert_optin = 1 AND kakao_refresh_token IS NOT NULL`
  ).all().catch(() => ({ results: [] }));
  const members = rs.results || [];
  const payload = {
    title: adTitle(meta, ad),
    description: adDescription(adType, ad),
    url: detailUrl(adType, id),
    image: imageForAd(adType, id, ad),
  };

  let sent = 0, failed = 0, revoked = 0, cursor = 0;
  const worker = async () => {
    while (cursor < members.length) {
      const m = members[cursor++];
      const r = await sendMemoToMember(env, m, payload);
      if (r.ok) sent++;
      else {
        failed++;
        if (r.revoked) {
          revoked++;
          await env.DB.prepare(`UPDATE ic_members SET alert_optin = 0 WHERE id = ?`).bind(m.id).run().catch(() => {});
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, members.length) }, worker));

  return status(
    OPTION_LABELS.kakao_blast,
    'auto_done',
    `카카오톡 알림 자동 발송 완료: 대상 ${members.length}명, 성공 ${sent}명, 실패 ${failed}명`,
    { mode: 'kakao_broadcast', total: members.length, sent, failed, revoked, url: payload.url, image: payload.image }
  );
}

async function ensureSiteConfigTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_site_config (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
}

async function readHomeAdConfig(env) {
  await ensureSiteConfigTable(env);
  const row = await env.DB.prepare(`SELECT value FROM ic_site_config WHERE key = ?`).bind(HOME_AD_KEY).first().catch(() => null);
  let raw = {};
  try { raw = row && row.value ? JSON.parse(row.value) || {} : {}; } catch (_) { raw = {}; }
  let campaigns = Array.isArray(raw.campaigns) ? raw.campaigns : null;
  if (!campaigns) {
    let imgs = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
    if (!imgs.length && raw.banner_url) imgs = [raw.banner_url];
    else if (!imgs.length && raw.popup_url) imgs = [raw.popup_url];
    campaigns = [{
      id: 'main',
      name: '기본 캠페인',
      enabled: raw.enabled === true,
      images: imgs,
      link_url: raw.link_url || '',
      alt: raw.alt || '',
      cta_text: raw.cta_text || '자세히 보기',
      weight: 1,
      start_at: '',
      end_at: '',
    }];
  }
  return {
    campaigns,
    rotation: raw.rotation || 'sequential',
    popup: raw.popup || { enabled: true, frequency: 'once_day', delay_ms: 900 },
  };
}

async function saveHomeAdConfig(env, config) {
  await ensureSiteConfigTable(env);
  await env.DB.prepare(
    `INSERT INTO ic_site_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(HOME_AD_KEY, JSON.stringify(config)).run();
}

async function createHomeBannerCampaign(env, meta, adType, id, orderId, ad) {
  const config = await readHomeAdConfig(env);
  const start = kstDate(0);
  const end = kstDate(HOME_BANNER_DAYS - 1);
  const campaignId = `auto_${orderId}_${adType}_${id}`.slice(0, 40);
  const url = detailUrl(adType, id);
  const image = imageForAd(adType, id, ad);
  const campaign = {
    id: campaignId,
    name: homeAdName(meta, ad, orderId),
    enabled: true,
    images: [image],
    link_url: url,
    alt: cut(adTitle(meta, ad), 200),
    cta_text: '자세히 보기',
    weight: 1,
    start_at: start,
    end_at: end,
  };
  const rest = (config.campaigns || []).filter((c) => c && c.id !== campaignId);
  config.campaigns = [campaign, ...rest].slice(0, MAX_HOME_AD_CAMPAIGNS);
  await saveHomeAdConfig(env, config);
  return status(
    OPTION_LABELS.home_banner7,
    'auto_done',
    `홈 배너 7일 캠페인을 자동 등록했습니다. (${start}~${end})`,
    { mode: 'home_banner_campaign', campaign_id: campaignId, start_at: start, end_at: end, url, image }
  );
}

async function ensureOrderReadiness(env) {
  await ensureOrderTables(env);
  await ensureOrderOptionCols(env);
  await ensureOrderFulfillmentCols(env);
}

export async function fulfillApprovedOptions(env, { adType, adId }) {
  const meta = AD_META[adType];
  const id = parseInt(adId, 10);
  if (!meta || !id) return { ok: false, error: 'invalid ad target' };

  await ensureOrderReadiness(env);
  const order = await env.DB.prepare(
    `SELECT id, options_json, fulfilled_json, status FROM ad_orders
      WHERE ad_type = ? AND ad_id = ? ORDER BY id DESC LIMIT 1`
  ).bind(adType, id).first().catch(() => null);
  if (!order) return { ok: true, order_id: null, options: [], fulfilled: {} };

  const options = parseOrderOptions(order.options_json);
  let fulfilled = {};
  try { fulfilled = order.fulfilled_json ? JSON.parse(order.fulfilled_json) || {} : {}; } catch (_) { fulfilled = {}; }

  const has = (key) => options.some((o) => o.key === key);
  let adRow = null;
  const needAdRow = has('kakao_blast') || has('home_banner7');
  if (needAdRow) {
    adRow = await getAdRow(env, adType, id);
  }

  if (has('featured_listing')) {
    await env.DB.prepare(
      `UPDATE ${meta.table}
          SET featured_until =
                CASE
                  WHEN featured_until IS NULL OR featured_until <= datetime('now')
                    THEN datetime('now', '+3 days')
                  ELSE featured_until
                END,
              updated_at = datetime('now')
        WHERE id = ?`
    ).bind(id).run();
    fulfilled.featured_listing = status(
      OPTION_LABELS.featured_listing,
      'auto_done',
      '승인 시 상단노출 상태를 보장했습니다.',
      { mode: 'ensure_featured_until' }
    );
  }

  if (has('dm_inquiry')) {
    fulfilled.dm_inquiry = status(
      OPTION_LABELS.dm_inquiry,
      'auto_done',
      '1:1 문의 버튼은 승인된 공고 상세에서 자동으로 사용 가능합니다.',
      { mode: 'existing_dm_button' }
    );
  }

  if (has('kakao_blast') && fulfilled.kakao_blast?.status !== 'auto_done') {
    fulfilled.kakao_blast = adRow
      ? await sendKakaoBlast(env, meta, adType, id, adRow)
      : status(OPTION_LABELS.kakao_blast, 'auto_failed', '대상 공고를 찾지 못해 카카오톡 자동 발송을 실행하지 못했습니다.', { mode: 'kakao_broadcast' });
  }

  if (has('home_banner7') && fulfilled.home_banner7?.status !== 'auto_done') {
    fulfilled.home_banner7 = adRow
      ? await createHomeBannerCampaign(env, meta, adType, id, order.id, adRow)
      : status(OPTION_LABELS.home_banner7, 'auto_failed', '대상 공고를 찾지 못해 홈 배너 자동 등록을 실행하지 못했습니다.', { mode: 'home_banner_campaign' });
  }

  for (const key of ['open_chat_promo']) {
    if (!has(key)) continue;
    fulfilled[key] = status(OPTION_LABELS[key], 'manual_required', manualMessage(key));
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE ad_orders
        SET status = CASE WHEN status = 'refunded' THEN status ELSE 'published' END,
            fulfilled_json = ?,
            fulfilled_at = ?
      WHERE id = ?`
  ).bind(options.length ? JSON.stringify(fulfilled) : null, options.length ? now : null, order.id).run();

  return {
    ok: true,
    order_id: order.id,
    options: options.map((o) => o.raw),
    fulfilled,
  };
}
