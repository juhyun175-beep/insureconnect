/**
 * 인기 콘텐츠 Top — 옛 get_ic_top_items RPC 대체
 *
 * 데이터 소스:
 *   trackClick(name, type) → ic_link_clicks_daily 에 누적
 *     type 'life'/'nonlife'/'payment'/'ga' = 전산
 *     type 'knowledge'                     = 보험지식 (내부 클릭)
 *     type 'cardnews'                      = 카드뉴스 (내부 클릭)
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx);

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0, 10);
}

export const onRequestGet = async ({ env }) => handle(async () => {
  const today = kstDateKey();

  const topByType = async (types, whereDate = false) => {
    const placeholders = types.map(() => '?').join(',');
    const dateClause = whereDate ? `AND date = ?` : '';
    const binds = whereDate ? [...types, today] : [...types];
    const rs = await env.DB.prepare(
      `SELECT company_name AS name, SUM(clicks) AS clicks
       FROM ic_link_clicks_daily
       WHERE company_type IN (${placeholders}) ${dateClause}
       GROUP BY company_name ORDER BY clicks DESC LIMIT 3`
    ).bind(...binds).all();
    return (rs.results || []).map(r => ({ name: r.name, clicks: r.clicks }));
  };

  const jeonsanTypes  = ['life','nonlife','payment','ga'];
  const latestTypes   = ['knowledge','cardnews']; // 보험지식 + 카드뉴스 통합

  const [jt, jT, lt, lT, kt, kT, ct, cT] = await Promise.all([
    topByType(jeonsanTypes, true),
    topByType(jeonsanTypes, false),
    topByType(latestTypes, true),
    topByType(latestTypes, false),
    // 기존 호환성: 보험지식·카드뉴스 분리도 유지
    topByType(['knowledge'], true),
    topByType(['knowledge'], false),
    topByType(['cardnews'], true),
    topByType(['cardnews'], false),
  ]);

  return json({
    jeonsan_today:    jt,
    jeonsan_total:    jT,
    latest_today:     lt,   // 통합: 보험지식 + 카드뉴스
    latest_total:     lT,
    knowledge_today:  kt,
    knowledge_total:  kT,
    cardnews_today:   ct,
    cardnews_total:   cT,
  });
});
