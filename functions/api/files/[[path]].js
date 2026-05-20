/**
 * R2 파일 서빙 + 관리자 업로드/삭제
 *   GET    /api/files/{bucket-folder}/{filename}  → R2에서 읽어 반환 (공개)
 *   POST   /api/files/{bucket-folder}/{filename}  → R2에 업로드 (관리자)
 *   DELETE /api/files/{bucket-folder}/{filename}  → R2에서 삭제 (관리자)
 *
 * URL 예: /api/files/recruitments/foo.pdf
 *        /api/files/card-news/abc.jpg
 *        /api/files/home-popup/notice.pdf
 */
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { json, corsPreflight } from '../../_lib/http.js';

const PUBLIC_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
};

function pathFromParams(params) {
  const p = params.path;
  if (!p) return '';
  return Array.isArray(p) ? p.join('/') : p;
}

function inferContentType(key) {
  const ext = (key.split('.').pop() || '').toLowerCase();
  const map = {
    pdf:  'application/pdf',
    png:  'image/png',
    jpg:  'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif',
    svg:  'image/svg+xml',
    json: 'application/json',
    txt:  'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

export const onRequestOptions = () => corsPreflight();

/** GET — R2에서 파일 서빙 */
export const onRequestGet = async ({ params, env }) => {
  const key = pathFromParams(params);
  if (!key) return new Response('Bad key', { status: 400 });
  try {
    const obj = await env.STORAGE.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers(PUBLIC_HEADERS);
    headers.set('Content-Type', obj.httpMetadata?.contentType || inferContentType(key));
    headers.set('Content-Length', String(obj.size));
    if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
    return new Response(obj.body, { headers });
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500 });
  }
};

/** POST — 업로드 (관리자) */
export const onRequestPost = async ({ params, request, env }) => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const key = pathFromParams(params);
  if (!key) return json({ error: 'No key' }, 400);
  try {
    const contentType = request.headers.get('Content-Type') || inferContentType(key);
    await env.STORAGE.put(key, request.body, {
      httpMetadata: { contentType }
    });
    const fileUrl = `${new URL(request.url).origin}/api/files/${key}`;
    return json({ ok: true, key, file_url: fileUrl });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};

/** DELETE — 파일 삭제 (관리자) */
export const onRequestDelete = async ({ params, request, env }) => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const key = pathFromParams(params);
  if (!key) return json({ error: 'No key' }, 400);
  try {
    await env.STORAGE.delete(key);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
