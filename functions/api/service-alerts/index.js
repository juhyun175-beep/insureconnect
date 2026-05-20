import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** GET — ?active=1 이면 현재 활성 알림만 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  if (url.searchParams.get('active') === '1') {
    const rs = await env.DB.prepare(
      `SELECT id, insurer, title, message, severity, starts_at, ends_at
       FROM ic_service_alerts
       WHERE is_active = 1
         AND (starts_at IS NULL OR starts_at <= datetime('now'))
         AND (ends_at   IS NULL OR ends_at   >= datetime('now'))
       ORDER BY starts_at DESC LIMIT 20`
    ).all();
    return json(rs.results || []);
  }
  const rs = await env.DB.prepare(
    `SELECT * FROM ic_service_alerts ORDER BY is_active DESC, starts_at DESC LIMIT 100`
  ).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const r = await env.DB.prepare(
    `INSERT INTO ic_service_alerts (insurer, title, message, severity, is_active, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.insurer || '',
    body.title || '',
    body.message || null,
    body.severity || 'info',
    body.is_active === false ? 0 : 1,
    body.starts_at || null,
    body.ends_at || null
  ).first();
  return json({ id: r.id });
});
