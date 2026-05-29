/**
 * v2.1.0: 결제된 자료 다운로드
 *
 *   GET /api/downloads/{token}
 *
 *   - download_token 검증
 *   - 만료 / 한도 / status=paid 확인
 *   - 통과 시 R2 의 단일 파일을 stream 응답 + Content-Disposition: attachment
 *   - download_count + 1
 */
import { handle, error, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

const TOKEN_RE = /^[A-Za-z0-9_-]{20,80}$/;

export const onRequestGet = async ({ params, env, request }) => handle(async () => {
  const token = String(params.token || '').trim();
  if (!TOKEN_RE.test(token)) return error('Invalid token', 400);

  const row = await env.DB.prepare(
    `SELECT p.*, pr.download_file_url, pr.download_filename, pr.name AS product_name
     FROM ic_purchases p
     JOIN ic_products pr ON pr.id = p.product_id
     WHERE p.download_token = ? LIMIT 1`
  ).bind(token).first();
  if (!row) return error('Not found', 404);

  if (row.status !== 'paid') return error('결제 미완료 상태입니다', 403);
  if (row.download_expires_at && new Date(row.download_expires_at + (row.download_expires_at.endsWith('Z') ? '' : 'Z')).getTime() < Date.now()) {
    return error('다운로드 기간이 만료되었습니다', 410);
  }
  if (row.download_count >= row.download_max) {
    return error(`다운로드 한도(${row.download_max}회) 초과`, 429);
  }
  if (!row.download_file_url) return error('상품 파일이 설정되지 않았습니다 — 관리자 문의', 500);

  // R2 fetch
  // download_file_url 형식: /api/files/{key}  →  R2 key 추출
  let key = row.download_file_url;
  const apiPrefix = '/api/files/';
  if (key.startsWith(apiPrefix)) key = key.slice(apiPrefix.length);
  else if (key.startsWith('http')) {
    const u = new URL(key);
    const i = u.pathname.indexOf(apiPrefix);
    if (i >= 0) key = u.pathname.slice(i + apiPrefix.length);
  }
  if (!key) return error('Invalid file path', 500);

  const obj = await env.STORAGE.get(key);
  if (!obj) return error('파일을 찾을 수 없습니다 — 관리자 문의', 404);

  // 카운트 증가 (비동기 — 다운로드와 병행)
  env.DB.prepare(`UPDATE ic_purchases SET download_count = download_count + 1 WHERE id = ?`)
    .bind(row.id).run().catch(() => {});

  const filename = row.download_filename || (key.split('/').pop() || 'download');
  // RFC 5987 한글 파일명 안전 처리
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
  const utf8 = encodeURIComponent(filename);
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const ctMap = { pdf: 'application/pdf', zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg' };
  const ct = ctMap[ext] || (obj.httpMetadata?.contentType) || 'application/octet-stream';

  return new Response(obj.body, {
    headers: {
      'Content-Type': ct,
      'Content-Length': String(obj.size || ''),
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    }
  });
});
