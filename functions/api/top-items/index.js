/**
 * 인기 콘텐츠 Top — Supabase의 get_ic_top_items RPC 대체
 * 데이터 충분히 누적되기 전까지 빈 배열 반환 (UI는 "기록 없음" 메시지 표시)
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx); // POST도 동일 처리

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ env }) => handle(async () => {
  const today = kstDateKey();

  /* 오늘 / 누적 카드 클릭 → 메뉴별 그룹핑 (전산·보험지식·카드뉴스) */
  const buildList = async (whereClause, params) => {
    const rs = await env.DB.prepare(
      `SELECT card AS name, SUM(clicks) AS clicks
       FROM ic_card_clicks_daily ${whereClause}
       GROUP BY card ORDER BY clicks DESC LIMIT 3`
    ).bind(...params).all();
    return (rs.results || []).map(r => ({ name: r.name, clicks: r.clicks }));
  };

  // 전산 (menu like '%전산%' 또는 menu='전산')
  const jeonsanToday   = await buildList(`WHERE menu LIKE '%전산%' AND date = ?`, [today]);
  const jeonsanTotal   = await buildList(`WHERE menu LIKE '%전산%'`, []);
  // 보험지식
  const knowledgeToday = await buildList(`WHERE menu = '보험지식' AND date = ?`, [today]);
  const knowledgeTotal = await buildList(`WHERE menu = '보험지식'`, []);
  // 카드뉴스
  const cardnewsToday  = await buildList(`WHERE menu = '카드뉴스' AND date = ?`, [today]);
  const cardnewsTotal  = await buildList(`WHERE menu = '카드뉴스'`, []);

  return json({
    jeonsan_today:    jeonsanToday,
    jeonsan_total:    jeonsanTotal,
    knowledge_today:  knowledgeToday,
    knowledge_total:  knowledgeTotal,
    cardnews_today:   cardnewsToday,
    cardnews_total:   cardnewsTotal,
  });
});
