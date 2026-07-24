/**
 * 인기 콘텐츠 Top — 옛 get_ic_top_items RPC 대체
 *
 * v2 성능 개선:
 * - 콘텐츠 유형별 today/total 개별 쿼리를 단일 조건부 집계로 통합
 * - 채용/강의도 today/total을 각각 한 번의 쿼리에서 계산
 * - 기존 응답 키와 항목 모양은 유지
 */
import { handle, corsPreflight } from '../../_lib/http.js';
import { edgeCachedJson } from '../../_lib/edge-cache.js';

export const onRequestOptions = () => corsPreflight();
export const onRequestPost = (ctx) => onRequestGet(ctx);

function kstDateKey() {
  const d = new Date();
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function rankContent(rows, types, field) {
  const allowed = new Set(types);
  const totals = new Map();
  for (const row of rows) {
    if (!allowed.has(row.company_type)) continue;
    const value = Number(row[field] || 0);
    if (value <= 0) continue;
    totals.set(row.company_name, (totals.get(row.company_name) || 0) + value);
  }
  return Array.from(totals, ([name, value]) => ({
    name,
    clicks: value,
    shared: value,
    copies: value,
  })).sort((a, b) => b.clicks - a.clicks).slice(0, 5);
}

function rankPosting(rows, field) {
  return rows
    .filter((row) => Number(row[field] || 0) > 0)
    .map((row) => ({ id: row.id, name: row.name, clicks: Number(row[field] || 0) }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);
}

async function postingEngagement(env, table, prefix, types, today) {
  try {
    const placeholders = types.map(() => '?').join(',');
    const result = await env.DB.prepare(`
      SELECT
        t.id,
        t.title AS name,
        COALESCE(SUM(d.clicks), 0) AS total_clicks,
        COALESCE(SUM(CASE WHEN d.date = ? THEN d.clicks ELSE 0 END), 0) AS today_clicks
      FROM ic_link_clicks_daily d
      JOIN ${table} t ON d.company_name = (? || t.id)
      WHERE d.company_type IN (${placeholders})
        AND t.status = 'approved'
      GROUP BY t.id, t.title
    `).bind(today, prefix, ...types).all();
    return result.results || [];
  } catch (_) {
    // 기존 동작과 동일하게 선택 통계 테이블 오류가 전체 인기 콘텐츠를 막지 않게 한다.
    return [];
  }
}

async function latestApproved(env, table) {
  try {
    const result = await env.DB.prepare(`
      SELECT id, title AS name
      FROM ${table}
      WHERE status = 'approved'
      ORDER BY created_at DESC
      LIMIT 5
    `).all();
    return (result.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      clicks: 0,
      isNew: true,
    }));
  } catch (_) {
    return [];
  }
}

export const onRequestGet = async (ctx) => handle(async () => edgeCachedJson(
  ctx,
  'top-items-v2',
  60,
  async () => {
    const { env } = ctx;
    const today = kstDateKey();
    const contentTypes = [
      'life', 'nonlife', 'payment', 'ga',
      'knowledge', 'cardnews',
      'knowledge_shared', 'cardnews_shared',
      'knowledge_copy', 'cardnews_copy',
    ];
    const placeholders = contentTypes.map(() => '?').join(',');

    const [contentResult, recruitResult, lectureResult] = await Promise.all([
      env.DB.prepare(`
        SELECT
          company_type,
          company_name,
          COALESCE(SUM(clicks), 0) AS total_clicks,
          COALESCE(SUM(CASE WHEN date = ? THEN clicks ELSE 0 END), 0) AS today_clicks
        FROM ic_link_clicks_daily
        WHERE company_type IN (${placeholders})
        GROUP BY company_type, company_name
      `).bind(today, ...contentTypes).all(),
      postingEngagement(
        env,
        'ic_recruitments',
        'recruit_',
        ['recruit_view', 'recruit_copy', 'recruit_shared'],
        today,
      ),
      postingEngagement(
        env,
        'ic_lectures',
        'lecture_',
        ['lecture_view', 'lecture_copy', 'lecture_shared'],
        today,
      ),
    ]);

    const contentRows = contentResult.results || [];
    const recruitRows = recruitResult || [];
    const lectureRows = lectureResult || [];
    const jeonsanTypes = ['life', 'nonlife', 'payment', 'ga'];
    const latestTypes = ['knowledge', 'cardnews'];

    let recruitToday = rankPosting(recruitRows, 'today_clicks');
    let recruitTotal = rankPosting(recruitRows, 'total_clicks');
    let lectureToday = rankPosting(lectureRows, 'today_clicks');
    let lectureTotal = rankPosting(lectureRows, 'total_clicks');

    if (!recruitToday.length || !recruitTotal.length) {
      const fallback = await latestApproved(env, 'ic_recruitments');
      if (!recruitToday.length) recruitToday = fallback;
      if (!recruitTotal.length) recruitTotal = fallback;
    }
    if (!lectureToday.length || !lectureTotal.length) {
      const fallback = await latestApproved(env, 'ic_lectures');
      if (!lectureToday.length) lectureToday = fallback;
      if (!lectureTotal.length) lectureTotal = fallback;
    }

    return {
      jeonsan_today: rankContent(contentRows, jeonsanTypes, 'today_clicks'),
      jeonsan_total: rankContent(contentRows, jeonsanTypes, 'total_clicks'),
      latest_today: rankContent(contentRows, latestTypes, 'today_clicks'),
      latest_total: rankContent(contentRows, latestTypes, 'total_clicks'),
      knowledge_today: rankContent(contentRows, ['knowledge'], 'today_clicks'),
      knowledge_total: rankContent(contentRows, ['knowledge'], 'total_clicks'),
      cardnews_today: rankContent(contentRows, ['cardnews'], 'today_clicks'),
      cardnews_total: rankContent(contentRows, ['cardnews'], 'total_clicks'),
      knowledge_top_shared_today: rankContent(contentRows, ['knowledge_shared'], 'today_clicks'),
      knowledge_top_shared_total: rankContent(contentRows, ['knowledge_shared'], 'total_clicks'),
      knowledge_top_copy_today: rankContent(contentRows, ['knowledge_copy'], 'today_clicks'),
      knowledge_top_copy_total: rankContent(contentRows, ['knowledge_copy'], 'total_clicks'),
      cardnews_top_shared_today: rankContent(contentRows, ['cardnews_shared'], 'today_clicks'),
      cardnews_top_shared_total: rankContent(contentRows, ['cardnews_shared'], 'total_clicks'),
      cardnews_top_copy_today: rankContent(contentRows, ['cardnews_copy'], 'today_clicks'),
      cardnews_top_copy_total: rankContent(contentRows, ['cardnews_copy'], 'total_clicks'),
      recruit_today: recruitToday,
      recruit_total: recruitTotal,
      lecture_today: lectureToday,
      lecture_total: lectureTotal,
    };
  },
));
