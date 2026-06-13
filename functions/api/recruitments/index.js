import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { getUserFromRequest } from '../../_lib/auth.js';
import { AD_BASE, finalPrice, ensurePostingCouponCols, validateCoupon } from '../../_lib/coupons.js';

export const onRequestOptions = () => corsPreflight();

/** 채용공고 목록
 *   기본: status='approved'만 반환 (일반 사용자)
 *   ?status=pending : 관리자 전용 (x-admin-secret 필요)
 *   ?status=all     : 관리자 전용
 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
  const order = url.searchParams.get('order') === 'created_at.asc' ? 'ASC' : 'DESC';
  const statusParam = url.searchParams.get('status') || 'approved';

  // pending/all/rejected는 관리자만
  if (statusParam !== 'approved') {
    if (!verifyAdmin(request, env)) return unauthorized();
  }

  const where = statusParam === 'all' ? '1=1' : 'status = ?';
  const params = statusParam === 'all' ? [] : [statusParam];
  // v2.11.0: 상단노출(featured_until > now) 공고를 최상단으로 정렬 + featured 플래그 반환
  const rs = await env.DB.prepare(
    `SELECT id, title, company_name, description, file_url, file_type, form_url, created_at,
            status, submitter_name, submitter_contact, reject_reason, approved_at, featured_until,
            CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now') THEN 1 ELSE 0 END AS featured
     FROM ic_recruitments WHERE ${where}
     ORDER BY (CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now') THEN 1 ELSE 0 END) DESC,
              (CASE WHEN featured_until IS NOT NULL AND featured_until > datetime('now') THEN featured_until END) DESC,
              created_at ${order} LIMIT ?`
  ).bind(...params, limit).all();
  return json(rs.results || []);
});

/** form_url 형식 검증 — http/https URL, 신뢰 도메인 화이트리스트
 *  v2.1.36: 「구글폼·네이버폼만」 정책으로 엄격화.
 *  카카오톡 오픈채팅(open.kakao.com) 은 폼이 아니라 채팅이므로 차단.
 *  Tally/Typeform/Office Forms/SurveyMonkey/GitHub 등도 제외 (요청 시 확장 가능). */
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
export { sanitizeFormUrl };

/** 신규 등록
 *   관리자: 즉시 approved
 *   일반 사용자(x-admin-secret 없음): pending — submitter_name/contact 필수
 */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  const body = await request.json();
  const isAdmin = verifyAdmin(request, env);
  // v2.11.0: 로그인 사용자면 등록 회원으로 연결(submitter_id) → 본인 공고 상단노출(포인트) 가능
  // v2.15.6: 비로그인도 공고 등록 허용 — 이름·연락처 필수 + 관리자 승인 게이트가 스팸 차단. 로그인 시 submitter_id 연결(상단노출 루프 유지)
  const user = isAdmin ? null : await getUserFromRequest(env, request);

  if (!body.title || !body.title.trim()) return error('title is required');

  let status, submitterName = null, submitterContact = null, approvedAt = null;
  if (isAdmin) {
    status = body.status || 'approved';
    approvedAt = new Date().toISOString();
  } else {
    // 사용자 신청
    if (!body.submitter_name || !body.submitter_name.trim()) return error('submitter_name is required');
    if (!body.submitter_contact || !body.submitter_contact.trim()) return error('submitter_contact is required');
    status = 'pending';
    submitterName = body.submitter_name.trim().slice(0, 60);
    submitterContact = body.submitter_contact.trim().slice(0, 100);
  }

  const formUrl = sanitizeFormUrl(body.form_url);

  const r = await env.DB.prepare(
    `INSERT INTO ic_recruitments
       (title, company_name, description, file_url, file_type, form_url, status,
        submitter_name, submitter_contact, approved_at, submitter_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    body.title.trim().slice(0, 200),
    body.company_name ? String(body.company_name).slice(0, 80) : null,
    body.description ? String(body.description).slice(0, 5000) : null,
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

  // v2.53.0: 등록가·할인권 — 비관리자(유저) 등록에만. 쿠폰 없으면 등록가(base) 그대로. 기존 흐름 무변경.
  let priceInfo = null;
  if (!isAdmin) {
    try {
      await ensurePostingCouponCols(env);
      let rate = 0, usedId = null, usedType = null;
      const cp = (user && body.coupon_id) ? await validateCoupon(env, user.id, body.coupon_id, 'recruit') : { ok: false };
      if (cp.ok) { rate = cp.rate; usedId = cp.id; usedType = cp.coupon_type; }
      const price = finalPrice('recruit', rate);
      await env.DB.prepare(`UPDATE ic_recruitments SET price=?, coupon_id=?, coupon_rate=? WHERE id=?`).bind(price, usedId, rate, newId).run().catch(() => {});
      if (usedId && user) {
        await env.DB.prepare(`UPDATE user_coupons SET status='used', used_at=datetime('now'), used_ad_type='recruit', used_ad_id=? WHERE id=? AND member_id=? AND status='active'`).bind(newId, usedId, user.id).run().catch(() => {});
        try { await env.DB.prepare(`INSERT INTO coupon_logs (member_id, coupon_id, coupon_type, ad_type, discount_rate, action, used_at) VALUES (?,?,?,?,?, 'use', datetime('now'))`).bind(user.id, usedId, usedType, 'recruit', rate).run(); } catch (_) {}
      }
      priceInfo = { base: AD_BASE.recruit, rate, price };
    } catch (_) {}
  }
  return json({ id: newId, status, price: priceInfo });
});
