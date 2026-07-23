/**
 * v2.137.0: 제휴 파트너 광고 카드
 *   GET  /api/partners?active=1  공개 카드 조회
 *   GET  /api/partners           관리자 목록 조회
 *   POST /api/partners           관리자 등록
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

const isHttp = (u) => /^https?:\/\//i.test(String(u || '').trim());

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  if (url.searchParams.get('active') === '1') {
    const rs = await env.DB.prepare(
      `SELECT id, name, tagline, category, href, img FROM ic_partner_cards
       WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 12`
    ).all();
    return json(rs.results || []);
  }
  const rs = await env.DB.prepare(
    `SELECT * FROM ic_partner_cards ORDER BY is_active DESC, sort_order ASC, id DESC LIMIT 200`
  ).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();
  const name = String(body.name || '').trim();
  const href = String(body.href || '').trim();
  const img = String(body.img || '').trim();
  if (!name || !href) return json({ error: '파트너명과 링크는 필수입니다.' }, 400);
  if (!isHttp(href) || (img && !isHttp(img))) {
    return json({ error: '링크·이미지는 http(s) URL이어야 합니다.' }, 400);
  }
  const r = await env.DB.prepare(
    `INSERT INTO ic_partner_cards (name, tagline, category, href, img, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    name,
    String(body.tagline || '').trim() || null,
    String(body.category || '').trim() || null,
    href,
    img || null,
    Number.isFinite(body.sort_order) ? body.sort_order : 0,
    body.is_active === false ? 0 : 1
  ).first();
  return json({ id: r.id });
});

