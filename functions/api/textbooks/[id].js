import { getOneHandler, deleteHandler, patchHandler, corsPreflight } from '../../_lib/crud.js';
import { json, handle } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestGet    = getOneHandler('ic_textbooks');
export const onRequestDelete = deleteHandler('ic_textbooks');
export const onRequestPatch  = patchHandler('ic_textbooks', ['title','description','file_url','file_type']);

/** POST /api/textbooks/:id/download → download_count 증가 */
export const onRequestPost = async ({ params, env }) => handle(async () => {
  await env.DB.prepare(
    `UPDATE ic_textbooks SET download_count = download_count + 1 WHERE id = ?`
  ).bind(params.id).run();
  return json({ ok: true });
});
