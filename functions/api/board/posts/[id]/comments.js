/**
 * v2.3.0: 자유게시판 — 댓글 작성
 *   POST /api/board/posts/{id}/comments  (로그인 필수) body:{content}
 */
import { json, error, handle, corsPreflight } from '../../../../_lib/http.js';
import { getUserFromRequest, SITE, maybePromoteByPoints } from '../../../../_lib/auth.js';
import { sendMemoToMember } from '../../../../_lib/kakao-msg.js';
import { findProfanity, isSpammy, isBanned } from '../../../../_lib/moderation.js';

export const onRequestOptions = () => corsPreflight();

const MAX_COMMENT = 1000;
const DAILY_COMMENT_LIMIT = 100;
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export const onRequestPost = async ({ env, request, params, waitUntil }) => handle(async () => {
  const postId = parseInt(params.id, 10);
  if (!postId) return error('Not found', 404);

  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  if (await isBanned(env, user.id)) return error('이용이 제한된 계정입니다. 운영자에게 문의해주세요.', 403);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const content = String(body?.content || '').trim();
  if (!content) return error('댓글 내용을 입력해주세요.');
  if (content.length > MAX_COMMENT) return error(`댓글은 ${MAX_COMMENT}자 이내로 작성해주세요.`);
  if (findProfanity(content)) return error('부적절한 표현이 포함되어 있어 등록할 수 없습니다.', 400);
  if (isSpammy(content)) return error('스팸성 내용으로 등록할 수 없습니다.', 400);

  const post = await env.DB.prepare(`SELECT id, user_id FROM ic_board_posts WHERE id = ? AND deleted = 0`).bind(postId).first();
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

  // v2.12.5: 댓글 포인트 (+2P, 타인 글에 하루 최초 5건까지 — 자기글·도배 적립 방지)
  let pointsAwarded = 0;
  if (post.user_id !== user.id && (today?.n || 0) < 5) {
    try {
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + 2 WHERE id = ?`).bind(user.id).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, 2, 'board_comment')`).bind(user.id).run();
      await maybePromoteByPoints(env, user.id);
      pointsAwarded = 2;
    } catch (_) {}
  }

  // v2.7.1: 내 글에 댓글 달리면 작성자에게 카톡 알림 (본인 댓글 제외 · 동의·토큰 보유 시 · 응답 비차단)
  const notifyAuthor = async () => {
    try {
      if (!post.user_id || post.user_id === user.id) return;
      const author = await env.DB.prepare(
        `SELECT id, kakao_access_token, kakao_refresh_token, kakao_token_expires, alert_optin
         FROM ic_members WHERE id = ?`
      ).bind(post.user_id).first();
      if (author && author.alert_optin === 1 && author.kakao_refresh_token) {
        await sendMemoToMember(env, author, {
          title: '💬 내 글에 새 댓글이 달렸어요',
          description: `${(user.nickname || '회원')}: ${content.slice(0, 80)}`,
          url: `${SITE}/board/${postId}`,
        });
      }
    } catch (_) {}
  };
  if (typeof waitUntil === 'function') waitUntil(notifyAuthor()); else await notifyAuthor();

  return json({ ok: true, id: r?.id, points_awarded: pointsAwarded });
});
