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

/** v2.1.16: GET/HEAD 공통 핸들러
 *   - 확장자가 알려진 타입(png/jpg/webp/pdf 등)이면 R2 stored metadata 무시하고 inferred MIME 사용
 *     → 과거 업로드 시 잘못 저장된 contentType(text/html 등) 이슈 자동 보정
 *   - HEAD 요청도 같은 헤더로 응답 (body 만 비움) — 카카오톡 스크래퍼의 og:image preflight 통과
 */
async function serveFile({ params, env }, isHead) {
  const key = pathFromParams(params);
  if (!key) return new Response('Bad key', { status: 400 });
  try {
    const obj = isHead
      ? await env.STORAGE.head(key)
      : await env.STORAGE.get(key);
    if (!obj) return new Response(isHead ? null : 'Not found', { status: 404 });

    const inferred = inferContentType(key);
    const stored   = obj.httpMetadata?.contentType;
    // 확장자에서 알려진 타입을 얻을 수 있으면 그것을 우선 (octet-stream 은 알 수 없음 의미)
    const finalCT = (inferred && inferred !== 'application/octet-stream')
      ? inferred
      : (stored || inferred);

    const headers = new Headers(PUBLIC_HEADERS);
    headers.set('Content-Type', finalCT);
    if (typeof obj.size === 'number') headers.set('Content-Length', String(obj.size));
    if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

    return new Response(isHead ? null : obj.body, { headers });
  } catch (e) {
    return new Response(isHead ? null : ('Error: ' + e.message), { status: 500 });
  }
}

/** GET — R2에서 파일 서빙 */
export const onRequestGet  = (ctx) => serveFile(ctx, false);

/** HEAD — 카카오/슬랙/라인 등 스크래퍼가 og:image preflight 로 보냄 */
export const onRequestHead = (ctx) => serveFile(ctx, true);

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
