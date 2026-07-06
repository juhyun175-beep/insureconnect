import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { maskPII } from '../../_lib/mask.js';

export const onRequestOptions = () => corsPreflight();

async function ensureKakaoHighlightCols(env) {
  await env.DB.prepare(`ALTER TABLE ic_kakao_stats ADD COLUMN messages TEXT`).run().catch(() => {});
}

function parseJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return [];
  try {
    const parsed = JSON.parse(v || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

const URL_RE = /(https?:\/\/|www\.|open\.kakao\.com|오픈채팅\s*링크?)/i;

function maskNick(input) {
  const s = String(input || '').trim().slice(0, 30);
  if (!s) return '';
  if (/^[가-힣]{2,}$/.test(s)) {
    if (s.length === 2) return s[0] + '○';
    return s[0] + '○○';
  }
  return s[0] + '***';
}

function sanitizeHighlights(items, maskNicknames) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    if (!item || out.length >= 12) break;
    const rawContent = String(item.content ?? item.c ?? '').replace(/\s+/g, ' ').trim();
    if (!rawContent || URL_RE.test(rawContent)) continue;
    const masked = maskPII(rawContent).text.trim();
    if (!masked) continue;
    const rawName = String(item.name ?? item.n ?? '').trim();
    const rawTime = item.time ?? item.t ?? null;
    out.push({
      n: maskNicknames ? maskNick(rawName) : rawName.slice(0, 30),
      t: rawTime == null ? null : String(rawTime).slice(0, 20),
      c: masked.slice(0, 120),
    });
  }
  return out;
}

/** GET — ?latest=1 이면 최신 1건, 그 외 목록 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  await ensureKakaoHighlightCols(env);
  const url = new URL(request.url);
  const limit = url.searchParams.get('latest') === '1' ? 1 : 20;
  const rs = await env.DB.prepare(
    `SELECT id, room_name, period_label, rankings, messages, total_messages, participant_count, updated_at, created_at
     FROM ic_kakao_stats ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  // JSON 문자열 → 파싱
  const results = (rs.results || []).map(r => ({
    ...r,
    rankings: parseJsonArray(r.rankings),
    messages: parseJsonArray(r.messages)
  }));
  return json(results);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureKakaoHighlightCols(env);
  const body = await request.json();
  const highlights = sanitizeHighlights(body.highlights, body.mask_nick !== false);
  const r = await env.DB.prepare(
    `INSERT INTO ic_kakao_stats (room_name, period_label, rankings, messages, total_messages, participant_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.room_name || '오픈채팅방',
    body.period_label || null,
    JSON.stringify(body.rankings || []),
    JSON.stringify(highlights),
    body.total_messages || 0,
    body.participant_count || 0,
    body.updated_at || new Date().toISOString()
  ).first();
  return json({ id: r.id });
});
