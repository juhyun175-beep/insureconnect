/**
 * v2.1.0: 결제 상태 조회 (success_url 에서 폴링)
 *
 *   GET /api/payments/status?purchase_id={id}&email={email}
 *   응답: { status, download_token?, product_name?, download_url? }
 *
 *   - email 일치하지 않으면 거부 (간단한 본인 확인)
 *   - status='paid' 이면 download_token 반환
 *   - webhook 도착 전이면 status='pending', 클라이언트가 폴링
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const purchaseId = parseInt(url.searchParams.get('purchase_id'), 10);
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  if (!Number.isFinite(purchaseId)) return error('purchase_id required');
  if (!email) return error('email required');

  const row = await env.DB.prepare(
    `SELECT p.status, p.download_token, p.email, pr.name AS product_name, pr.download_filename
     FROM ic_purchases p JOIN ic_products pr ON pr.id = p.product_id
     WHERE p.id = ? LIMIT 1`
  ).bind(purchaseId).first();
  if (!row) return error('Not found', 404);
  if (row.email !== email) return error('Email mismatch', 403);

  const out = {
    status: row.status,
    product_name: row.product_name,
    download_filename: row.download_filename,
  };
  if (row.status === 'paid' && row.download_token) {
    out.download_token = row.download_token;
    out.download_url = `/api/downloads/${row.download_token}`;
  }
  return json(out);
});
