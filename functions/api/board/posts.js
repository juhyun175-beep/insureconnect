/**
 * v2.3.0: 자유게시판 — 글 목록/작성
 *   GET  /api/board/posts?page=1   (공개)
 *   POST /api/board/posts          (로그인 필수) body:{title, content}
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { getUserFromRequest, maybePromoteByPoints } from '../../_lib/auth.js';
import { findProfanity, isSpammy, isBanned } from '../../_lib/moderation.js';

export const onRequestOptions = () => corsPreflight();

const PER_PAGE = 20;
const DAILY_POST_LIMIT = 20;
const MAX_TITLE = 100;
const MAX_CONTENT = 5000;
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export const onRequestGet = async ({ env, request }) => handle(async () => {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const offset = (page - 1) * PER_PAGE;
  const rs = await env.DB.prepare(
    `SELECT id, nickname, title, view_count, comment_count, created_at
     FROM ic_board_posts WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(PER_PAGE, offset).all();
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_board_posts WHERE deleted = 0`).first();
  return json({ posts: rs.results || [], total: cnt?.n || 0, page, per_page: PER_PAGE });
});

export const onRequestPost = async ({ env, request }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return error('로그인이 필요합니다.', 401);
  if (await isBanned(env, user.id)) return error('이용이 제한된 계정입니다. 운영자에게 문의해주세요.', 403);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const title = String(body?.title || '').trim();
  const content = String(body?.content || '').trim();
  if (!title || !content) return error('제목과 내용을 입력해주세요.');
  if (title.length > MAX_TITLE) return error(`제목은 ${MAX_TITLE}자 이내로 작성해주세요.`);
  if (content.length > MAX_CONTENT) return error(`내용은 ${MAX_CONTENT}자 이내로 작성해주세요.`);
  if (findProfanity(title + ' ' + content)) return error('부적절한 표현이 포함되어 있어 등록할 수 없습니다.', 400);
  if (isSpammy(content)) return error('스팸성 내용으로 등록할 수 없습니다.', 400);

  // 도배 방지: 1일 작성 한도
  const since = kstDate() + 'T00:00:00';
  const today = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_board_posts WHERE user_id = ? AND created_at >= ?`
  ).bind(user.id, since).first();
  if ((today?.n || 0) >= DAILY_POST_LIMIT) return error('오늘 작성 한도를 초과했습니다. 내일 다시 시도해주세요.', 429);

  const r = await env.DB.prepare(
    `INSERT INTO ic_board_posts (user_id, nickname, title, content) VALUES (?, ?, ?, ?) RETURNING id`
  ).bind(user.id, user.nickname || '회원', title, content).first();

  // v2.12.5: 글 작성 포인트 (+5P, 하루 최초 3건까지 — 도배 적립 방지)
  let pointsAwarded = 0;
  if ((today?.n || 0) < 3) {
    try {
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + 5 WHERE id = ?`).bind(user.id).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, 5, 'board_post')`).bind(user.id).run();
      await maybePromoteByPoints(env, user.id);
      pointsAwarded = 5;
    } catch (_) {}
  }
  return json({ ok: true, id: r?.id, points_awarded: pointsAwarded });
});
