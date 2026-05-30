/**
 * v2.3.0: 자유게시판 — 글 상세 / 삭제
 *   GET    /api/board/posts/{id}   (공개) — 글 + 댓글, 조회수 +1
 *   DELETE /api/board/posts/{id}   (작성자 또는 관리자)
 */
import { json, error, handle, corsPreflight } from '../../../_lib/http.js';
import { getUserFromRequest } from '../../../_lib/auth.js';
import { verifyAdmin } from '../../../_lib/admin.js';
import { isBot } from '../../../_lib/bot.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request, params }) => handle(async () => {
  const id = parseInt(params.id, 10);
  if (!id) return error('Not found', 404);
  const post = await env.DB.prepare(
    `SELECT id, user_id, nickname, title, content, view_count, comment_count, created_at
     FROM ic_board_posts WHERE id = ? AND deleted = 0`
  ).bind(id).first();
  if (!post) return error('삭제되었거나 없는 글입니다.', 404);

  if (!isBot(request)) {
    env.DB.prepare(`UPDATE ic_board_posts SET view_count = view_count + 1 WHERE id = ?`).bind(id).run().catch(() => {});
  }
  const comments = await env.DB.prepare(
    `SELECT id, user_id, nickname, content, created_at FROM ic_board_comments
     WHERE post_id = ? AND deleted = 0 ORDER BY created_at ASC`
  ).bind(id).all();
  return json({ post, comments: comments.results || [] });
});

export const onRequestDelete = async ({ env, request, params }) => handle(async () => {
  const id = parseInt(params.id, 10);
  if (!id) return error('Not found', 404);
  const post = await env.DB.prepare(`SELECT user_id FROM ic_board_posts WHERE id = ? AND deleted = 0`).bind(id).first();
  if (!post) return error('Not found', 404);

  const user = await getUserFromRequest(env, request);
  const isOwner = user && user.id === post.user_id;
  const isAdmin = verifyAdmin(request, env);
  if (!isOwner && !isAdmin) return error('삭제 권한이 없습니다.', 403);

  await env.DB.prepare(`UPDATE ic_board_posts SET deleted = 1 WHERE id = ?`).bind(id).run();
  return json({ ok: true });
});
