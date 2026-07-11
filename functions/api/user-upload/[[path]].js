/**
 * 사용자 파일 업로드 (관리자 인증 없이) — 채용/강의 신청용
 *   POST /api/user-upload/recruitments/foo.pdf
 *   POST /api/user-upload/lectures/foo.jpg
 *
 * 허용 폴더: recruitments, lectures
 * 허용 MIME: image/*, application/pdf
 * 크기 제한: 10 MB
 * Rate-limit: IP당 1시간 20건 — D1(ic_upload_rl) 서버측 강제. (과거 client-side 신뢰 → 서버측으로 교체)
 */
import { json, corsPreflight } from '../../_lib/http.js';

const ALLOWED_FOLDERS = new Set(['recruitments', 'lectures', 'meetings', 'rental-cards']);
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|heic|heif)|application\/pdf)$/i;
const MAX_BYTES = 10 * 1024 * 1024;
const RL_MAX_PER_HOUR = 20;

/** IP당 시간당 업로드 횟수 제한. D1 장애 시 업로드를 막지 않음(best-effort). */
async function rateLimited(env, request) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ic_upload_rl (ip TEXT NOT NULL, ts TEXT NOT NULL DEFAULT (datetime('now')))`
    ).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_upload_rl_ip ON ic_upload_rl(ip, ts)`).run().catch(() => {});
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM ic_upload_rl WHERE ip = ? AND ts > datetime('now', '-1 hour')`
    ).bind(ip).first();
    if ((row?.n || 0) >= RL_MAX_PER_HOUR) return true;
    await env.DB.prepare(`INSERT INTO ic_upload_rl (ip) VALUES (?)`).bind(ip).run();
    if (Math.random() < 0.02) {
      await env.DB.prepare(`DELETE FROM ic_upload_rl WHERE ts < datetime('now', '-1 day')`).run().catch(() => {});
    }
    return false;
  } catch (_) { return false; }
}

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ params, request, env }) => {
  try {
    if (await rateLimited(env, request)) {
      return json({ error: '업로드가 너무 잦습니다. 1시간 후 다시 시도해 주세요.' }, 429);
    }
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
