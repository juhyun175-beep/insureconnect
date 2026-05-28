/**
 * v2.0.0 Sprint 2: OTP 검증 + 로그인 (JWT 발급)
 *
 *   POST /api/auth/verify-otp
 *   body: { email, code }
 *
 *   - OTP 유효성 / 시도 횟수 체크
 *   - 신규 이메일이면 ic_users 자동 생성 (role='member')
 *   - JWT 세션 발급 + httpOnly 쿠키 설정
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { signJwt, sessionCookie } from '../../_lib/jwt.js';

export const onRequestOptions = () => corsPreflight();

const SESSION_DAYS = 14;

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (isBot(request)) return error('forbidden', 403);
  if (!env.JWT_SECRET) return error('서버 설정 누락 — JWT_SECRET 미설정', 500);

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const code  = String(body?.code  || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return error('Invalid input');

  const otpRow = await env.DB.prepare(
    `SELECT id, code_hash, expires_at, attempts FROM ic_email_otps
     WHERE email = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(email).first();
  if (!otpRow) return error('인증번호가 만료되었거나 발급된 적이 없습니다', 400);

  // 만료 / 시도 횟수
  if (new Date(otpRow.expires_at + 'Z').getTime() < Date.now()) {
    return error('인증번호가 만료되었습니다. 다시 요청해주세요', 400);
  }
  if (otpRow.attempts >= 5) {
    return error('시도 횟수 초과. 다시 인증번호를 요청해주세요', 429);
  }

  const codeHash = await sha256Hex(code);
  if (codeHash !== otpRow.code_hash) {
    await env.DB.prepare(`UPDATE ic_email_otps SET attempts = attempts + 1 WHERE id = ?`)
      .bind(otpRow.id).run();
    return error('인증번호가 일치하지 않습니다', 400);
  }

  // OTP 검증 통과 — 즉시 삭제
  await env.DB.prepare(`DELETE FROM ic_email_otps WHERE email = ?`).bind(email).run();

  // 사용자 upsert
  let user = await env.DB.prepare(
    `SELECT id, email, display_name, role FROM ic_users WHERE email = ?`
  ).bind(email).first();
  if (!user) {
    const r = await env.DB.prepare(
      `INSERT INTO ic_users (email, role, display_name) VALUES (?, 'member', ?) RETURNING id`
    ).bind(email, email.split('@')[0]).first();
    user = { id: r.id, email, display_name: email.split('@')[0], role: 'member' };
  }

  await env.DB.prepare(`UPDATE ic_users SET last_login_at = datetime('now') WHERE id = ?`)
    .bind(user.id).run();

  // JWT 발급
  const expSec = SESSION_DAYS * 86400;
  const { token, jti, exp } = await signJwt(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET, expSec
  );

  // 세션 기록
  const expiresIso = new Date(exp * 1000).toISOString();
  const ua = (request.headers.get('User-Agent') || '').slice(0, 300);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.DB.prepare(
    `INSERT INTO ic_sessions (user_id, jti, user_agent, ip, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(user.id, jti, ua, ip, expiresIso).run();

  return new Response(JSON.stringify({
    ok: true,
    user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie(token, expSec),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    }
  });
});
