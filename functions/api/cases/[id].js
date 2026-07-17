/**
 * 보험 사례 단건 — PATCH/DELETE /api/cases/{id} (관리자)
 *   PATCH : 검수(승인/반려)·수정·신뢰도. 승인 시 등록 회원에게 +20 포인트(최초 1회)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { maybePromoteByPoints } from '../../_lib/auth.js';
import { submitUrls } from '../../_lib/indexnow.js';
import { caseDiseaseUrl } from '../../_lib/cases-seo.js';
import { sendPushToMember } from '../../_lib/push.js';

export const onRequestOptions = () => corsPreflight();

const TEXT_FIELDS = ['disease', 'insurer', 'elapsed_period', 'join_condition', 'result', 'summary', 'special_notes', 'reject_reason', 'original_text'];
const FIELD_LIMITS = { disease: 80, insurer: 60, elapsed_period: 60, join_condition: 80, result: 80, summary: 500, special_notes: 500, reject_reason: 200, original_text: 4000 };

const PUBLIC_SITE = 'https://insureconnect.co.kr';
async function queueIndexNow(context, diseases) {
  const urls = [...new Set(['/cases', ...diseases.filter(Boolean).map(d => caseDiseaseUrl(d)).map(p => `${PUBLIC_SITE}${p}`)])];
  const task = submitUrls(context.env, urls).then(result => { if (result?.ok === false) console.error('[indexnow]', result); return result; }).catch(error => { console.error('[indexnow]', error); return { ok:false }; });
  if (context.waitUntil) context.waitUntil(task); else await task;
  return true;
}

export async function queueApprovalPush(context, memberId, disease, send = sendPushToMember) {
  if (!memberId) return false;
  const task = Promise.resolve().then(() => send(context.env, memberId, {
    title: '사례가 승인되었습니다',
    body: `[${disease}] 페이지에 게시되었어요 (+20P)`,
    url: `${PUBLIC_SITE}${caseDiseaseUrl(disease)}`,
    tag: 'case-approved',
  })).catch((error) => {
    console.error('[push]', error);
    return { sent: 0, ok: false };
  });
  if (context.waitUntil) context.waitUntil(task);
  else await task;
  return true;
}

export const onRequestPatch = async (context) => handle(async () => {
  const { params, request, env } = context;
  if (!verifyAdmin(request, env)) return unauthorized();
  const body = await request.json();

  const cur = await env.DB.prepare(
    `SELECT verify_status, submitter_id, excellent, disease FROM ic_insurance_cases WHERE id = ?`
  ).bind(params.id).first();
  if (!cur) return error('Not found', 404);

  const sets = [];
  const binds = [];
  if ('category' in body && ['underwrite', 'disclosure', 'claim'].includes(body.category)) { sets.push('category = ?'); binds.push(body.category); }
  if ('gender' in body) { sets.push('gender = ?'); binds.push((body.gender === 'M' || body.gender === 'F') ? body.gender : null); }
  if ('age' in body) { sets.push('age = ?'); binds.push(Number.isFinite(+body.age) && +body.age > 0 ? Math.min(120, +body.age) : null); }
  if ('reliability' in body) {
    let rel = parseInt(body.reliability, 10); if (!Number.isFinite(rel)) rel = 40;
    rel = Math.max(0, Math.min(100, rel)); sets.push('reliability = ?'); binds.push(rel);
  }
  for (const f of TEXT_FIELDS) {
    if (f in body) { sets.push(`${f} = ?`); binds.push(body[f] == null || body[f] === '' ? null : String(body[f]).slice(0, FIELD_LIMITS[f])); }
  }

  let approving = false;
  if ('verify_status' in body && ['pending', 'approved', 'rejected'].includes(body.verify_status)) {
    sets.push('verify_status = ?'); binds.push(body.verify_status);
    if (body.verify_status === 'approved' && cur.verify_status !== 'approved') {
      approving = true;
      sets.push("approved_at = datetime('now')");
    }
  }
  let markExcellent = false;
  if ('excellent' in body) {
    const ex = (body.excellent === 1 || body.excellent === true) ? 1 : 0;
    sets.push('excellent = ?'); binds.push(ex);
    if (ex === 1 && cur.excellent !== 1) markExcellent = true;
  }
  if (!sets.length) return error('No fields to update');

  await env.DB.prepare(
    `UPDATE ic_insurance_cases SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...binds, params.id).run();

  const changedSeo = cur.verify_status === 'approved' || body.verify_status === 'approved' || body.verify_status === 'rejected' ||
    ['disease','result','summary','reliability'].some(f => f in body);
  const indexnowSubmitted = changedSeo ? await queueIndexNow(context, [cur.disease, body.disease]) : false;

  // 승인 시 등록 회원 +20 (최초 승인 1회)
  if (approving && cur.submitter_id) {
    try {
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + 20 WHERE id = ?`).bind(cur.submitter_id).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, 20, 'case_approve')`).bind(cur.submitter_id).run();
      await maybePromoteByPoints(env, cur.submitter_id);
    } catch (_) {}
    const approvedDisease = body.disease == null || body.disease === ''
      ? cur.disease
      : String(body.disease).slice(0, FIELD_LIMITS.disease);
    await queueApprovalPush(context, cur.submitter_id, approvedDisease);
  }
  // 우수 사례 +50 (최초 1회)
  if (markExcellent && cur.submitter_id) {
    try {
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + 50 WHERE id = ?`).bind(cur.submitter_id).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, 50, 'case_excellent')`).bind(cur.submitter_id).run();
      await maybePromoteByPoints(env, cur.submitter_id);
    } catch (_) {}
  }
  return json({ ok: true, approved: approving, excellent: markExcellent });
});

export const onRequestDelete = async (context) => handle(async () => {
  const { params, request, env } = context;
  if (!verifyAdmin(request, env)) return unauthorized();
  const cur = await env.DB.prepare(`SELECT disease, verify_status FROM ic_insurance_cases WHERE id = ?`).bind(params.id).first();
  await env.DB.prepare(`DELETE FROM ic_insurance_cases WHERE id = ?`).bind(params.id).run();
  const indexnowSubmitted = cur?.verify_status === 'approved' ? await queueIndexNow(context, [cur.disease]) : false;
  return json({ ok: true });
});
