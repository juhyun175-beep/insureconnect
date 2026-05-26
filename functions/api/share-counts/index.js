/**
 * 공유 카운트 — 카드 위 사회적 증명용 ("📤 N회 공유" 배지)
 *
 *   GET /api/share-counts
 *
 * 응답:
 *   {
 *     recruit:  { "<id>": <count>, ... },
 *     lecture:  { "<id>": <count>, ... },
 *     cardnews: { "<title>": <count>, ... }
 *   }
 *
 * 데이터 소스: ic_link_clicks_daily (트래킹 type 끝이 '_copy' 인 outgoing 공유 이벤트)
 * 캐시: 5분 (자주 변하지 않으며 호출 빈도 높을 수 있어 CDN edge 캐시 활용)
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env }) => handle(async () => {
  const rs = await env.DB.prepare(
    `SELECT company_type, company_name, SUM(clicks) AS total
       FROM ic_link_clicks_daily
      WHERE company_type IN ('recruit_copy', 'lecture_copy', 'cardnews_copy', 'knowledge_copy')
      GROUP BY company_type, company_name`
  ).all();

  const result = { recruit: {}, lecture: {}, cardnews: {}, knowledge: {} };

  for (const row of (rs.results || [])) {
    const total = +row.total || 0;
    if (total < 1) continue;
    const type = String(row.company_type).replace(/_copy$/, '');
    if (!result[type]) continue;
    const name = String(row.company_name || '');

    let key = name;
    if (type === 'recruit' || type === 'lecture' || type === 'knowledge') {
      // `recruit_42`, `lecture_3` 등에서 숫자만 추출
      const m = /^(?:recruit|lecture|knowledge)_(\d+)$/.exec(name);
      if (m) key = m[1];
    }
    // cardnews 는 set 의 title 그대로 저장됐으므로 key=title 유지
    result[type][key] = (result[type][key] || 0) + total;
  }

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      // 5분 edge 캐시 — 카드 렌더링 시 매번 호출되어도 부담 적게
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    }
  });
});
