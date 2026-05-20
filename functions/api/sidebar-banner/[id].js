import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const setId = url.searchParams.get('set_id');
  if (setId) {
    await env.DB.prepare(`DELETE FROM ic_sidebar_banner WHERE set_id = ?`).bind(setId).run();
    return json({ ok: true, scope: 'set' });
  }
  await env.DB.prepare(`DELETE FROM ic_sidebar_banner WHERE id = ?`).bind(params.id).run();
  return json({ ok: true, scope: 'item' });
});
