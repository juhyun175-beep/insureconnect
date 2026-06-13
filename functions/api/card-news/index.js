import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/** GET 전체 슬라이드 — sort_order 정렬 (set_id별 그룹핑은 클라가)
 *  v2.1.49: ?set_id= 필터 지원 (관리자 세트 삭제 플로우에서 사용)
 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const setId = url.searchParams.get('set_id');

  if (setId) {
    const rs = await env.DB.prepare(
      `SELECT id, set_id, title, file_url, file_type, sort_order, created_at
       FROM ic_card_news WHERE set_id = ? ORDER BY sort_order ASC`
    ).bind(setId).all();
    return json(rs.results || []);
  }

  // v2.58.0 FIX(데이터누락): 공개 피드를 '슬라이드' LIMIT 이 아니라 '세트' 단위로 반환.
  //   기존 `LIMIT 200(슬라이드)` 은 카드뉴스가 세트(여러 슬라이드)로 소비되는데 슬라이드 수를 잘라,
  //   누적 슬라이드가 한도를 넘으면 오래된 '세트'가 통째로/부분으로 공개뷰에서 사라졌다
  //   (DB·관리자(limit=300)에는 멀쩡 → "조금씩 사라진다"는 증상). 데이터는 안전, 조회만 누락이었음.
  //   → 최신 N개 '세트'를 모든 슬라이드와 함께 반환. 세트는 절대 부분잘림/누락되지 않음.
  const setLimit = Math.min(parseInt(url.searchParams.get('sets') || url.searchParams.get('limit') || '200', 10) || 200, 500);
  const rs = await env.DB.prepare(
    `SELECT cn.id, cn.set_id, cn.title, cn.file_url, cn.file_type, cn.sort_order, cn.created_at
       FROM ic_card_news cn
       JOIN (
         SELECT set_id, MAX(id) AS mx, MAX(created_at) AS mc
           FROM ic_card_news
          GROUP BY set_id
          ORDER BY mc DESC, mx DESC
          LIMIT ?
       ) s ON s.set_id = cn.set_id
      ORDER BY s.mc DESC, s.mx DESC, cn.sort_order ASC`
  ).bind(setLimit).all();
  return json(rs.results || []);
});

/** POST 새 슬라이드 (관리자) */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  // 배열로 여러 슬라이드 한 번에
  const items = Array.isArray(body) ? body : [body];
  const ids = [];
  for (const it of items) {
    const r = await env.DB.prepare(
      `INSERT INTO ic_card_news (set_id, title, file_url, file_type, sort_order)
       VALUES (?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      it.set_id || crypto.randomUUID(),
      it.title || null,
      it.file_url || null,
      it.file_type || null,
      it.sort_order || 0
    ).first();
    ids.push(r.id);
  }
  return json({ ids });
});

/** v2.1.49: DELETE — collection 레벨에서도 ?set_id= 쿼리로 일괄 삭제 가능.
 *  이전: 클라이언트가 DELETE /api/card-news?set_id= 호출했으나 핸들러 없어 405 → DB 안 지워짐.
 *  set_id 필수 — 무차별 대량 삭제 방지.
 */
export const onRequestDelete = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const setId = url.searchParams.get('set_id');
  if (!setId) return error('set_id required for collection-level delete', 400);

  // 기본 UUID 형식 검증 (재앙 방지)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(setId)) {
    return error('Invalid set_id format', 400);
  }

  const result = await env.DB.prepare(
    `DELETE FROM ic_card_news WHERE set_id = ?`
  ).bind(setId).run();
  return json({ ok: true, deleted: result.meta?.changes || 0, set_id: setId });
});
