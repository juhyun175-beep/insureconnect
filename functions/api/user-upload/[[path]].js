/**
 * 사용자 파일 업로드 (관리자 인증 없이) — 채용/강의 신청용
 *   POST /api/user-upload/recruitments/foo.pdf
 *   POST /api/user-upload/lectures/foo.jpg
 *
 * 허용 폴더: recruitments, lectures
 * 허용 MIME: image/*, application/pdf
 * 크기 제한: 10 MB
 * Rate-limit: IP당 1시간 5건 (KV/D1 미사용 → 간단히 client-side localStorage 신뢰 + 서버 측 파일명 충돌 방지)
 */
import { json, corsPreflight } from '../../_lib/http.js';

const ALLOWED_FOLDERS = new Set(['recruitments', 'lectures', 'rental-cards']);
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|heic|heif)|application\/pdf)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ params, request, env }) => {
  try {
    const p = params.path;
    const parts = Array.isArray(p) ? p : (p ? [p] : []);
    if (parts.length < 2) return json({ error: 'Path must be {folder}/{filename}' }, 400);
    const folder = parts[0];
    if (!ALLOWED_FOLDERS.has(folder)) return json({ error: 'Folder not allowed' }, 400);

    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    if (!ALLOWED_MIME.test(contentType)) {
      return json({ error: 'Only image/* or application/pdf allowed' }, 415);
    }
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BYTES) {
      return json({ error: 'File exceeds 10MB' }, 413);
    }

    // 파일명 정제 (확장자만 유지, 나머지는 서버에서 랜덤 생성)
    const filename = parts.slice(1).join('/');
    const ext = (filename.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    if (!ext) return json({ error: 'Invalid extension' }, 400);
    const rand = Math.random().toString(36).slice(2, 10);
    const ts = Date.now();
    const key = `${folder}/user_${ts}_${rand}.${ext}`;

    await env.STORAGE.put(key, request.body, {
      httpMetadata: { contentType }
    });
    const fileUrl = `${new URL(request.url).origin}/api/files/${key}`;
    return json({ ok: true, key, file_url: fileUrl });
  } catch (e) {
    return json({ error: e.message || 'Upload failed' }, 500);
  }
};
