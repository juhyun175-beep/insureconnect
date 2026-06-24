/**
 * v2.95.0: 쿠팡 파트너스 추천 아이템 — 목록/등록
 *   GET  /api/coupang?active=1  → 활성 아이템(공개; 뷰어/모달 렌더용)
 *   GET  /api/coupang           → 전체(관리자 목록용)
 *   POST /api/coupang           → 등록(관리자) body:{label, sub, href, img, sort_order, is_active}
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const isHttp = (u) => /^https?:\/\//i.test(String(u || '').trim());

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  if (url.searchParams.get('active') === '1') {
    const rs = await env.DB.prepare(
      `SELECT id, label, sub, href, img FROM ic_coupang_items
       WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 30`
    ).all();
    return json(rs.results || []);
  }
  const rs = await env.DB.prepare(
    `SELECT * FROM ic_coupang_items ORDER BY is_active DESC, sort_order ASC, id DESC LIMIT 200`
  ).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const label = String(body.label || '').trim();
  const href  = String(body.href || '').trim();
  const img   = String(body.img || '').trim();
  if (!label || !href || !img) return json({ error: '상품명·링크·이미지는 필수입니다.' }, 400);
  if (!isHttp(href) || !isHttp(img)) return json({ error: '링크·이미지는 http(s) URL이어야 합니다.' }, 400);
  const sub = String(body.sub || '').trim();
  const r = await env.DB.prepare(
    `INSERT INTO ic_coupang_items (label, sub, href, img, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    label,
    sub || null,
    href, img,
    Number.isFinite(body.sort_order) ? body.sort_order : 0,
    body.is_active === false ? 0 : 1
  ).first();
  return json({ id: r.id });
});
