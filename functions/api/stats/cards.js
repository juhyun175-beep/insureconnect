/**
 * 카드별 클릭 7일 추이 — loadCardStats() 응답
 * 응답: [{menu, card, total, data: [{date, clicks}, ...]}, ...]
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx);

export const onRequestGet = async ({ env }) => handle(async () => {
  // 7일 날짜 배열
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 9*3600*1000 - i*86400*1000);
    last7.push(d.toISOString().slice(0, 10));
  }
  const fromDate = last7[0];

  const rs = await env.DB.prepare(
    `SELECT date, menu, card, clicks FROM ic_card_clicks_daily WHERE date >= ? ORDER BY menu, card, date`
  ).bind(fromDate).all();

  // 메뉴+카드별로 그룹핑
  const groups = new Map();
  (rs.results || []).forEach(r => {
    const key = `${r.menu}|${r.card}`;
    if (!groups.has(key)) groups.set(key, { menu: r.menu, card: r.card, total: 0, dataMap: new Map() });
    const g = groups.get(key);
    g.total += r.clicks || 0;
    g.dataMap.set(r.date, r.clicks || 0);
  });

  const result = [];
  for (const g of groups.values()) {
    result.push({
      menu: g.menu,
      card: g.card,
      total: g.total,
      data: last7.map(d => ({ date: d, clicks: g.dataMap.get(d) || 0 })),
    });
  }
  return json(result);
});
