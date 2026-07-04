import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { getUserFromRequest } from '../../_lib/auth.js';
import { AD_BASE, finalPrice, ensurePostingCouponCols, validateCoupon } from '../../_lib/coupons.js';
import { createAdOrder } from '../../_lib/orders.js';
import { ensureMeetingsTable, ensureParticipantsTable } from '../../_lib/meetings.js';

export const onRequestOptions = () => corsPreflight();

/** 외부 신청 폼 URL 신뢰 도메인(구글폼·네이버폼) — recruitments/lectures 와 동일 정책 */
const TRUSTED_FORM_HOSTS = /^(docs\.google\.com|forms\.gle|form\.naver\.com|naver\.me)$/i;
function sanitizeFormUrl(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > 500) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!TRUSTED_FORM_HOSTS.test(u.hostname)) return null;
    return u.toString().slice(0, 500);
  } catch (_) { return null; }
}

/** 모임공고 목록 — 기본 status='approved'. ?status=pending/all 은 관리자 전용. */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  await ensureMeetingsTable(env);
  await ensureParticipantsTable(env); // v2.68.0: participant_count 서브쿼리용
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
  const statusParam = url.searchParams.get('status') || 'approved';

  const isAdmin = verifyAdmin(request, env);
  if (statusParam !== 'approved' && !isAdmin) return unauthorized();

  const where = statusParam === 'all' ? '1=1' : 'status = ?';
  const params = statusParam === 'all' ? [] : [statusParam];
  const featuredExpr = `CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now') THEN 1 ELSE 0 END AS featured`;
  const partCount = `(SELECT COUNT(*) FROM ic_meeting_participants p WHERE p.meeting_id = ic_meetings.id) AS participant_count`;
  // v2.85.0: 공고별 조회수(meetup_view) — 홈 카드 표시용
  const viewsExpr = `COALESCE((SELECT SUM(clicks) FROM ic_link_clicks_daily WHERE company_name = 'meetup_' || ic_meetings.id AND company_type = 'meetup_view'), 0) AS views`;
  const orderTail = `ORDER BY (CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now') THEN 1 ELSE 0 END) DESC,
                              (CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now') THEN featured_until END) DESC,
                              created_at DESC LIMIT ?`;
  // v2.70.0: 공개 목록은 제목·주최·참여수만(상세는 참여 게이트). 관리자만 전체 필드.
  const sql = isAdmin
    ? `SELECT id, title, host, description, location, event_at, file_url, file_type, form_url, created_at,
              status, submitter_name, submitter_contact, reject_reason, approved_at, featured_until,
              ${featuredExpr}, ${partCount}, ${viewsExpr}
       FROM ic_meetings WHERE ${where} ${orderTail}`
    : `SELECT id, title, host, created_at, status, featured_until, ${featuredExpr}, ${partCount}, ${viewsExpr}
       FROM ic_meetings WHERE ${where} ${orderTail}`;
  const rs = await env.DB.prepare(sql).bind(...params, limit).all();
  return json(rs.results || []);
});

/** 신규 등록 (관리자=approved / 사용자=pending). 비로그인도 이름·연락처 필수로 등록 허용. */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  await ensureMeetingsTable(env);
  const body = await request.json();
  const isAdmin = verifyAdmin(request, env);
  const user = isAdmin ? null : await getUserFromRequest(env, request);

  if (!body.title || !body.title.trim()) return error('title is required');

  let status, submitterName = null, submitterContact = null, approvedAt = null;
  if (isAdmin) {
    status = body.status || 'approved';
    approvedAt = new Date().toISOString();
  } else {
    if (!body.submitter_name || !body.submitter_name.trim()) return error('submitter_name is required');
    if (!body.submitter_contact || !body.submitter_contact.trim()) return error('submitter_contact is required');
    status = 'pending';
    submitterName = body.submitter_name.trim().slice(0, 60);
    submitterContact = body.submitter_contact.trim().slice(0, 100);
  }

  const formUrl = sanitizeFormUrl(body.form_url);

  const r = await env.DB.prepare(
    `INSERT INTO ic_meetings
       (title, host, description, location, event_at, file_url, file_type, form_url, status,
        submitter_name, submitter_contact, approved_at, submitter_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.title.trim().slice(0, 200),
    body.host ? String(body.host).slice(0, 80) : null,
    body.description ? String(body.description).slice(0, 5000) : null,
    body.location ? String(body.location).slice(0, 200) : null,
    body.event_at ? String(body.event_at).slice(0, 120) : null,
    body.file_url || null,
    body.file_type || null,
    formUrl,
    status,
    submitterName,
    submitterContact,
    approvedAt,
    user ? user.id : null
  ).first();
  const newId = r.id;

  // v2.57.0: 등록가·할인권 — 비관리자(유저) 등록에만. 쿠폰 없으면 등록가(base) 그대로. 모임 ad_type='meetup'.
  let priceInfo = null, orderId = null;
  if (!isAdmin) {
    try {
      await ensurePostingCouponCols(env);
      let rate = 0, usedId = null, usedType = null;
      const cp = (user && body.coupon_id) ? await validateCoupon(env, user.id, body.coupon_id, 'meetup') : { ok: false };
      if (cp.ok) { rate = cp.rate; usedId = cp.id; usedType = cp.coupon_type; }
      const price = finalPrice('meetup', rate);
      await env.DB.prepare(`UPDATE ic_meetings SET price=?, coupon_id=?, coupon_rate=? WHERE id=?`).bind(price, usedId, rate, newId).run().catch(() => {});
      if (usedId && user) {
        await env.DB.prepare(`UPDATE user_coupons SET status='used', used_at=datetime('now'), used_ad_type='meetup', used_ad_id=? WHERE id=? AND member_id=? AND status='active'`).bind(newId, usedId, user.id).run().catch(() => {});
        try { await env.DB.prepare(`INSERT INTO coupon_logs (member_id, coupon_id, coupon_type, ad_type, discount_rate, action, used_at) VALUES (?,?,?,?,?, 'use', datetime('now'))`).bind(user.id, usedId, usedType, 'meetup', rate).run(); } catch (_) {}
      }
      priceInfo = { base: AD_BASE.meetup, rate, price };
      // v2.67.0: 주문/동의 기록(환불 정책)
      const cs = body.consent || {};
      orderId = await createAdOrder(env, { ad_type: 'meetup', ad_id: newId, member_id: user ? user.id : null, submitter_name: submitterName, submitter_contact: submitterContact, base_price: AD_BASE.meetup, coupon_id: usedId, coupon_rate: rate, final_price: price, consent_refund: cs.refund, consent_points: cs.points, consent_fail: cs.fail });
    } catch (_) {}
  }
  // v2.106.0: order_id — 프론트 토스 결제창(ad-checkout) 연결용
  return json({ id: newId, status, price: priceInfo, order_id: orderId });
});
