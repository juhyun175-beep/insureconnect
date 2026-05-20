import { json, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = async ({ request, env }) => {
  return json(verifyAdmin(request, env));
};
