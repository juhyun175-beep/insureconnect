/**
 * 보험 상품/담보 스펙 — GET /api/coverages
 *   공개=approved만 / 관리자=status 지정. 검색: 보험사·담보·상품명
 */
import { json, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const isAdmin = verifyAdmin(request, env);
  const statusParam = (url.searchParams.get('status') || '').trim();
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);

  const where = [];
  const binds = [];
  if (isAdmin) {
    if (statusParam && statusParam !== 'all') { where.push('verify_status = ?'); binds.push(statusParam); }
  } else {
    where.push("verify_status = 'approved'");
  }
  if (q) { where.push('(insurer LIKE ? OR coverage_name LIKE ? OR product_name LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rs = await env.DB.prepare(
    `SELECT id, insurer, product_name, coverage_name, join_amount, premium, join_age,
            payment_period, maturity_period, gender, notes, source_file, verify_status, created_at
     FROM ic_product_coverages ${whereSql}
     ORDER BY insurer, coverage_name, created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_product_coverages ${whereSql}`).bind(...binds).first();
  return json({ coverages: rs.results || [], total: cnt?.n || 0 });
});
