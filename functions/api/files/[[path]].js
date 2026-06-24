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
/** v2.1.48: R2 miss 시 placeholder SVG — 깨진 이미지 자리에 "만료" 안내 카드 표시
 *  근본 원인: card-news/ prefix 의 R2 객체들이 외부 사고로 손실됨.
 *  DB orphan row 들은 보존(제목·메타 살아있음), 이미지만 placeholder. 재업로드 시 자동 복구.
 *  - 이미지 type (png/jpg/webp/gif/svg) 요청 시: SVG placeholder 반환
 *  - PDF / 기타: 그대로 404 (PDF 뷰어가 빈 영역 처리) */
function placeholderSvgResponse(key, isHead) {
  const filename = (key.split('/').pop() || '').slice(0, 60);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3f4f6"/>
      <stop offset="100%" stop-color="#e5e7eb"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <g transform="translate(600 380)" text-anchor="middle" font-family="Pretendard, -apple-system, sans-serif">
    <circle cx="0" cy="-60" r="60" fill="none" stroke="#9ca3af" stroke-width="6"/>
    <text x="0" y="-45" font-size="64" font-weight="800" fill="#9ca3af">!</text>
    <text x="0" y="50" font-size="36" font-weight="800" fill="#4b5563">이미지를 불러올 수 없습니다</text>
    <text x="0" y="100" font-size="22" font-weight="500" fill="#6b7280">관리자가 재업로드 시 자동 복구됩니다</text>
    <text x="0" y="180" font-size="14" font-weight="500" fill="#9ca3af">InsureConnect · ${filename.replace(/[<&>]/g, '')}</text>
  </g>
</svg>`;
  return new Response(isHead ? null : svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-R2-Fallback': 'placeholder',
    }
  });
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg)$/i;

// v2.94.1: 썸네일 최적화는 프론트에서 /cdn-cgi/image/(Cloudflare Image Transformations)로 처리.
//   그 변환의 "원본 소스"가 바로 이 핸들러가 서빙하는 /api/files/...png 임(여기선 원본만 반환).

async function serveFile({ params, request, env }, isHead) {
  const key = pathFromParams(params);
  if (!key) return new Response('Bad key', { status: 400 });
  try {
    const obj = isHead
      ? await env.STORAGE.head(key)
      : await env.STORAGE.get(key);
    if (!obj) {
      // v2.1.48: 이미지면 placeholder, 비이미지면 404 유지
      if (IMAGE_EXT_RE.test(key)) return placeholderSvgResponse(key, isHead);
      return new Response(isHead ? null : 'Not found', { status: 404 });
    }

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

    // v2.1.33: ?download=1[&name=...] → 강제 다운로드 (Content-Disposition: attachment)
    // PC 에선 inline 미리보기 대신 즉시 저장, 모바일에선 다운로드 매니저로 직행
    try {
      const reqUrl = new URL(request.url);
      if (reqUrl.searchParams.get('download') === '1') {
        const rawName = reqUrl.searchParams.get('name');
        const fallback = (key.split('/').pop() || 'file');
        const filename = (rawName && rawName.trim()) ? rawName.trim() : fallback;
        // RFC 5987: filename*=UTF-8'' 로 비ASCII(한글) 안전 처리
        const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
        const utf8  = encodeURIComponent(filename);
        headers.set('Content-Disposition',
          `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`);
      }
    } catch (_) {}

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
