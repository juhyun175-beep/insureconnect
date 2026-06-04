/**
 * v2.13.8: 포인트 상점 — POST /api/points/redeem (로그인) body: { item }
 *   포인트를 혜택으로 교환. 상품/가격/효과는 코드 고정(사용자 입력 아님 — 인젝션·변조 차단)
 */
import { json, error, corsPreflight, handle } from '../../_lib/http.js';
import { getUserFromRequest } from '../../_lib/auth.js';

const ITEMS = {
  ai10:     { cost: 30, ai_bonus: 10,      label: '삼따AI 질문권 10회' },
  ai30:     { cost: 75, ai_bonus: 30,      label: '삼따AI 질문권 30회' },   // 벌크 할인(10회 3개=90P 대비 -15P)
  feature1: { cost: 40, feature_credit: 1, label: '공고 상단노출 7일권' },   // 직접 노출 50P 대비 -10P 특가
};

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => handle(async () => {
  const user = await getUserFromRequest(env, request);
  if (!user) return json({ error: '로그인 후 이용할 수 있습니다.', code: 'login_required' }, 401);

  const body = await request.json().catch(() => ({}));
  const item = ITEMS[body?.item];
  if (!item) return error('잘못된 상품입니다.');

  const me = await env.DB.prepare(`SELECT points, ai_bonus FROM ic_members WHERE id = ?`).bind(user.id).first();
  const pts = me?.points || 0;
  if (pts < item.cost) return json({ error: '포인트가 부족합니다.', code: 'insufficient_points', need: item.cost, points: pts }, 402);

  await env.DB.prepare(`UPDATE ic_members SET points = points - ? WHERE id = ?`).bind(item.cost, user.id).run();
  if (item.ai_bonus) {
    await env.DB.prepare(`UPDATE ic_members SET ai_bonus = COALESCE(ai_bonus,0) + ? WHERE id = ?`).bind(item.ai_bonus, user.id).run();
  }
  if (item.feature_credit) {
    await env.DB.prepare(`UPDATE ic_members SET feature_credit = COALESCE(feature_credit,0) + ? WHERE id = ?`).bind(item.feature_credit, user.id).run();
  }
  try {
    await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, ?, ?)`).bind(user.id, -item.cost, 'shop_' + String(body.item)).run();
  } catch (_) {}

  const after = await env.DB.prepare(`SELECT points, ai_bonus, feature_credit FROM ic_members WHERE id = ?`).bind(user.id).first();
  return json({ ok: true, item: body.item, cost: item.cost, remaining: after?.points || 0, ai_bonus: after?.ai_bonus || 0, feature_credit: after?.feature_credit || 0 });
});
