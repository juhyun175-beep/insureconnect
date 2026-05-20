import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** GET — 회사 필터 지원 (company OR company_name 둘 다 받음) */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);
  const company = url.searchParams.get('company') || url.searchParams.get('company_name');
  const sql = company
    ? `SELECT * FROM ic_newsletters WHERE company = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM ic_newsletters ORDER BY created_at DESC LIMIT ?`;
  const binds = company ? [company, limit] : [limit];
  const rs = await env.DB.prepare(sql).bind(...binds).all();
  // 응답에 company_name 별칭도 같이 (기존 코드 호환)
  const results = (rs.results || []).map(r => ({ ...r, company_name: r.company }));
  return json(results);
});

/** POST — company_name / company 둘 다 받음 */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const company = body.company || body.company_name;
  if (!company) return json({ error: 'company required' }, 400);
  const r = await env.DB.prepare(
    `INSERT INTO ic_newsletters (company, title, file_url, file_type) VALUES (?, ?, ?, ?) RETURNING id`
  ).bind(company, body.title || null, body.file_url || null, body.file_type || null).first();
  return json({ id: r.id });
});
