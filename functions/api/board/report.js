/**
 * v2.7.2: 자유게시판 신고 — POST /api/board/report (로그인 필수)
 *   body: { target_type:'post'|'comment', target_id, post_id?, reason? }
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';
import { ensureModerationTables } from '../../_lib/moderation.js';

export const onRequestOptions = () => corsPreflight();

const DAILY_REPORT_LIMIT = 30;
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export const onRequestPost = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const targetType = String(body?.target_type || '').trim();
  const targetId = parseInt(body?.target_id, 10);
  const postId = body?.post_id ? parseInt(body.post_id, 10) : null;
  const reason = String(body?.reason || '').slice(0, 300);
  if (!['post', 'comment'].includes(targetType) || !targetId) return error('잘못된 신고 요청입니다.');

  await ensureModerationTables(env);

  // 신고 도배 방지 (1일 한도)
  const since = kstDate() + 'T00:00:00';
  const today = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_board_reports WHERE reporter_id = ? AND created_at >= ?`
  ).bind(user.id, since).first().catch(() => ({ n: 0 }));
  if ((today?.n || 0) >= DAILY_REPORT_LIMIT) return error('오늘 신고 한도를 초과했습니다.', 429);

  // 동일 사용자·동일 대상 중복 신고 방지
  const dup = await env.DB.prepare(
    `SELECT 1 FROM ic_board_reports WHERE target_type = ? AND target_id = ? AND reporter_id = ?`
  ).bind(targetType, targetId, user.id).first();
  if (dup) return json({ ok: true, dup: true });

  await env.DB.prepare(
    `INSERT INTO ic_board_reports (target_type, target_id, post_id, reporter_id, reporter_nick, reason)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(targetType, targetId, postId, user.id, user.nickname || '회원', reason).run();

  return json({ ok: true });
});
