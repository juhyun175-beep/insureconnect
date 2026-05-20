import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9*3600*1000);
  return kst.toISOString().slice(0, 10);
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const { menu, card } = await request.json();
  if (!menu || !card) return json({ error: 'menu, card required' }, 400);
  const date = kstDateKey();
  await env.DB.prepare(
    `INSERT INTO ic_card_clicks_daily (date, menu, card, clicks)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (date, menu, card) DO UPDATE SET clicks = clicks + 1`
  ).bind(date, menu, card).run();
  return json({ ok: true });
});
