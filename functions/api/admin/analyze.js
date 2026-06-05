/**
 * v2.15.0: 통합 기록지표 — AI 다음달 방향 분석 (GET /api/admin/analyze, 관리자)
 *   최근 30일 핵심 지표(방문·클릭·전환·회원)를 종합 → LLM이 다음달 실행 방향 제안.
 *   지표는 코드 고정 쿼리(D1). 보고서 출력용 텍스트 반환.
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { callLLM, aiProvider } from '../../_lib/ai.js';

const kstDate = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000).toISOString().slice(0, 10);

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  const d30 = kstDate(30), d60 = kstDate(60);
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).first().catch(() => null);

  const [v30, vPrev, vTotal, c30, conv30, convPrev, mTotal, mNew30] = await Promise.all([
    q(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily WHERE date>=?`, d30),
    q(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily WHERE date>=? AND date<?`, d60, d30),
    q(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily`),
    q(`SELECT COALESCE(SUM(clicks),0) n FROM ic_card_clicks_daily WHERE date>=?`, d30),
    q(`SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_type LIKE '%form' AND date>=?`, d30),
    q(`SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_type LIKE '%form' AND date>=? AND date<?`, d60, d30),
    q(`SELECT COUNT(*) n FROM ic_members`),
    q(`SELECT COUNT(*) n FROM ic_members WHERE created_at>=?`, d30),
  ]);

  const stats = {
    visits_30d: v30?.n || 0, visits_prev_30d: vPrev?.n || 0, visits_total: vTotal?.n || 0,
    clicks_30d: c30?.n || 0,
    conversions_30d: conv30?.n || 0, conversions_prev_30d: convPrev?.n || 0,
    members_total: mTotal?.n || 0, members_new_30d: mNew30?.n || 0,
    generated_at: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '),
  };

  if (!aiProvider(env)) return json({ ok: true, stats, analysis: null, code: 'no_key' });

  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : (a > 0 ? 100 : 0));
  const summary = `[인슈어커넥트(보험설계사 통합 플랫폼) 최근 30일 지표]
- 방문자: 최근 30일 ${stats.visits_30d}명 (직전 30일 ${stats.visits_prev_30d}명, ${pct(stats.visits_30d, stats.visits_prev_30d)}%), 누적 ${stats.visits_total}명
- 카드 클릭: 최근 30일 ${stats.clicks_30d}회
- 전환(채용·강의 신청폼 클릭): 최근 30일 ${stats.conversions_30d}회 (직전 30일 ${stats.conversions_prev_30d}회, ${pct(stats.conversions_30d, stats.conversions_prev_30d)}%)
- 회원: 누적 ${stats.members_total}명, 최근 30일 신규 ${stats.members_new_30d}명`;

  const SYSTEM = `너는 인슈어커넥트(보험설계사 통합 플랫폼)의 운영 데이터 분석가다. 아래 최근 30일 지표를 근거로 운영자에게 보고하듯 한국어로 작성하라:
① 현황 요약 (2~3줄)
② 잘된 점 / 문제점 (각 1~2개, 숫자 근거)
③ 다음달 실행 방향 3~5개 (구체적·실행가능하게). 성장 5축(유입·전환·콘텐츠·재방문·수익) 관점으로.
간결하고 명확하게. 데이터가 적으면 '데이터 부족'이라 말하지 말고 현재 수치 기준으로 실용적 방향을 제시하라.`;

  const r = await callLLM(env, SYSTEM, summary, { maxTokens: 800 });
  return json({ ok: true, stats, analysis: r.ok ? r.text : null, error: r.ok ? undefined : r.error });
});
