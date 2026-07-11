import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ensureDmCol, fulfillApprovedOptions } from '../../_lib/fulfillment.js';
import { submitUrls } from '../../_lib/indexnow.js';

export const onRequestOptions = () => corsPreflight();

// 비관리자 단건 조회에 노출되는 안전 필드(등록자 연락처·쿠폰 등 내부 정보 제외)
const PUBLIC_FIELDS = ['id', 'title', 'company_name', 'description', 'file_url', 'file_type',
                       'form_url', 'created_at', 'status', 'approved_at', 'featured_until', 'dm_enabled'];

export const onRequestGet = async ({ params, request, env }) => handle(async () => {
  const row = await env.DB.prepare(
    `SELECT * FROM ic_recruitments WHERE id = ?`
  ).bind(params.id).first();
  if (!row) return error('Not found', 404);
  if (verifyAdmin(request, env)) return json(row);
  // 공개 응답: 승인된 공고만, 안전 필드만 (pending/rejected 열람 + 연락처 노출 차단)
  if (row.status !== 'approved') return error('Not found', 404);
  const pub = {};
  for (const f of PUBLIC_FIELDS) pub[f] = row[f] ?? null;
  return json(pub);
});

export const onRequestDelete = async ({ params, request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await env.DB.prepare(`DELETE FROM ic_recruitments WHERE id = ?`).bind(params.id).run();
  return json({ ok: true });
});

const PUBLIC_SITE = 'https://insureconnect.co.kr';

function approvalIndexNowUrls(id) {
  return [`${PUBLIC_SITE}/og/recruit/${encodeURIComponent(id)}`, `${PUBLIC_SITE}/recruit`];
}

async function queueIndexNow(context, urls) {
  const task = submitUrls(context.env, urls).catch(() => {});
  if (context.waitUntil) {
    context.waitUntil(task);
  } else {
    await task;
  }
  return true;
}

export const onRequestPatch = async (context) => handle(async () => {
  const { params, request, env } = context;
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureDmCol(env);
  const body = await request.json();

  // v2.11.1: 현재 상태/노출 확인 (최초 승인 시 3일 무료 노출 맛보기 판단)
  const cur = await env.DB.prepare(
    `SELECT status, featured_until FROM ic_recruitments WHERE id = ?`
  ).bind(params.id).first();
  if (!cur) return error('Not found', 404);

  const allowed = ['title','company_name','description','file_url','file_type','form_url',
                   'status','reject_reason','approved_at','dm_enabled'];
  const fields = allowed.filter(k => k in body);
  if (body.status === 'approved' && !('approved_at' in body)) {
    fields.push('approved_at');
    body.approved_at = new Date().toISOString();
  }
  const sets = fields.map(f => `${f} = ?`);
  const values = fields.map(f => body[f]);

  // 상단노출(featured_until) 제어
  //  - 관리자 수동: feature_days (양수=now+N일 / 0·음수=해제)  ← 레거시·컴프용
  //  - 자동 맛보기: 최초 승인(pending→approved) 시 노출이 없으면 3일 무료(5만원 게시 보상)
  const firstApproval = body.status === 'approved' && cur.status !== 'approved';
  const autoFree = (firstApproval && cur.featured_until == null && !('feature_days' in body));
  if ('feature_days' in body) {
    const d = parseInt(body.feature_days, 10);
    if (Number.isFinite(d) && d > 0) { sets.push(`featured_until = datetime('now', ?)`); values.push('+' + d + ' days'); }
    else { sets.push('featured_until = NULL'); }
  } else if (autoFree) {
    sets.push(`featured_until = datetime('now', '+3 days')`);
  }

  if (!sets.length) return error('No fields to update');
  await env.DB.prepare(
    `UPDATE ic_recruitments SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values, params.id).run();
  const fulfillment = body.status === 'approved'
    ? await fulfillApprovedOptions(env, { adType: 'recruit', adId: params.id })
    : null;
  const indexnowSubmitted = firstApproval
    ? await queueIndexNow(context, approvalIndexNowUrls(params.id))
    : false;
  return json({ ok: true, featured_granted: autoFree, fulfillment, indexnow: { submitted: indexnowSubmitted } });
});
