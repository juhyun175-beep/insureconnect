import { ensureOrderTables, ensureOrderFulfillmentCols } from './orders.js';
import { ensureOrderOptionCols, OPTION_CATALOG } from './options.js';
import { ensureBoostCols } from './posting-widget.js';
import { optinCount, enqueueBroadcast, drainKakaoQueue } from './kakao-queue.js';

const AD_META = {
  recruit: { table: 'ic_recruitments', label: '채용' },
  lecture: { table: 'ic_lectures', label: '강의' },
  meetup: { table: 'ic_meetings', label: '모임' },
};

const DM_TABLES = ['ic_recruitments', 'ic_lectures', 'ic_meetings'];

const PUBLIC_SITE = 'https://insureconnect.co.kr';
const HOME_AD_KEY = 'home_ad';
const HOME_BANNER_DAYS = 7;
const MAX_HOME_AD_CAMPAIGNS = 20;

const SEO_BOOST_SQL = {
  recruit: {
    update: `UPDATE ic_recruitments
        SET seo_boost_until =
              CASE
                WHEN seo_boost_until IS NULL OR seo_boost_until <= datetime('now')
                  THEN datetime('now', '+7 days')
                ELSE seo_boost_until
              END
      WHERE id = ?`,
    select: `SELECT seo_boost_until FROM ic_recruitments WHERE id = ?`,
  },
  lecture: {
    update: `UPDATE ic_lectures
        SET seo_boost_until =
              CASE
                WHEN seo_boost_until IS NULL OR seo_boost_until <= datetime('now')
                  THEN datetime('now', '+7 days')
                ELSE seo_boost_until
              END
      WHERE id = ?`,
    select: `SELECT seo_boost_until FROM ic_lectures WHERE id = ?`,
  },
  meetup: {
    update: `UPDATE ic_meetings
        SET seo_boost_until =
              CASE
                WHEN seo_boost_until IS NULL OR seo_boost_until <= datetime('now')
                  THEN datetime('now', '+7 days')
                ELSE seo_boost_until
              END
      WHERE id = ?`,
    select: `SELECT seo_boost_until FROM ic_meetings WHERE id = ?`,
  },
};

export async function ensureDmCol(env) {
  for (const table of DM_TABLES) {
    await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN dm_enabled INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  }
}

const OPTION_LABELS = {
  featured_listing: '추천공고 등록 (상단노출 7일)',
  dm_inquiry: '1:1 문의 기능',
  kakao_blast: '카카오톡 전 회원 알림 1회',
  seo_boost: 'SEO 페이지 상단 고정 7일 (전 SEO 페이지 위젯 1번 슬롯 + PICK 배지)',
  open_chat_post: '오픈채팅 골든타임 게시 1회',
  bundle_boost: '부스트 패키지 (SEO 고정 7일 + 오픈챗 게시 2회 + 카톡 전회원 알림 1회)',
  home_banner7: '홈 배너 노출 7일',
  open_chat_promo: '오픈채팅 풀데이 점유',
};

const OPEN_CHAT_SLOT_LABELS = {
  am8: '오전 8시',
  noon: '점심 12:30',
  pm9: '저녁 9시',
};
const OPEN_CHAT_SLOT_UNKNOWN = '시간대 미지정 — 등록자와 협의 필요';

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

function optionSlot(raw, fallback = null) {
  if (raw && typeof raw === 'object' && OPEN_CHAT_SLOT_LABELS[String(raw.slot || '')]) return String(raw.slot);
  return fallback;
}

function openChatPostMeta(raw) {
  const countRaw = raw && typeof raw === 'object' ? parseInt(raw.count ?? raw.quantity ?? raw.qty, 10) : 1;
  const count = Math.max(1, Math.min(3, Number.isFinite(countRaw) ? countRaw : 1));
  const slot = optionSlot(raw);
  return { count, slot, slotLabel: OPEN_CHAT_SLOT_LABELS[slot] || OPEN_CHAT_SLOT_UNKNOWN };
}

function manualMessage(key, raw) {
  if (key === 'open_chat_post') {
    const m = openChatPostMeta(raw);
    return `오픈채팅 골든타임 게시 ${m.count}회 (${m.slotLabel}) — 운영자가 해당 시간대에 직접 게시합니다.`;
  }
  if (key === 'open_chat_promo') return '오픈채팅 풀데이 점유는 운영자가 등록자와 직접 대화로 안내합니다.';
  return '관리자 확인이 필요합니다.';
}

function expandedOption(key, raw = { key }) {
  return { key, raw };
}

