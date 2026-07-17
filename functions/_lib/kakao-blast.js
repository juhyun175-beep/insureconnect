import { sendMemoToMember } from './kakao-msg.js';

export const KAKAO_BLAST_TABLES = {
  recruit: 'ic_recruitments',
  lecture: 'ic_lectures',
  meetup: 'ic_meetings',
};

const SITE = 'https://insureconnect.co.kr';
const LABELS = { recruit: '채용공고', lecture: '강의공고', meetup: '모임공고' };
const QUERY_KEYS = { recruit: 'recruit', lecture: 'lecture', meetup: 'meeting' };
const DEFAULT_IMAGE = `${SITE}/logo-full.png`;

function cleanText(value, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function safeType(adType) {
  return KAKAO_BLAST_TABLES[adType] ? adType : 'recruit';
}

function safeTable(table) {
  if (Object.values(KAKAO_BLAST_TABLES).includes(table)) return table;
  throw new Error('invalid_kakao_blast_table');
}

function toAbsoluteUrl(value) {
  const s = cleanText(value).slice(0, 700);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return SITE + s;
  return '';
}

function isImage(fileUrl, fileType) {
  const type = cleanText(fileType).toLowerCase();
  const url = cleanText(fileUrl).toLowerCase();
  return type === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/.test(url);
}

export async function ensureKakaoBlastColumns(env, table) {
  const tableName = safeTable(table);
  await env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN kakao_blast_sent_at TEXT`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN kakao_blast_sent_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN kakao_blast_failed_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN kakao_blast_revoked_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN kakao_blast_last_error TEXT`).run().catch(() => {});
}

export function buildPostingKakaoBlast({ adType, adId, title, subtitle, fileUrl, fileType }) {
  const type = safeType(adType);
  const label = LABELS[type];
  const url = new URL(SITE);
  url.searchParams.set(QUERY_KEYS[type], cleanText(adId));
  url.searchParams.set('utm_source', 'kakao_blast');
  url.searchParams.set('utm_campaign', `${type}_${cleanText(adId)}`);

  const titleText = cleanText(title, label).slice(0, 120);
  const subtitleText = cleanText(subtitle).slice(0, 120);
  const description = [titleText, subtitleText].filter(Boolean).join('\n').slice(0, 240);
  return {
    title: `새 ${label}가 등록되었습니다`,
    description,
    url: url.toString(),
    image: isImage(fileUrl, fileType) ? (toAbsoluteUrl(fileUrl) || DEFAULT_IMAGE) : DEFAULT_IMAGE,
  };
}

export async function sendPostingKakaoBlast(env, posting) {
  const tableName = safeTable(posting.table || KAKAO_BLAST_TABLES[safeType(posting.adType)]);
  const adId = posting.adId;
  await ensureKakaoBlastColumns(env, tableName);

  const prev = await env.DB.prepare(
    `SELECT kakao_blast_sent_at FROM ${tableName} WHERE id = ?`
  ).bind(adId).first().catch(() => null);
  if (prev && prev.kakao_blast_sent_at) {
    return { ok: true, skipped: true, reason: 'already_sent', sent_at: prev.kakao_blast_sent_at };
  }

  if (!env.KAKAO_REST_KEY) {
    await env.DB.prepare(
      `UPDATE ${tableName} SET kakao_blast_last_error = ? WHERE id = ?`
    ).bind('missing_kakao_rest_key', adId).run().catch(() => {});
    return { ok: false, skipped: true, reason: 'missing_kakao_rest_key' };
  }

  const message = buildPostingKakaoBlast(posting);
  const rs = await env.DB.prepare(
    `SELECT id, kakao_access_token, kakao_refresh_token, kakao_token_expires
     FROM ic_members WHERE alert_optin = 1 AND kakao_refresh_token IS NOT NULL`
  ).all().catch(() => ({ results: [] }));
  const members = rs.results || [];

  let sent = 0;
  let failed = 0;
  let revoked = 0;
  let lastError = members.length ? '' : 'no_recipients';
  for (const member of members) {
    const result = await sendMemoToMember(env, member, message);
    if (result && result.ok) {
      sent++;
      continue;
    }
    failed++;
    lastError = cleanText(result && result.error, 'send_failed').slice(0, 80);
    if (result && result.revoked) {
      revoked++;
      await env.DB.prepare(
        `UPDATE ic_members SET alert_optin = 0 WHERE id = ?`
      ).bind(member.id).run().catch(() => {});
    }
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE ${tableName} SET kakao_blast_sent_at = ?, kakao_blast_sent_count = ?, kakao_blast_failed_count = ?, kakao_blast_revoked_count = ?, kakao_blast_last_error = ? WHERE id = ?`
  ).bind(now, sent, failed, revoked, lastError, adId).run().catch(() => {});

  return {
    ok: true,
    total: members.length,
    sent,
    failed,
    revoked,
    url: message.url,
    image: message.image,
  };
}
