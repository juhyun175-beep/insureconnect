import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** GET — ?latest=1 이면 최신 1건, 그 외 목록 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = url.searchParams.get('latest') === '1' ? 1 : 20;
  const rs = await env.DB.prepare(
    `SELECT id, room_name, period_label, rankings, total_messages, participant_count, updated_at, created_at
     FROM ic_kakao_stats ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  // rankings는 JSON 문자열 → 파싱
  const results = (rs.results || []).map(r => ({
    ...r,
    rankings: typeof r.rankings === 'string' ? JSON.parse(r.rankings || '[]') : r.rankings
  }));
  return json(results);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const r = await env.DB.prepare(
    `INSERT INTO ic_kakao_stats (room_name, period_label, rankings, total_messages, participant_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.room_name || '오픈채팅방',
    body.period_label || null,
    JSON.stringify(body.rankings || []),
    body.total_messages || 0,
    body.participant_count || 0,
    body.updated_at || new Date().toISOString()
  ).first();
  return json({ id: r.id });
});
