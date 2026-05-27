/**
 * v2.1.46: 공통 봇/크롤러/스크래퍼 UA 차단 헬퍼
 *
 * 트래킹 API 에서 사용 — 통계 데이터를 봇 트래픽으로 오염시키지 않도록.
 */
const BOT_UA_RE = /bot|crawler|spider|scrap|preview|facebookexternalhit|twitterbot|slackbot|telegrambot|whatsapp|line\/|kakaotalk-scrap|kakao-link|naverbot|yeti|googlebot|bingbot|duckduck|baidu|yandex|applebot|embedly|outbrain|pinterest|discordbot|skypeuripreview|chatgpt|gptbot|claudebot|perplexitybot|headless|phantom|selenium|playwright|puppeteer|cypress/i;

export function isBot(request) {
  const ua = (request && request.headers ? request.headers.get('User-Agent') : '') || '';
  if (!ua) return true; // UA 없으면 봇으로 간주
  return BOT_UA_RE.test(ua);
}
