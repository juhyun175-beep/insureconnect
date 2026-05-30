/**
 * v2.5.0: 카카오톡 공고 알림 발송 — POST /api/admin/kakao-broadcast (admin)
 *   body: { title, body, url? }  → alert_optin=1 회원 전체에게 카톡 메모 발송
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { sendMemoToMember } from '../../_lib/kakao-msg.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  if (!env.KAKAO_REST_KEY) return error('카카오 설정이 필요합니다.', 503);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const title = String(body?.title || '').trim();
  const desc = String(body?.body || '').trim();
  const url = body?.url ? String(body.url).trim() : '';
  if (!title || !desc) return error('제목과 내용을 입력해주세요.');

  const rs = await env.DB.prepare(
    `SELECT id, kakao_access_token, kakao_refresh_token, kakao_token_expires
     FROM ic_members WHERE alert_optin = 1 AND kakao_refresh_token IS NOT NULL`
  ).all();
  const members = rs.results || [];

  let sent = 0, failed = 0, revoked = 0;
  for (const m of members) {
    const r = await sendMemoToMember(env, m, { title, description: desc, url });
    if (r.ok) { sent++; }
    else {
      failed++;
      if (r.revoked) { revoked++; await env.DB.prepare(`UPDATE ic_members SET alert_optin = 0 WHERE id = ?`).bind(m.id).run().catch(() => {}); }
    }
  }
  return json({ ok: true, total: members.length, sent, failed, revoked });
});
