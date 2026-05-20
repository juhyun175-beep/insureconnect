import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** DELETE — id면 단건, set_id={uuid} 쿼리면 세트 통째 삭제 */
export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const setId = url.searchParams.get('set_id');
  if (setId) {
    await env.DB.prepare(`DELETE FROM ic_card_news WHERE set_id = ?`).bind(setId).run();
    return json({ ok: true, scope: 'set' });
  }
  await env.DB.prepare(`DELETE FROM ic_card_news WHERE id = ?`).bind(params.id).run();
  return json({ ok: true, scope: 'item' });
});
