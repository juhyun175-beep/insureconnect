import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  const postId = url.searchParams.get('post_id');
  if (!postId) return json([]);
  const rs = await env.DB.prepare(
    `SELECT * FROM ic_knowledge_comments WHERE post_id = ? ORDER BY created_at DESC LIMIT 200`
  ).bind(postId).all();
  return json(rs.results || []);
});

/** 댓글은 익명 작성 허용 (관리자 인증 불필요) */
export const onRequestPost = async ({ request, env }) => handle(async () => {
  const body = await request.json();
  if (!body.post_id || !body.content) return json({ error: 'post_id and content required' }, 400);
  const r = await env.DB.prepare(
    `INSERT INTO ic_knowledge_comments (post_id, nickname, content) VALUES (?, ?, ?) RETURNING id`
  ).bind(body.post_id, body.nickname || null, body.content).first();
  return json({ id: r.id });
});
