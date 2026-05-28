/**
 * v2.0.0 Sprint 2: OTP 발송 요청
 *
 *   POST /api/auth/request-otp
 *   body: { email: "user@example.com" }
 *
 * 응답: { ok: true, dev?: { code } } (env.AUTH_DEV_MODE='1' 이고 Resend 미설정 시 dev.code 노출)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { sendEmail, buildOtpEmail } from '../../_lib/email.js';

export const onRequestOptions = () => corsPreflight();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (isBot(request)) return error('forbidden', 403);
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return error('Invalid email');

  // rate limit: 같은 이메일에 1분 내 재요청 차단
  const recent = await env.DB.prepare(
    `SELECT created_at FROM ic_email_otps WHERE email = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(email).first();
  if (recent) {
    const ageSec = (Date.now() - new Date(recent.created_at + 'Z').getTime()) / 1000;
    if (ageSec < 60) return error('Too many requests — 잠시 후 다시 시도해주세요', 429);
  }

  // 6자리 OTP 생성 + 해시 저장 (10분 만료)
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // 이전 OTP 무효화 (같은 이메일)
  await env.DB.prepare(`DELETE FROM ic_email_otps WHERE email = ?`).bind(email).run();
  await env.DB.prepare(
    `INSERT INTO ic_email_otps (email, code_hash, expires_at) VALUES (?, ?, ?)`
  ).bind(email, codeHash, expiresAt).run();

  // 이메일 발송
  const mail = buildOtpEmail(code);
  const result = await sendEmail({ to: email, subject: mail.subject, html: mail.html, env });

  const resp = { ok: true, sent: result.sent };
  // Dev 모드 + Resend 미설정 시에만 OTP 응답에 포함 (초기 구축 단계)
  if (!result.sent && env.AUTH_DEV_MODE === '1') {
    resp.dev = { code, reason: result.reason };
  }
  return json(resp);
});
