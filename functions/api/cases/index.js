/**
 * 보험 사례 데이터센터 — GET/POST /api/cases
 *   GET  : 사례 검색/목록 (공개=approved만, 관리자=status 지정 가능)
 *   POST : 회원 사례 등록 (로그인 필요, pending 저장 + 포인트 +10)
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { verifyAdmin } from '../../_lib/admin.js';
import { getUserFromRequest, maybePromoteByPoints } from '../../_lib/auth.js';

const CATEGORIES = ['underwrite', 'disclosure', 'claim'];

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const isAdmin = verifyAdmin(request, env);
  const statusParam = (url.searchParams.get('status') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 100);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);

  const where = [];
  const binds = [];
  // 공개는 approved만. 관리자는 status로 필터(미지정 시 전체)
  if (isAdmin) {
    if (statusParam && statusParam !== 'all') { where.push('verify_status = ?'); binds.push(statusParam); }
  } else {
    where.push("verify_status = 'approved'");
  }
  if (category && CATEGORIES.includes(category)) { where.push('category = ?'); binds.push(category); }
  if (url.searchParams.get('excellent') === '1') where.push('excellent = 1');  // v2.12.5: 우수사례 큐레이션
  if (q) { where.push('(disease LIKE ? OR insurer LIKE ? OR summary LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rs = await env.DB.prepare(
    `SELECT id, category, disease, insurer, gender, age, elapsed_period, join_condition,
            result, summary, special_notes, reliability, source, verify_status, submitter_id,
            created_at, approved_at, excellent
     FROM ic_insurance_cases
     ${whereSql}
     ORDER BY reliability DESC, created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();
  const cnt = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_insurance_cases ${whereSql}`
  ).bind(...binds).first();
  return json({ cases: rs.results || [], total: cnt?.n || 0 });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const admin = verifyAdmin(request, env);
  const user = admin ? null : await getUserFromRequest(env, request);
  if (!admin && !user) return error('로그인 후 사례를 등록할 수 있습니다', 401);
  const body = await request.json();

  const category = CATEGORIES.includes(body.category) ? body.category : 'underwrite';
  const summary = (body.summary || '').trim();
  const disease = (body.disease || '').trim();
  if (!summary && !disease) return error('질병/사유 또는 사례 요약을 입력해주세요');

  const clip = (v, n) => (v == null || v === '') ? null : String(v).slice(0, n);
  const ageNum = Number.isFinite(+body.age) && +body.age > 0 ? Math.min(120, +body.age) : null;

  // 관리자 수동 등록은 source/상태/신뢰도 지정 가능(기본 즉시 승인). 회원 등록은 pending + 포인트.
  const source = admin ? (['admin', 'kakao_txt', 'member'].includes(body.source) ? body.source : 'admin') : 'member';
  const status = admin ? (['pending', 'approved', 'rejected'].includes(body.verify_status) ? body.verify_status : 'approved') : 'pending';
  const reliability = admin && Number.isFinite(+body.reliability) ? Math.max(0, Math.min(100, +body.reliability)) : 40;
  const submitterId = admin ? null : user.id;
  const approvedAt = status === 'approved' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

  const r = await env.DB.prepare(
    `INSERT INTO ic_insurance_cases
       (category, disease, insurer, gender, age, elapsed_period, join_condition,
        result, summary, original_text, special_notes, reliability, source, verify_status, submitter_id, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    category,
    clip(disease, 80),
    clip(body.insurer, 60),
    (body.gender === 'M' || body.gender === 'F') ? body.gender : null,
    ageNum,
    clip(body.elapsed_period, 60),
    clip(body.join_condition, 80),
    clip(body.result, 80),
    clip(summary, 500),
    clip(body.original_text, 4000),
    clip(body.special_notes, 500),
    reliability, source, status, submitterId, approvedAt
  ).first();

  // 회원 등록 시 포인트 +10 (실패해도 등록 성공) + 등급 자동승급
  if (!admin && user) {
    try {
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + 10 WHERE id = ?`).bind(user.id).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, 10, 'case_submit')`).bind(user.id).run();
      await maybePromoteByPoints(env, user.id);
    } catch (_) {}
  }
  return json({ id: r.id, ok: true, points_awarded: admin ? 0 : 10 });
});