function expandBundles(options) {
  const bundle = options.find((o) => o.key === 'bundle_boost');
  if (!bundle) return { options, expanded: false };
  const includes = OPTION_CATALOG.bundle_boost?.includes || [];
  const included = new Set(includes.map((x) => x.key).filter(Boolean));
  const bundleSlot = optionSlot(bundle.raw);
  const out = [];
  const seen = new Set();
  const push = (opt) => {
    if (!opt || !opt.key || seen.has(opt.key)) return;
    seen.add(opt.key);
    out.push(opt);
  };
  for (const opt of options) {
    if (opt.key === 'bundle_boost') {
      for (const inc of includes) {
        if (!inc || !inc.key) continue;
        if (inc.key === 'open_chat_post') {
          push(expandedOption('open_chat_post', { key: 'open_chat_post', count: inc.count || 1, slot: bundleSlot }));
        } else {
          push(expandedOption(inc.key, { key: inc.key }));
        }
      }
      continue;
    }
    if (included.has(opt.key)) continue;
    push(opt);
  }
  return { options: out, expanded: true };
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

function kstDateTime(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return s;
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
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

/** v2.123.0: 즉시 전량 발송 → 대기열 등록 + 인라인 1청크 드레인.
 *   입금대기(final_price>0) 주문은 발송을 보류(manual_required) — 관리자가 결제완료(mark_paid)
 *   처리하면 fulfillApprovedOptions 재실행으로 이 지점을 다시 지나며 대기열에 등록된다.
 *   (카톡 발송은 비가역이므로 유일하게 입금 게이트를 거는 옵션) */
async function sendKakaoBlast(env, meta, adType, id, ad, order) {
  if (!env.KAKAO_REST_KEY) {
    return status(OPTION_LABELS.kakao_blast, 'auto_failed', 'KAKAO_REST_KEY가 없어 카카오톡 자동 발송을 실행하지 못했습니다.', {
      mode: 'kakao_broadcast',
      total: 0,
      sent: 0,
      failed: 0,
      revoked: 0,
    });
  }

  if (order && order.status === 'pending_payment' && (order.final_price || 0) > 0) {
    return status(
      OPTION_LABELS.kakao_blast,
      'manual_required',
      '입금대기 주문이라 카카오톡 발송을 보류했습니다. 관리자가 입금확인(결제완료) 처리하면 자동으로 발송 대기열에 등록됩니다.',
      { mode: 'kakao_queue', gated: 'pending_payment', total: 0, sent: 0, failed: 0, revoked: 0 }
    );
  }

  const total = await optinCount(env);
  if (total === 0) {
    return status(
      OPTION_LABELS.kakao_blast,
      'manual_required',
      '알림 수신 동의 회원이 0명이라 자동 발송할 수 없습니다. 구매자와 조율(환불/대체 이행)이 필요합니다.',
      { mode: 'kakao_broadcast', total: 0, sent: 0, failed: 0, revoked: 0 }
    );
  }
  const payload = {
    title: adTitle(meta, ad),
    description: adDescription(adType, ad),
    url: detailUrl(adType, id),
    image: imageForAd(adType, id, ad),
  };

  const batchKey = `blast:${order?.id || `${adType}:${id}`}`;
  await enqueueBroadcast(env, payload, batchKey);
  const drained = await drainKakaoQueue(env, 20).catch(() => ({ sent: 0, failed: 0, revoked: 0, remaining: total }));

  return status(
    OPTION_LABELS.kakao_blast,
    'auto_queued',
    `카카오톡 알림 대기열 등록 완료: 대상 ${total}명 (즉시 발송 ${drained.sent}명 · 나머지 ${Math.max(0, drained.remaining)}명은 수분 내 자동 발송)`,
    { mode: 'kakao_queue', batch_key: batchKey, total, sent: drained.sent, failed: drained.failed, revoked: drained.revoked, url: payload.url, image: payload.image }
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

async function applySeoBoost(env, adType, id) {
  const sql = SEO_BOOST_SQL[adType];
  if (!sql) return status(OPTION_LABELS.seo_boost, 'auto_failed', 'SEO 고정 대상 공고 타입을 확인하지 못했습니다.', { mode: 'seo_boost_until' });
  await ensureBoostCols(env);
  await env.DB.prepare(sql.update).bind(id).run();
  const row = await env.DB.prepare(sql.select).bind(id).first().catch(() => null);
  const until = kstDateTime(row?.seo_boost_until) || kstDateTime(new Date(Date.now() + 7 * 86400000).toISOString());
  return status(
    OPTION_LABELS.seo_boost,
    'auto_done',
    `SEO 전 페이지 위젯 상단 고정 7일을 적용했습니다. (~ ${until} KST)`,
    { mode: 'seo_boost_until' }
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
    `SELECT id, options_json, fulfilled_json, status, final_price FROM ad_orders
      WHERE ad_type = ? AND ad_id = ? ORDER BY id DESC LIMIT 1`
  ).bind(adType, id).first().catch(() => null);
  if (!order) return { ok: true, order_id: null, options: [], fulfilled: {} };

  let options = parseOrderOptions(order.options_json);
  let fulfilled = {};
  try { fulfilled = order.fulfilled_json ? JSON.parse(order.fulfilled_json) || {} : {}; } catch (_) { fulfilled = {}; }
  const bundle = expandBundles(options);
  options = bundle.options;
  if (bundle.expanded) {
    fulfilled.bundle_boost = status(
      OPTION_LABELS.bundle_boost,
      'auto_done',
      '패키지 구성 옵션으로 전개되어 개별 이행됩니다.',
      { mode: 'bundle_expand' }
    );
  }

  const has = (key) => options.some((o) => o.key === key);
  let adRow = null;
  const needAdRow = has('dm_inquiry') || has('kakao_blast') || has('home_banner7');
  if (needAdRow) {
    adRow = await getAdRow(env, adType, id);
  }

  // v2.123.0: 유료 추천공고 = 상단노출 7일 '가산' — 무료 첫승인 맛보기 3일과 차별화.
  //   fulfilled 가드로 재승인 시 중복 가산 방지(기간 연장형이라 CASE 만으론 멱등 아님).
  if (has('featured_listing') && fulfilled.featured_listing?.status !== 'auto_done') {
    await env.DB.prepare(
      `UPDATE ${meta.table}
          SET featured_until = datetime(
                CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now')
                     THEN featured_until ELSE datetime('now') END,
                '+7 days'),
              updated_at = datetime('now')
        WHERE id = ?`
    ).bind(id).run();
    fulfilled.featured_listing = status(
      OPTION_LABELS.featured_listing,
      'auto_done',
      '상단노출 7일을 적용했습니다 (남은 노출기간에 가산 — 첫 승인 무료 3일과 별도).',
      { mode: 'featured_until_plus7' }
    );
  }

  if (has('dm_inquiry')) {
    await ensureDmCol(env);
    if (adRow?.submitter_id) {
      await env.DB.prepare(`UPDATE ${meta.table} SET dm_enabled = 1 WHERE id = ?`).bind(id).run();
      fulfilled.dm_inquiry = status(
        OPTION_LABELS.dm_inquiry,
        'auto_done',
        '1:1 문의 버튼을 활성화했습니다.',
        { mode: 'dm_enabled' }
      );
    } else {
      fulfilled.dm_inquiry = status(
        OPTION_LABELS.dm_inquiry,
        'auto_failed',
        '등록자 회원 계정이 연결되지 않아 1:1 문의를 활성화할 수 없습니다. 등록자와 조율(환불/계정 연결)이 필요합니다.',
        { mode: 'dm_enabled' }
      );
    }
  }

  if (has('seo_boost')) {
    fulfilled.seo_boost = await applySeoBoost(env, adType, id);
  }

  if (has('kakao_blast') && !['auto_done', 'auto_queued'].includes(fulfilled.kakao_blast?.status)) {
    fulfilled.kakao_blast = adRow
      ? await sendKakaoBlast(env, meta, adType, id, adRow, order)
      : status(OPTION_LABELS.kakao_blast, 'auto_failed', '대상 공고를 찾지 못해 카카오톡 자동 발송을 실행하지 못했습니다.', { mode: 'kakao_broadcast' });
  }

  if (has('home_banner7') && fulfilled.home_banner7?.status !== 'auto_done') {
    fulfilled.home_banner7 = adRow
      ? await createHomeBannerCampaign(env, meta, adType, id, order.id, adRow)
      : status(OPTION_LABELS.home_banner7, 'auto_failed', '대상 공고를 찾지 못해 홈 배너 자동 등록을 실행하지 못했습니다.', { mode: 'home_banner_campaign' });
  }

  for (const key of ['open_chat_post', 'open_chat_promo']) {
    if (!has(key)) continue;
    const opt = options.find((o) => o.key === key);
    const extra = key === 'open_chat_post' ? (() => {
      const m = openChatPostMeta(opt?.raw);
      return { mode: 'open_chat_post', count: m.count, slot: m.slot };
    })() : {};
    fulfilled[key] = status(OPTION_LABELS[key], 'manual_required', manualMessage(key, opt?.raw), extra);
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
