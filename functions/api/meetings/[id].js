import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ensureMeetingsTable } from '../../_lib/meetings.js';
export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ params, env }) => handle(async () => {
  await ensureMeetingsTable(env);
  const row = await env.DB.prepare(`SELECT * FROM ic_meetings WHERE id = ?`).bind(params.id).first();
  if (!row) return error('Not found', 404);
  return json(row);
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
