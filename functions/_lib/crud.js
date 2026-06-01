/**
 * 공통 CRUD 헬퍼 — 단순 테이블용 GET 목록/단건, POST 등록, DELETE, PATCH
 *
 * 사용 예시:
 *   import { listHandler, postHandler, deleteHandler } from '../../_lib/crud.js';
 *   export const onRequestGet  = listHandler('ic_newsletters', ['company']);
 *   export const onRequestPost = postHandler('ic_newsletters', ['company','title','file_url','file_type']);
 */
import { json, error, handle, corsPreflight } from './http.js';
import { verifyAdmin, unauthorized } from './admin.js';

/** GET — 목록. allowedFilters: 클라이언트가 ?column=value 로 필터 가능한 컬럼 */
export function listHandler(table, allowedFilters = []) {
  return async ({ request, env }) => handle(async () => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
    // v2.8.6 보안: ORDER BY 컬럼은 식별자 문자만 허용 (SQL 인젝션 차단)
    const orderCol = (url.searchParams.get('order_by') || 'created_at').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || 'created_at';
    const orderDir = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    let where = '';
    const binds = [];
    for (const col of allowedFilters) {
      const v = url.searchParams.get(col);
      if (v != null) {
        where += where ? ' AND ' : ' WHERE ';
        where += `${col} = ?`;
        binds.push(v);
      }
    }
    const sql = `SELECT * FROM ${table}${where} ORDER BY ${orderCol} ${orderDir} LIMIT ?`;
    binds.push(limit);
    const rs = await env.DB.prepare(sql).bind(...binds).all();
    return json(rs.results || []);
  });
}

/** GET 단건 — /api/foo/:id */
export function getOneHandler(table) {
  return async ({ params, env }) => handle(async () => {
    const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`)
      .bind(params.id).first();
    if (!row) return error('Not found', 404);
    return json(row);
  });
}

/** POST 등록 — 관리자 인증 */
export function postHandler(table, allowedFields = []) {
  return async ({ request, env }) => handle(async () => {
    if (!verifyAdmin(request, env)) return unauthorized();
    const body = await request.json();
    const cols = allowedFields.filter(f => f in body);
    if (!cols.length) return error('No fields');
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map(c => body[c]);
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`;
    const r = await env.DB.prepare(sql).bind(...values).first();
    return json({ id: r.id });
  });
}

/** DELETE 단건 — 관리자 인증 */
export function deleteHandler(table) {
  return async ({ params, request, env }) => handle(async () => {
    if (!verifyAdmin(request, env)) return unauthorized();
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(params.id).run();
    return json({ ok: true });
  });
}

/** PATCH 단건 — 관리자 인증 */
export function patchHandler(table, allowedFields = []) {
  return async ({ params, request, env }) => handle(async () => {
    if (!verifyAdmin(request, env)) return unauthorized();
    const body = await request.json();
    const cols = allowedFields.filter(f => f in body);
    if (!cols.length) return error('No fields');
    const sets = cols.map(c => `${c} = ?`).join(', ');
    const values = cols.map(c => body[c]);
    await env.DB.prepare(
      `UPDATE ${table} SET ${sets} WHERE id = ?`
    ).bind(...values, params.id).run();
    return json({ ok: true });
  });
}

export { corsPreflight };
