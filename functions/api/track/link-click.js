import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9*3600*1000);
  return kst.toISOString().slice(0, 10);
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const { company_type, company_name } = await request.json();
  if (!company_type || !company_name) return json({ error: 'company_type, company_name required' }, 400);
  const date = kstDateKey();
  await env.DB.prepare(
    `INSERT INTO ic_link_clicks_daily (date, company_type, company_name, clicks)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (date, company_type, company_name) DO UPDATE SET clicks = clicks + 1`
  ).bind(date, company_type, company_name).run();
  return json({ ok: true });
});
