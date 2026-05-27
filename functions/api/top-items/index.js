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

  /** v2.1.38: 채용/강의 인기순위 — share/copy 이벤트(`*_copy`, `*_shared`) 를 engagement signal 로 사용
   *  company_name 패턴 `recruit_<id>` / `lecture_<id>` 로 저장되어 있어 ID 추출 후 title 조인 */
  const topRecruitOrLecture = async (mode, whereDate) => {
    const table = mode === 'recruit' ? 'ic_recruitments' : 'ic_lectures';
    const prefix = mode === 'recruit' ? 'recruit_' : 'lecture_';
    const types = [`${prefix.slice(0,-1)}_copy`, `${prefix.slice(0,-1)}_shared`];
    const placeholders = types.map(() => '?').join(',');
    const dateClause = whereDate ? `AND d.date = ?` : '';
    const binds = whereDate ? [...types, today] : [...types];
    try {
      const rs = await env.DB.prepare(
        `SELECT t.id AS id, t.title AS name, SUM(d.clicks) AS clicks
         FROM ic_link_clicks_daily d
         JOIN ${table} t
           ON d.company_name = ('${prefix}' || t.id)
         WHERE d.company_type IN (${placeholders})
           AND t.status = 'approved'
           ${dateClause}
         GROUP BY t.id, t.title
         ORDER BY clicks DESC
         LIMIT 5`
      ).bind(...binds).all();
      return (rs.results || []).map(r => ({
        id: r.id, name: r.name, clicks: r.clicks
      }));
    } catch (_) { return []; }
  };

  const [
    jt, jT, lt, lT,
    knClicksT, knClicksTot,
    cnClicksT, cnClicksTot,
    knShT, knShTot, cnShT, cnShTot,
    knCpT, knCpTot, cnCpT, cnCpTot,
    rcT, rcTot, lcT, lcTot,
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
    topRecruitOrLecture('recruit', true),
    topRecruitOrLecture('recruit', false),
    topRecruitOrLecture('lecture', true),
    topRecruitOrLecture('lecture', false),
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
    // v2.1.38: 채용/강의 인기순위
    recruit_today: rcT,
    recruit_total: rcTot,
    lecture_today: lcT,
    lecture_total: lcTot,
  });
});
