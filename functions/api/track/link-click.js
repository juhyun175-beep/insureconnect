import { json, handle, corsPreflight } from '../../_lib/http.js';
import { isBot } from '../../_lib/bot.js';
import { sendPushToMember } from '../../_lib/push.js';
export const onRequestOptions = () => corsPreflight();

function kstDateKey() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

// v2.14.8: 폼클릭(신규 지원) → 공고주에게 웹푸시 (오늘 첫 클릭만 = 1일 1회 throttle)
async function notifyOwner(env, companyName) {
  try {
    const m = String(companyName).match(/^(recruit|lecture)_(\d+)$/);
    if (!m) return;
    const table = m[1] === 'recruit' ? 'ic_recruitments' : 'ic_lectures'; // 화이트리스트
    const id = parseInt(m[2], 10);
    const post = await env.DB.prepare(`SELECT submitter_id, title FROM ${table} WHERE id = ?`).bind(id).first();
    if (!post || !post.submitter_id) return;
    const typeLabel = m[1] === 'recruit' ? '채용' : '강의';
    await sendPushToMember(env, post.submitter_id, {
      title: '📥 새 지원 알림',
      body: `「${String(post.title || '').slice(0, 40)}」 ${typeLabel}공고에 신규 지원(신청 폼)이 들어왔어요.`,
      url: '/me#mypost-section',
      tag: 'owner-apply-' + id,
      type: 'owner_apply',
    });
  } catch (_) {}
}

export const onRequestPost = async (context) => handle(async () => {
  const { request, env } = context;
  // v2.1.46: 봇 차단 — 통계 데이터 오염 방지
  if (isBot(request)) return json({ ok: true, skipped: 'bot' });
  const { company_type, company_name } = await request.json();
  if (!company_type || !company_name) return json({ error: 'company_type, company_name required' }, 400);
  const date = kstDateKey();
  const row = await env.DB.prepare(
    `INSERT INTO ic_link_clicks_daily (date, company_type, company_name, clicks)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (date, company_type, company_name) DO UPDATE SET clicks = clicks + 1
     RETURNING clicks`
  ).bind(date, company_type, company_name).first();

  // 신규 지원(폼클릭) → 공고주 푸시 (오늘 첫 클릭만, 응답 지연 없이 백그라운드)
  if (/_form$/.test(company_type) && (row?.clicks || 1) === 1) {
    if (context.waitUntil) context.waitUntil(notifyOwner(env, company_name));
    else await notifyOwner(env, company_name);
  }

  return json({ ok: true });
});
