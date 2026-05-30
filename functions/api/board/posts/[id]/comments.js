/**
 * v2.3.0: 자유게시판 — 댓글 작성
 *   POST /api/board/posts/{id}/comments  (로그인 필수) body:{content}
 */
import { json, error, handle, corsPreflight } from '../../../../_lib/http.js';
import { getUserFromRequest } from '../../../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

const MAX_COMMENT = 1000;
const DAILY_COMMENT_LIMIT = 100;
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export const onRequestPost = async ({ env, request, params }) => handle(async () => {
  const postId = parseInt(params.id, 10);
  if (!postId) return error('Not found', 404);

  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const content = String(body?.content || '').trim();
  if (!content) return error('댓글 내용을 입력해주세요.');
  if (content.length > MAX_COMMENT) return error(`댓글은 ${MAX_COMMENT}자 이내로 작성해주세요.`);

  const post = await env.DB.prepare(`SELECT id FROM ic_board_posts WHERE id = ? AND deleted = 0`).bind(postId).first();
  if (!post) return error('삭제되었거나 없는 글입니다.', 404);

  const since = kstDate() + 'T00:00:00';
  const today = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_board_comments WHERE user_id = ? AND created_at >= ?`
  ).bind(user.id, since).first();
  if ((today?.n || 0) >= DAILY_COMMENT_LIMIT) return error('오늘 댓글 한도를 초과했습니다.', 429);

  const r = await env.DB.prepare(
    `INSERT INTO ic_board_comments (post_id, user_id, nickname, content) VALUES (?, ?, ?, ?) RETURNING id`
  ).bind(postId, user.id, user.nickname || '회원', content).first();
  await env.DB.prepare(`UPDATE ic_board_posts SET comment_count = comment_count + 1 WHERE id = ?`).bind(postId).run().catch(() => {});
  return json({ ok: true, id: r?.id });
});
