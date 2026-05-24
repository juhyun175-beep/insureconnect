/**
 * 동적 OG 미리보기 — 카카오톡·SNS 공유 시 콘텐츠 첫 페이지 이미지 표시
 *
 *   /og/news/{set_id}      → 카드뉴스 첫 슬라이드 이미지
 *   /og/recruit/{id}       → 채용공고 첨부 이미지
 *   /og/lecture/{id}       → 강의공고 첨부 이미지 (v2.1.21)
 *   /og/knowledge/{id}     → 보험지식 image_url
 *
 * 응답 = 빈 HTML + OG meta + 메타 refresh로 실제 페이지로 즉시 이동.
 * 카카오톡 봇은 OG meta만 읽고, 실제 사용자는 즉시 redirect됨.
 */
const SITE = 'https://insureconnect-hub.pages.dev';
const FALLBACK_IMG = `${SITE}/logo-full.png`;

/** 상대 경로 → 절대 URL (카카오톡 봇은 절대 URL 필요) */
const absUrl = (u) => {
  if (!u) return FALLBACK_IMG;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return SITE + u;
  return SITE + '/' + u;
};

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** v2.0.9: 봇/크롤러 UA 패턴 (이런 UA는 방문자 카운트에서 제외) */
const BOT_UA_RE = /bot|crawler|spider|scrap|preview|facebookexternalhit|twitterbot|slackbot|telegrambot|whatsapp|line\/|kakaotalk-scrap|kakao-link|naverbot|yeti|googlebot|bingbot|duckduck|baidu|yandex|applebot|embedly|outbrain|pinterest|discordbot|skypeuripreview|chatgpt|gptbot|claudebot|perplexitybot/i;

function kstDateKey() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** OG 공유 링크로 들어온 사람 카운트 (봇 제외) */
async function trackOgVisit(env, request) {
  try {
    const ua = (request.headers.get('User-Agent') || '').toLowerCase();
    if (!ua || BOT_UA_RE.test(ua)) return false; // 봇 제외

    const date = kstDateKey();
    await env.DB.prepare(
      `INSERT INTO ic_visits_daily (date, visits, unique_visits)
       VALUES (?, 1, 1)
       ON CONFLICT (date) DO UPDATE SET visits = visits + 1`
    ).bind(date).run();
    return true;
  } catch (_) {
    return false;
  }
}

export const onRequestGet = async ({ params, env, request }) => {
  const { type, id } = params;

  // v2.0.9: 봇 아닌 사람이 OG 링크 클릭 시 방문자수 증가
  const tracked = await trackOgVisit(env, request);

  let title = 'InsureConnect — 보험으로 연결하다';
  let desc  = '보험설계사를 위한 통합 허브';
  let image = FALLBACK_IMG;
  let target = SITE + '/';

  try {
    if (type === 'news') {
      const r = await env.DB.prepare(
        `SELECT title, file_url FROM ic_card_news WHERE set_id = ? ORDER BY sort_order ASC LIMIT 1`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        if (r.file_url) image = absUrl(r.file_url);
        target = `${SITE}/?news=${encodeURIComponent(id)}`;
        desc = '인슈어커넥트 뉴스 카드 보러가기';
      }
    } else if (type === 'recruit') {
      const r = await env.DB.prepare(
        `SELECT title, company_name, description, file_url, file_type FROM ic_recruitments WHERE id = ?`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        desc = r.company_name ? `[${r.company_name}] ${(r.description || '').slice(0, 80)}` : (r.description || '').slice(0, 100);
        if (r.file_type === 'image' && r.file_url) image = absUrl(r.file_url);
        target = `${SITE}/?recruit=${encodeURIComponent(id)}`;
      }
    } else if (type === 'lecture') {
      // v2.1.21: 강의 공고 공유 미리보기
      const r = await env.DB.prepare(
        `SELECT title, instructor, description, file_url, file_type FROM ic_lectures WHERE id = ?`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        desc = r.instructor ? `[${r.instructor}] ${(r.description || '').slice(0, 80)}` : (r.description || '').slice(0, 100);
        if (r.file_type === 'image' && r.file_url) image = absUrl(r.file_url);
        target = `${SITE}/?lecture=${encodeURIComponent(id)}`;
      }
    } else if (type === 'knowledge') {
      const r = await env.DB.prepare(
        `SELECT title, content, image_url FROM ic_knowledge_posts WHERE id = ?`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        desc = (r.content || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (r.image_url) image = absUrl(r.image_url);
        target = `${SITE}/knowledge/${encodeURIComponent(id)}`;
      }
    }
  } catch (_) {}

  // v2.0.9: 서버측 카운트 성공 시 클라이언트 중복 트래킹 방지 플래그
  if (tracked) {
    const sep = target.includes('?') ? '&' : '?';
    target = `${target}${sep}_via=share`;
  }

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex,nofollow">

<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:url" content="${esc(target)}">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:locale" content="ko_KR">

<!-- v2.1.16: width/height 하드코딩 제거 — 실제 카드뉴스 첫 슬라이드 (예: 2100×3000) 와 안 맞으면
     일부 스크래퍼(카카오/슬랙)가 OG 이미지로 거부하는 케이스 방지 -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(title)}">

<meta http-equiv="refresh" content="0;url=${esc(target)}">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;background:#f0f5ff;color:#3d5080;text-align:center;padding:48px 16px}a{color:#1a3de8;text-decoration:none;font-weight:700}</style>
</head>
<body>
<p>이동 중... <a href="${esc(target)}">${esc(title)}</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300', // 카카오 봇 캐시 5분
    }
  });
};
