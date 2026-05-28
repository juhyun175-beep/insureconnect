/**
 * v2.0.0 Sprint 2: 이메일 발송 헬퍼
 *
 * 1차: Resend API (https://resend.com — 무료 100 emails/day)
 *      `wrangler pages secret put RESEND_API_KEY --project-name=insureconnect-hub`
 *      `wrangler pages secret put MAIL_FROM      --project-name=insureconnect-hub`
 *           (예: "InsureConnect <noreply@your-domain.com>")
 *
 * 2차 폴백: API 키 미설정 시 console.log 로 OTP 출력 (dev/초기 구축 단계)
 *           verify-otp 응답 헤더 X-Dev-Otp 에도 노출 (env.AUTH_DEV_MODE='1' 일 때만)
 */

export async function sendEmail({ to, subject, html, env }) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM || 'InsureConnect <onboarding@resend.dev>';

  if (!apiKey) {
    // 폴백: 콘솔 + 응답 metadata
    console.log(`[EMAIL FALLBACK — Resend 키 미설정]
  to:      ${to}
  subject: ${subject}
  html:    ${html.slice(0, 200)}...`);
    return { sent: false, reason: 'no-api-key', dev: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend send failed:', res.status, errText);
      return { sent: false, reason: `resend-${res.status}`, error: errText };
    }
    const data = await res.json();
    return { sent: true, id: data.id };
  } catch (e) {
    console.error('Resend exception:', e);
    return { sent: false, reason: 'exception', error: e.message };
  }
}

/** OTP 이메일 본문 생성 */
export function buildOtpEmail(code) {
  const safe = String(code).replace(/[^0-9]/g, '');
  return {
    subject: `[InsureConnect] 로그인 인증번호 ${safe}`,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
      <tr><td style="background:linear-gradient(135deg,#1a3de8,#4a70f5);padding:28px 32px;color:#fff;">
        <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">InsureConnect</div>
        <div style="font-size:13px;opacity:0.9;margin-top:4px;">보험설계사 통합 허브</div>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="font-size:18px;margin:0 0 16px;color:#0f172a;">로그인 인증번호</h1>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 24px;">아래 6자리 인증번호를 로그인 화면에 입력해주세요.</p>
        <div style="background:#eff6ff;padding:20px;border-radius:10px;text-align:center;border:1px dashed #c7d2fe;">
          <div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#1a3de8;font-variant-numeric:tabular-nums;">${safe}</div>
        </div>
        <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:20px 0 0;">⏱ 10분 이내에 입력해주세요. 본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:18px 32px;text-align:center;font-size:11px;color:#9ca3af;">
        © InsureConnect · insureconnect-hub.pages.dev
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
  };
}
