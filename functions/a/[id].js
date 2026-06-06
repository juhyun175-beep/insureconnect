/**
 * v2.14.1: 공개 답변 카드 (SSR) — GET /a/{id}
 *   공유된 삼따AI 답변 1건을 OG 미리보기 + 가입 CTA가 있는 착지 페이지로 렌더(비회원 유입)
 *   noindex(검색 노출 X, 공유 링크 전용) · 본문 escape · 조회수 집계
 */
import { getOrCreateCode } from '../_lib/referral.js';

const SITE = 'https://insureconnect-hub.pages.dev';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function notFound() {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>찾을 수 없음 | 인슈어커넥트</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;background:#0b1020;color:#e6edf3;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}a{color:#8ab4ff}</style></head>
<body><div><div style="font-size:46px">🔎</div><h1 style="font-size:18px">답변을 찾을 수 없어요</h1><p style="color:#9aa7b4;font-size:14px">삭제되었거나 잘못된 링크입니다.</p><a href="/" style="display:inline-block;margin-top:10px;background:#1a3de8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:800">인슈어커넥트 홈으로 →</a></div></body></html>`;
}

function page(row, id, refCode) {
  const q = esc(row.question);
  const a = esc(row.answer).replace(/\n/g, '<br>');
  const qShort = String(row.question).slice(0, 40).replace(/\s+/g, ' ');
  const ogTitle = `삼따AI 답변 · ${qShort}${row.question.length > 40 ? '…' : ''}`;
  const ogDesc = esc(String(row.answer).replace(/\s+/g, ' ').slice(0, 110)) + '…';
  const caseBadge = row.case_count > 0
    ? `<span class="cases">📚 실제 사례 ${row.case_count}건 기반</span>` : '';
  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(ogTitle)} | 인슈어커넥트</title>
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image" content="${esc(`https://wsrv.nl/?url=${encodeURIComponent(`${SITE}/og-image/answer/${id}`)}&output=png&w=1200&h=630&fit=cover`)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${SITE}/a/${esc(id)}">
<meta name="twitter:card" content="summary_large_image">
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Segoe UI',sans-serif;margin:0;background:linear-gradient(160deg,#0b1020 0%,#101a3a 55%,#0b1020 100%);color:#e6edf3;line-height:1.65;min-height:100vh}
  .wrap{max-width:600px;margin:0 auto;padding:26px 18px 60px}
  .brand{display:flex;align-items:center;gap:8px;justify-content:center;text-decoration:none;color:#fff;font-weight:900;font-size:17px;letter-spacing:-.3px;margin-bottom:22px}
  .brand .inf{font-size:21px;background:linear-gradient(135deg,#4f8cff,#22d3ee);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:18px 19px;margin-bottom:14px;backdrop-filter:blur(6px)}
  .q-badge{display:inline-block;font-size:11px;font-weight:800;color:#ffd27a;background:rgba(245,158,11,.14);padding:3px 10px;border-radius:999px;margin-bottom:9px}
  .q{font-size:18px;font-weight:800;color:#fff;margin:0;letter-spacing:-.3px}
  .a-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .ai{font-size:13.5px;font-weight:900;background:linear-gradient(135deg,#4f8cff,#22d3ee);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .cases{font-size:11px;font-weight:800;color:#7ee0ff;background:rgba(34,211,238,.12);padding:3px 9px;border-radius:999px}
  .a-body{font-size:14.5px;color:#dfe7f1;word-break:break-word}
  .cta{margin-top:20px;text-align:center;background:linear-gradient(135deg,rgba(26,61,232,.18),rgba(34,211,238,.10));border:1px solid rgba(79,140,255,.3);border-radius:18px;padding:22px 18px}
  .cta-t{font-size:18px;font-weight:900;color:#fff;letter-spacing:-.4px}
  .cta-d{font-size:13px;color:#aebcd0;margin:8px 0 16px;line-height:1.6}
  .cta-btn{display:block;background:#FEE500;color:#191600;text-decoration:none;font-weight:900;font-size:15.5px;padding:15px;border-radius:14px;box-shadow:0 8px 22px rgba(254,229,0,.18)}
  .cta-btn:active{transform:translateY(1px)}
  .cta-2{display:inline-block;margin-top:13px;color:#8ab4ff;text-decoration:none;font-size:13px;font-weight:700}
  .feat{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-top:15px}
  .feat span{font-size:11px;color:#aebcd0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);padding:5px 10px;border-radius:999px}
  .foot{text-align:center;color:#5b6b86;font-size:11.5px;margin-top:24px}
  .disc{text-align:center;color:#5b6b86;font-size:11px;margin-top:14px;line-height:1.6}
</style></head>
<body>
  ${refCode ? `<script>try{document.cookie='ic_ref=${esc(refCode)};path=/;max-age=2592000;SameSite=Lax';}catch(e){}</script>` : ''}
  <div class="wrap">
    <a class="brand" href="/"><span class="inf">∞</span> 인슈어커넥트</a>
    <div class="card"><span class="q-badge">Q. 보험설계사 질문</span><h1 class="q">${q}</h1></div>
    <div class="card">
      <div class="a-head"><span class="ai">🤖 삼따AI</span>${caseBadge}</div>
      <div class="a-body">${a}</div>
    </div>
    <div class="cta">
      <div class="cta-t">이런 답, 당신의 질문에도.</div>
      <div class="cta-d">실제 인수·고지·보상 사례를 근거로 답하는 보험설계사 전용 AI.<br>무료로 지금 물어보세요.</div>
      <a class="cta-btn" href="/api/auth/kakao/login">💬 카카오로 3초 시작 — 가입하면 바로 질문</a>
      <div class="feat"><span>📚 실제 사례 기반</span><span>🖥 보험사 전산</span><span>💼 채용·강의</span><span>📰 보험뉴스</span></div>
      <a class="cta-2" href="/">또는 홈 둘러보기 →</a>
    </div>
    <div class="disc">※ 본 답변은 실제 사례 데이터를 바탕으로 한 참고용이며, 최종 판단은 보험사 심사·약관 기준을 따릅니다.</div>
    <div class="foot">© 인슈어커넥트 — 보험설계사 통합 허브 · 삼따AI</div>
  </div>
</body></html>`;
}

export const onRequestGet = async ({ params, env }) => {
  const id = String(params.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  let row = null;
  try {
    row = await env.DB.prepare(`SELECT question, answer, case_count, submitter_id FROM ic_shared_answers WHERE id = ?`).bind(id).first();
  } catch (_) {}
  if (!row) return new Response(notFound(), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  try { await env.DB.prepare(`UPDATE ic_shared_answers SET views = views + 1 WHERE id = ?`).bind(id).run(); } catch (_) {}
  // v2.18.0: 공유자 추천 귀속 — 이 카드로 가입하면 공유자에게 추천 보상(+50P) → 공유=추천 바이럴 루프
  let refCode = '';
  try { if (row.submitter_id) refCode = await getOrCreateCode(env, row.submitter_id); } catch (_) {}
  return new Response(page(row, id, refCode), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
