/**
 * v2.7.2: 관리자 — 자유게시판 신고 처리 / 차단
 *   GET  /api/admin/board-reports            → 대기중 신고 목록(대상 내용 포함)
 *   POST /api/admin/board-reports            → action: ban | unban | delete | dismiss
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ensureModerationTables } from '../../_lib/moderation.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureModerationTables(env);

  const rs = await env.DB.prepare(
    `SELECT * FROM ic_board_reports WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100`
  ).all();
  const reports = rs.results || [];

  for (const r of reports) {
    try {
      if (r.target_type === 'post') {
        const p = await env.DB.prepare(`SELECT user_id, nickname, title, content, deleted FROM ic_board_posts WHERE id = ?`).bind(r.target_id).first();
        r.author_id = p?.user_id || null;
        r.author_nick = p?.nickname || '';
        r.preview = ((p?.title || '') + ' — ' + (p?.content || '')).slice(0, 120);
        r.target_deleted = p?.deleted || 0;
      } else {
        const c = await env.DB.prepare(`SELECT user_id, nickname, content, deleted FROM ic_board_comments WHERE id = ?`).bind(r.target_id).first();
        r.author_id = c?.user_id || null;
        r.author_nick = c?.nickname || '';
        r.preview = (c?.content || '').slice(0, 120);
        r.target_deleted = c?.deleted || 0;
      }
    } catch (_) {}
  }
  return json({ reports });
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureModerationTables(env);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const action = String(body?.action || '').trim();
  const reportId = body?.report_id ? parseInt(body.report_id, 10) : null;

  if (action === 'ban') {
    const memberId = parseInt(body?.member_id, 10);
    if (!memberId) return error('member_id 필요');
    await env.DB.prepare(
      `INSERT INTO ic_banned_members (member_id, reason) VALUES (?, ?)
       ON CONFLICT(member_id) DO UPDATE SET reason = excluded.reason`
    ).bind(memberId, String(body?.reason || '').slice(0, 200)).run();
    // 해당 회원의 신고 모두 처리됨으로 표시
    await env.DB.prepare(`UPDATE ic_board_reports SET status='resolved' WHERE reporter_id IS NOT NULL AND target_id IN (SELECT id FROM ic_board_posts WHERE user_id=?) AND target_type='post'`).bind(memberId).run().catch(() => {});
    if (reportId) await env.DB.prepare(`UPDATE ic_board_reports SET status='resolved' WHERE id=?`).bind(reportId).run().catch(() => {});
    return json({ ok: true });
  }

  if (action === 'unban') {
    const memberId = parseInt(body?.member_id, 10);
    if (!memberId) return error('member_id 필요');
    await env.DB.prepare(`DELETE FROM ic_banned_members WHERE member_id = ?`).bind(memberId).run();
    return json({ ok: true });
  }

  if (action === 'delete') {
    const targetType = String(body?.target_type || '').trim();
    const targetId = parseInt(body?.target_id, 10);
    if (!['post', 'comment'].includes(targetType) || !targetId) return error('잘못된 대상');
    const table = targetType === 'post' ? 'ic_board_posts' : 'ic_board_comments';
    await env.DB.prepare(`UPDATE ${table} SET deleted = 1 WHERE id = ?`).bind(targetId).run();
    await env.DB.prepare(`UPDATE ic_board_reports SET status='resolved' WHERE target_type=? AND target_id=?`).bind(targetType, targetId).run().catch(() => {});
    return json({ ok: true });
  }

  if (action === 'dismiss') {
    if (!reportId) return error('report_id 필요');
    await env.DB.prepare(`UPDATE ic_board_reports SET status='dismissed' WHERE id = ?`).bind(reportId).run();
    return json({ ok: true });
  }

  return error('알 수 없는 action');
});
