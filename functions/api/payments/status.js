/**
 * v2.1.1 (master): 결제 상태 조회
 *
 *   GET /api/payments/status?purchase_id={id}&email={email}
 *   또는 /api/payments/status?order_id={orderId}&email={email}
 *
 *   - email 일치 확인 (간단한 본인 검증)
 *   - status='paid' 이면 download_token 반환
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const purchaseId = parseInt(url.searchParams.get('purchase_id'), 10);
  const orderId = url.searchParams.get('order_id');
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return error('email required');
  if (!Number.isFinite(purchaseId) && !orderId) return error('purchase_id or order_id required');

  const where = Number.isFinite(purchaseId) ? 'p.id = ?' : 'p.toss_order_id = ?';
  const bind = Number.isFinite(purchaseId) ? purchaseId : orderId;

  const row = await env.DB.prepare(
    `SELECT p.id, p.status, p.email, p.download_token, p.toss_method, p.toss_receipt_url,
            pr.name AS product_name, pr.download_filename
     FROM ic_purchases p JOIN ic_products pr ON pr.id = p.product_id
     WHERE ${where} LIMIT 1`
  ).bind(bind).first();
  if (!row) return error('Not found', 404);
  if (row.email !== email) return error('Email mismatch', 403);

  const out = {
    purchase_id: row.id,
    status: row.status,
    product_name: row.product_name,
    download_filename: row.download_filename,
    method: row.toss_method,
    receipt_url: row.toss_receipt_url,
  };
  if (row.status === 'paid' && row.download_token) {
    out.download_token = row.download_token;
    out.download_url = `/api/downloads/${row.download_token}`;
  }
  return json(out);
});
