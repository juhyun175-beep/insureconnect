/**
 * InsureConnect cron Worker — Pages엔 네이티브 cron이 없어서, 이 별도 Worker가
 * 스케줄에 맞춰 Pages 엔드포인트(/api/cron/*)를 호출한다.
 *   - 매일 07:00 KST  → /api/cron/daily-brief  (일간 모닝 브리핑 + 만기 푸시)
 *   - 매주 월 08:00 KST → /api/cron/weekly-digest (주간 다이제스트)
 *
 * 인증: 이 Worker의 secret CRON_SECRET == Pages의 env.CRON_SECRET 이어야 한다.
 * 실제 발송은 Pages 쪽 게이트(DAILY_BRIEF_ENABLED / DIGEST_SEND_ENABLED)가 '1'일 때만.
 *
 * 배포(이 폴더에서):
 *   1) npx wrangler deploy
 *   2) npx wrangler secret put CRON_SECRET   (Pages와 동일한 값 입력)
 * 수동 테스트: 배포 후 워커 URL 호출 — `?job=weekly`면 주간, 없으면 일간.
 */
const SITE = 'https://insureconnect.co.kr';

async function trigger(env, path) {
  const r = await fetch(SITE + path, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CRON_SECRET || '' },
  });
  const body = await r.text();
  console.log(`[cron] ${path} → ${r.status} ${body.slice(0, 300)}`);
  return body;
}

export default {
  async scheduled(event, env, ctx) {
    // event.cron 으로 어떤 스케줄인지 구분
    const path = event.cron === '0 23 * * 0' ? '/api/cron/weekly-digest' : '/api/cron/daily-brief';
    ctx.waitUntil(trigger(env, path));
  },
  // 수동 트리거(테스트)용 — GET 으로 한 번 실행
  async fetch(request, env) {
    const job = new URL(request.url).searchParams.get('job');
    const path = job === 'weekly' ? '/api/cron/weekly-digest' : '/api/cron/daily-brief';
    const body = await trigger(env, path);
    return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8' } });
  },
};
