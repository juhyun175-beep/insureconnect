/**
 * v2.137.0: 제휴 파트너 광고 카드 — 목록/등록
 *   GET  /api/partners?active=1  → 공개(활성·미삭제 카드, 공개 컬럼만, 최대 12개)
 *   GET  /api/partners           → 관리자 목록(미삭제 전체) · verifyAdmin 필수
 *   POST /api/partners           → 관리자 등록 · verifyAdmin 필수
 *
 *   인슈어커넥트는 광고 게재 매체다. 파트너명·계약 내용은 코드에 하드코딩하지 않는다.
 *   삭제는 소프트 삭제(deleted_at)이며 물리 삭제하지 않는다([id].js 참고).
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { buildPartnerWrite } from '../../_lib/partners.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  // 공개 모드는 정확히 active=1 인 경우로만 제한한다.
  if (url.searchParams.get('active') === '1') {
    const rs = await env.DB.prepare(
      `SELECT id, name, tagline, category, href, img
         FROM ic_partner_cards
        WHERE is_active = 1 AND deleted_at IS NULL
        ORDER BY sort_order ASC, id ASC
        LIMIT 12`
    ).all();
    return json(rs.results || []);
  }
  // active=1 이 아닌 모든 GET(빈 값·다른 값·미지정 포함)은 관리자 인증 필요.
  if (!verifyAdmin(request, env)) return unauthorized();
  const rs = await env.DB.prepare(
    `SELECT id, name, tagline, category, href, img, sort_order, is_active, created_at, updated_at
       FROM ic_partner_cards
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, id ASC`
  ).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }
  const built = buildPartnerWrite(body, { partial: false });
  if (built.error) return json({ error: built.error }, 400);
  const cols = built.columns;
  const placeholders = cols.map(() => '?').join(', ');
  const row = await env.DB.prepare(
    `INSERT INTO ic_partner_cards (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`
  ).bind(...built.values).first();
  return json({ id: row.id });
});
