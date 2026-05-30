/**
 * v2.2.1: 로그아웃 — POST /api/auth/logout
 */
import { corsPreflight } from '../../_lib/http.js';
import { deleteSession, cookie } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = async ({ env, request }) => {
  await deleteSession(env, request);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie('ic_sess', '', { clear: true }) },
  });
};
