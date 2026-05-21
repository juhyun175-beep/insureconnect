/**
 * 동적 OG 미리보기 — 카카오톡·SNS 공유 시 콘텐츠 첫 페이지 이미지 표시
 *
 *   /og/news/{set_id}      → 카드뉴스 첫 슬라이드 이미지
 *   /og/recruit/{id}       → 채용공고 첨부 이미지
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

export const onRequestGet = async ({ params, env }) => {
  const { type, id } = params;

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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(target)}">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:locale" content="ko_KR">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">

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
