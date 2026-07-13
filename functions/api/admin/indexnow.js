import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { submitUrls } from '../../_lib/indexnow.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const urls = Array.isArray(body.urls) ? body.urls : (body.url ? [body.url] : []);
  const result = await submitUrls(env, urls);
  return json(result, result.succeeded > 0 ? 200 : 502);
});
