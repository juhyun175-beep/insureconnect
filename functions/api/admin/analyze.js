/**
 * v2.15.5: 통계분석 보고서 — AI 상세 분석 (GET /api/admin/analyze, 관리자)
 *   기준: 이번 달(매월 1일~현재) vs 전월 동기간. + 전환 채널별 상세(채용·강의·렌트카·통신, 누적/이번달)
 *   + 유입 상위 → LLM 상세 분석(투자자 PT용).
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { callLLM, aiProvider } from '../../_lib/ai.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestGet = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  // ── 기준 기간: 이번 달 1일 ~ 현재(KST) / 전월 동기간(1일~같은 일수) ──
  const now = new Date(Date.now() + 9 * 3600 * 1000);            // KST 벽시계
  const Y = now.getUTCFullYear(), Mo = now.getUTCMonth(), Dom = now.getUTCDate();
  const isoOf = (d) => d.toISOString().slice(0, 10);
  const monthStart = isoOf(new Date(Date.UTC(Y, Mo, 1)));         // 이번 달 1일
  const prevMonthStart = isoOf(new Date(Date.UTC(Y, Mo - 1, 1))); // 지난 달 1일
  const prevPeriodEnd = isoOf(new Date(Date.UTC(Y, Mo - 1, 1 + Dom))); // 지난 달 1일~같은 일수 (exclusive)
  const periodLabel = `${Mo + 1}월 1일~${Dom}일`;

  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).first().catch(() => null);
  const all = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results || []).catch(() => []);
  const sumType = async (v, since) => (await q(
    since ? `SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_type=? AND date>=?`
          : `SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_type=?`,
    ...(since ? [v, since] : [v])))?.n || 0;
  const sumName = async (v, since) => (await q(
    since ? `SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_name=? AND date>=?`
          : `SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_name=?`,
    ...(since ? [v, since] : [v])))?.n || 0;

  const [vM, vPrev, vTotal, cM, convM, convPrev, mTotal, mNewM,
    recV, recF, recFm, lecV, lecF, lecFm, renC, renS, renSm, telC, telS, telSm,
    trafTop, trafTotal] = await Promise.all([
    q(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily WHERE date>=?`, monthStart),
    q(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily WHERE date>=? AND date<?`, prevMonthStart, prevPeriodEnd),
    q(`SELECT COALESCE(SUM(visits),0) n FROM ic_visits_daily`),
    q(`SELECT COALESCE(SUM(clicks),0) n FROM ic_card_clicks_daily WHERE date>=?`, monthStart),
    q(`SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_type LIKE '%form' AND date>=?`, monthStart),
    q(`SELECT COALESCE(SUM(clicks),0) n FROM ic_link_clicks_daily WHERE company_type LIKE '%form' AND date>=? AND date<?`, prevMonthStart, prevPeriodEnd),
    q(`SELECT COUNT(*) n FROM ic_members`),
    q(`SELECT COUNT(*) n FROM ic_members WHERE created_at>=?`, monthStart),
    sumType('recruit_view'), sumType('recruit_form'), sumType('recruit_form', monthStart),
    sumType('lecture_view'), sumType('lecture_form'), sumType('lecture_form', monthStart),
    sumName('렌트카 견적 시작'), sumName('렌트카 견적 신청 완료'), sumName('렌트카 견적 신청 완료', monthStart),
    sumName('통신 견적 시작'), sumName('통신 견적 신청 완료'), sumName('통신 견적 신청 완료', monthStart),
    all(`SELECT source AS name, COUNT(*) AS count FROM ic_traffic_hits GROUP BY source ORDER BY count DESC LIMIT 6`),
    q(`SELECT COUNT(*) n FROM ic_traffic_hits`),
  ]);

  const rate = (s, e) => (e > 0 ? Math.round((s / e) * 1000) / 10 : 0);
  const conversions = [
    { channel: '채용공고 지원', entry: recV, submit: recF, rate: rate(recF, recV), month: recFm },
    { channel: '강의 신청', entry: lecV, submit: lecF, rate: rate(lecF, lecV), month: lecFm },
    { channel: '렌트카 견적', entry: renC, submit: renS, rate: rate(renS, renC), month: renSm },
    { channel: '통신 견적', entry: telC, submit: telS, rate: rate(telS, telC), month: telSm },
  ];
  const stats = {
    period_label: periodLabel, month_num: Mo + 1, month_start: monthStart,
    visits_month: vM?.n || 0, visits_prev: vPrev?.n || 0, visits_total: vTotal?.n || 0,
    clicks_month: cM?.n || 0, conversions_month: convM?.n || 0, conversions_prev: convPrev?.n || 0,
    members_total: mTotal?.n || 0, members_new_month: mNewM?.n || 0,
    generated_at: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '),
  };
  const traffic = { top: trafTop, total: trafTotal?.n || 0 };

  if (!aiProvider(env)) return json({ ok: true, stats, conversions, traffic, analysis: null, code: 'no_key' });

  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : (a > 0 ? 100 : 0));
  const convLines = conversions.map((c) => `  · ${c.channel}: 진입/클릭 ${c.entry} → 신청 ${c.submit} (전환율 ${c.rate}%) · 이번 달 신청 ${c.month}`).join('\n');
  const trafLines = (trafTop.length ? trafTop : [{ name: '(데이터 없음)', count: 0 }]).map((t) => `  · ${t.name || '직접/앱'}: ${t.count}회`).join('\n');
  const summary = `[인슈어커넥트(보험설계사 통합 플랫폼) — 이번 달(${periodLabel}) 기준 지표, 괄호는 전월 동기간 대비]
방문자: 이번 달 ${stats.visits_month}명 (전월 동기 ${stats.visits_prev}, ${pct(stats.visits_month, stats.visits_prev)}%) / 누적 ${stats.visits_total}명
카드 클릭: 이번 달 ${stats.clicks_month}회
전환(신청폼) 합계: 이번 달 ${stats.conversions_month}회 (전월 동기 ${stats.conversions_prev}, ${pct(stats.conversions_month, stats.conversions_prev)}%)
회원: 누적 ${stats.members_total}명 / 이번 달 신규 ${stats.members_new_month}명

[전환 채널별 상세 (진입→신청 누적, 그리고 이번 달 신청)]
${convLines}

[유입 경로 상위 (누적, 총 ${traffic.total}회)]
${trafLines}`;

  const SYSTEM = `너는 인슈어커넥트(보험설계사 통합 플랫폼)의 운영·성장 데이터 분석가다. 아래 지표를 근거로 **투자자 대상 PT용 상세 분석 보고서**를 한국어로 작성하라. 기준 기간은 '이번 달(매월 1일~현재)'이며 비교는 '전월 동기간(같은 일수)'이다. 마크다운 기호(#, * 등) 없이 번호와 줄바꿈으로 구조화하고, 각 항목을 수치를 인용해 충분히 구체적으로 작성하라:

1. 현황 종합 (3~4줄 — 이번 달 방문·전환·회원 추세와 전월 동기 대비 핵심 수치)
2. 유입 채널 분석 (어느 경로가 효율적인지, 의존도·리스크, AI 검색엔진/SNS 유입 여부)
3. 전환 분석 (채용·강의·렌트카·통신 중 어느 폼이 전환을 만드는지, 채널별 전환율 비교, 병목 지점)
4. 강점 (2~3개) / 리스크 (2~3개)
5. 다음달 실행 전략 (구체적 액션 5~6개, 각 1~2줄 — 성장 5축: 유입·전환·콘텐츠·재방문·수익)
6. 다음달 KPI 목표 (방문·전환·회원 구체적 목표치 제안)

투자자가 읽을 보고서이니 충분히 상세하고 설득력 있게. 데이터가 적어도 '부족하다'는 표현 대신 현재 수치 기준으로 잠재력과 실행 방향을 제시하라.`;

  const r = await callLLM(env, SYSTEM, summary, { maxTokens: 1500 });
  return json({ ok: true, stats, conversions, traffic, analysis: r.ok ? r.text : null, error: r.ok ? undefined : r.error });
});
