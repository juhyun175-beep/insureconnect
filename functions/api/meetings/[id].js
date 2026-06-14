import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { getUserFromRequest } from '../../_lib/auth.js';
import { ensureMeetingsTable, ensureParticipantsTable } from '../../_lib/meetings.js';
export const onRequestOptions = () => corsPreflight();

/** v2.70.0: 모임 상세는 '참여 게이트'.
 *   제목·주최·참여수만 공개. 장소·일시·설명·신청폼·이미지는 관리자/주최자/참여자만(서버단 차단).
 */
export const onRequestGet = async ({ params, request, env }) => handle(async () => {
  await ensureMeetingsTable(env);
  await ensureParticipantsTable(env);
  const row = await env.DB.prepare(`SELECT * FROM ic_meetings WHERE id = ?`).bind(params.id).first();
  if (!row) return error('Not found', 404);
  const id = row.id;
  const pc = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_meeting_participants WHERE meeting_id = ?`).bind(id).first().catch(() => null);
  const participant_count = pc?.n || 0;

  const isAdmin = verifyAdmin(request, env);
  const user = isAdmin ? null : await getUserFromRequest(env, request);
  let mine = false, canView = isAdmin;
  if (!isAdmin && user) {
    if (row.submitter_id && row.submitter_id === user.id) canView = true; // 주최자
    const p = await env.DB.prepare(`SELECT 1 FROM ic_meeting_participants WHERE meeting_id = ? AND member_id = ?`).bind(id, user.id).first().catch(() => null);
    if (p) { canView = true; mine = true; }
  }

  const teaser = { ok: true, id, title: row.title, host: row.host, status: row.status, participant_count, mine, locked: !canView };
  if (!canView) return json(teaser);
  // 참여자/주최/관리자만 명단까지 열람
  const pl = await env.DB.prepare(`SELECT nickname FROM ic_meeting_participants WHERE meeting_id = ? ORDER BY id ASC LIMIT 300`).bind(id).all().catch(() => ({ results: [] }));
  return json({
    ...teaser, locked: false,
    participants: (pl.results || []).map((p) => p.nickname || '회원'),
    description: row.description, location: row.location, event_at: row.event_at,
    form_url: row.form_url, file_url: row.file_url, file_type: row.file_type,
    created_at: row.created_at, featured_until: row.featured_until,
    ...(isAdmin ? { submitter_name: row.submitter_name, submitter_contact: row.submitter_contact } : {}),
  });
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureMeetingsTable(env);
  await env.DB.prepare(`DELETE FROM ic_meetings WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});

export const onRequestPatch = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureMeetingsTable(env);
  const body = await request.json();

  const cur = await env.DB.prepare(
    `SELECT status, featured_until FROM ic_meetings WHERE id = ?`
  ).bind(params.id).first();
  if (!cur) return error('Not found', 404);

  const allowed = ['title','host','description','location','event_at','file_url','file_type','form_url',
                   'status','reject_reason','approved_at'];
  const fields = allowed.filter(k => k in body);
  if (body.status === 'approved' && !('approved_at' in body)) {
    fields.push('approved_at');
    body.approved_at = new Date().toISOString();
  }
  const sets = fields.map(f => `${f} = ?`);
  const values = fields.map(f => body[f]);

  // 상단노출: 관리자 수동(feature_days) 또는 최초 승인 시 3일 무료 맛보기
  const autoFree = (body.status === 'approved' && cur.status !== 'approved' && cur.featured_until == null && !('feature_days' in body));
  if ('feature_days' in body) {
    const d = parseInt(body.feature_days, 10);
    if (Number.isFinite(d) && d > 0) { sets.push(`featured_until = datetime('now', ?)`); values.push('+' + d + ' days'); }
    else { sets.push('featured_until = NULL'); }
  } else if (autoFree) {
    sets.push(`featured_until = datetime('now', '+3 days')`);
  }

  if (!sets.length) return error('No fields');
  await env.DB.prepare(
    `UPDATE ic_meetings SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values, params.id).run();
  return json({ ok: true, featured_granted: autoFree });
});
