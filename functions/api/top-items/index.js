/**
 * 인기 콘텐츠 Top — 옛 get_ic_top_items RPC 대체
 *
 * 데이터 소스:
 *   trackClick(name, type) → ic_link_clicks_daily 에 누적
 *     type 'life'/'nonlife'/'payment'/'ga' = 전산
 *     type 'knowledge'                     = 보험지식 (내부 클릭)
 *     type 'cardnews'                      = 카드뉴스 (내부 클릭)
 *     type 'knowledge_shared'              = 보험지식 외부 공유유입
 *     type 'cardnews_shared'               = 카드뉴스 외부 공유유입
 *     type 'knowledge_copy'                = 보험지식 링크 복사
 *     type 'cardnews_copy'                 = 카드뉴스 링크 복사
 *
 * v2.1.11: 공유유입/복사 카운터 실제 쿼리 구현
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
       GROUP BY company_name ORDER BY clicks DESC LIMIT 5`
    ).bind(...binds).all();
    return (rs.results || []).map(r => ({
      name: r.name,
      clicks: r.clicks,
      shared: r.clicks,  // shared/copy 쿼리 결과도 같은 모양으로 통일
      copies: r.clicks,
    }));
  };

  const jeonsanTypes = ['life','nonlife','payment','ga'];
  const latestTypes  = ['knowledge','cardnews'];

  const [
    jt, jT, lt, lT,
    knClicksT, knClicksTot,
    cnClicksT, cnClicksTot,
    knShT, knShTot, cnShT, cnShTot,
    knCpT, knCpTot, cnCpT, cnCpTot,
  ] = await Promise.all([
    topByType(jeonsanTypes, true),
    topByType(jeonsanTypes, false),
    topByType(latestTypes, true),
    topByType(latestTypes, false),
    topByType(['knowledge'], true),
    topByType(['knowledge'], false),
    topByType(['cardnews'], true),
    topByType(['cardnews'], false),
    topByType(['knowledge_shared'], true),
    topByType(['knowledge_shared'], false),
    topByType(['cardnews_shared'], true),
    topByType(['cardnews_shared'], false),
    topByType(['knowledge_copy'], true),
    topByType(['knowledge_copy'], false),
    topByType(['cardnews_copy'], true),
    topByType(['cardnews_copy'], false),
  ]);

  return json({
    jeonsan_today:    jt,
    jeonsan_total:    jT,
    latest_today:     lt,
    latest_total:     lT,
    knowledge_today:  knClicksT,
    knowledge_total:  knClicksTot,
    cardnews_today:   cnClicksT,
    cardnews_total:   cnClicksTot,
    knowledge_top_shared_today: knShT,
    knowledge_top_shared_total: knShTot,
    knowledge_top_copy_today:   knCpT,
    knowledge_top_copy_total:   knCpTot,
    cardnews_top_shared_today:  cnShT,
    cardnews_top_shared_total:  cnShTot,
    cardnews_top_copy_today:    cnCpT,
    cardnews_top_copy_total:    cnCpTot,
  });
});
