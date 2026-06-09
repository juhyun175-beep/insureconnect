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

/** v2.1.42: 동적 OG 이미지 — 업로드 이미지 없을 때 사용
 *  wsrv.nl 프록시로 SVG→PNG 변환 (카카오톡은 SVG 미리보기 미지원이라 PNG 필요) */
const dynamicOgImage = (type, id) => {
  const svgUrl = `${SITE}/og-image/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
  return `https://wsrv.nl/?url=${encodeURIComponent(svgUrl)}&output=png&w=1200&h=630&fit=cover`;
};

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

  // v2.29.0: 방문 집계는 클라이언트 비콘(실브라우저)만 — 서버측 og GET 집계 제거.
  //   카톡 공유 링크는 봇UA를 벗어난 프리페치/프리뷰 재요청을 끌어들여 방문수를 부풀렸음(over-count).
  //   실제 사람은 아래 클라이언트 리다이렉트로 착지 페이지(홈/콘텐츠)에 도달 → 그곳 trackVisit이 1회 집계.

  let title = 'InsureConnect — 보험으로 연결하다';
  let desc  = '보험설계사를 위한 통합 허브';
  let image = FALLBACK_IMG;
  let target = SITE + '/';
  let bodyContent = '';         // v2.1.39: 검색엔진 인덱싱용 본문 텍스트
  let jsonLd = null;            // v2.1.39: schema.org JSON-LD
  let indexable = false;        // v2.1.39: 검색 인덱싱 허용 여부

  try {
    if (type === 'news') {
      const r = await env.DB.prepare(
        `SELECT title, file_url FROM ic_card_news WHERE set_id = ? ORDER BY sort_order ASC LIMIT 1`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        // v2.1.42: 업로드 이미지 우선, 없으면 동적 OG 이미지
        image = r.file_url ? absUrl(r.file_url) : dynamicOgImage('news', id);
        target = `${SITE}/?news=${encodeURIComponent(id)}`;
        desc = '인슈어커넥트 뉴스 카드 보러가기';
        indexable = true;
        bodyContent = `<h1>${esc(title)}</h1><p>${esc(desc)}</p>`;
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description: desc,
          image: image,
          publisher: { '@type': 'Organization', name: 'InsureConnect', logo: { '@type': 'ImageObject', url: FALLBACK_IMG } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': target }
        };
      }
    } else if (type === 'recruit') {
      const r = await env.DB.prepare(
        `SELECT title, company_name, description, file_url, file_type, created_at FROM ic_recruitments WHERE id = ? AND status = 'approved'`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        desc = r.company_name ? `[${r.company_name}] ${(r.description || '').slice(0, 80)}` : (r.description || '').slice(0, 100);
        // v2.1.42: 업로드 이미지 우선, 없으면 동적 OG 이미지
        image = (r.file_type === 'image' && r.file_url) ? absUrl(r.file_url) : dynamicOgImage('recruit', id);
        target = `${SITE}/?recruit=${encodeURIComponent(id)}`;
        indexable = true;
        const fullDesc = (r.description || '').replace(/\s+/g, ' ').trim();
        bodyContent = `<h1>${esc(r.title)}</h1>${r.company_name ? `<p><strong>${esc(r.company_name)}</strong></p>` : ''}<div style="white-space:pre-line">${esc(fullDesc)}</div>`;
        // Google Jobs JobPosting schema
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          title: r.title,
          description: fullDesc || r.title,
          datePosted: (r.created_at || new Date().toISOString()).slice(0, 10),
          validThrough: new Date(Date.now() + 90 * 86400e3).toISOString().slice(0, 10),
          employmentType: 'CONTRACTOR',
          hiringOrganization: {
            '@type': 'Organization',
            name: r.company_name || 'InsureConnect 등록 채용',
            sameAs: SITE
          },
          jobLocation: {
            '@type': 'Place',
            address: { '@type': 'PostalAddress', addressCountry: 'KR' }
          },
          directApply: false,
          industry: '보험',
          identifier: { '@type': 'PropertyValue', name: 'InsureConnect', value: String(r.title) },
          image: image
        };
      }
    } else if (type === 'lecture') {
      // v2.1.21: 강의 공고 공유 미리보기
      const r = await env.DB.prepare(
        `SELECT title, instructor, description, file_url, file_type, created_at FROM ic_lectures WHERE id = ? AND status = 'approved'`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        desc = r.instructor ? `[${r.instructor}] ${(r.description || '').slice(0, 80)}` : (r.description || '').slice(0, 100);
        // v2.1.42: 업로드 이미지 우선, 없으면 동적 OG 이미지
        image = (r.file_type === 'image' && r.file_url) ? absUrl(r.file_url) : dynamicOgImage('lecture', id);
        target = `${SITE}/?lecture=${encodeURIComponent(id)}`;
        indexable = true;
        const fullDesc = (r.description || '').replace(/\s+/g, ' ').trim();
        bodyContent = `<h1>${esc(r.title)}</h1>${r.instructor ? `<p><strong>강사: ${esc(r.instructor)}</strong></p>` : ''}<div style="white-space:pre-line">${esc(fullDesc)}</div>`;
        // Course schema for Google's Course tab
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: r.title,
          description: fullDesc || r.title,
          provider: {
            '@type': 'Organization',
            name: r.instructor || 'InsureConnect',
            sameAs: SITE
          },
          image: image,
          inLanguage: 'ko-KR'
        };
      }
    } else if (type === 'knowledge') {
      const r = await env.DB.prepare(
        `SELECT title, content, image_url, created_at FROM ic_knowledge_posts WHERE id = ?`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        desc = (r.content || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
        // v2.1.42: 업로드 이미지 우선, 없으면 동적 OG 이미지
        image = r.image_url ? absUrl(r.image_url) : dynamicOgImage('knowledge', id);
        target = `${SITE}/knowledge/${encodeURIComponent(id)}`;
        indexable = true;
        const fullContent = (r.content || '').replace(/\[.*?\]/g, '').slice(0, 1500);
        bodyContent = `<h1>${esc(r.title)}</h1><div style="white-space:pre-line">${esc(fullContent)}</div>`;
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: r.title,
          description: desc,
          articleBody: fullContent,
          image: image,
          datePublished: (r.created_at || new Date().toISOString()).slice(0, 10),
          publisher: { '@type': 'Organization', name: 'InsureConnect', logo: { '@type': 'ImageObject', url: FALLBACK_IMG } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': target }
        };
      }
    } else if (type === 'board') {
      const r = await env.DB.prepare(
        `SELECT title, content, nickname, created_at, view_count, comment_count FROM ic_board_posts WHERE id = ? AND deleted = 0`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        const clean = (r.content || '').replace(/\s+/g, ' ').trim();
        desc = (r.nickname ? `[${r.nickname}] ` : '') + clean.slice(0, 110);
        image = dynamicOgImage('board', id); // 글 내용이 보이는 카드 이미지
        target = `${SITE}/board/${encodeURIComponent(id)}`;
        // UGC 전수 색인은 리스크 → 인기·충실 글만 선별 색인 (그 외 noindex 유지)
        indexable = ((r.view_count || 0) >= 20 && clean.length >= 150);
        bodyContent = `<h1>${esc(r.title)}</h1><div style="white-space:pre-line">${esc(clean.slice(0, 1500))}</div>`;
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'DiscussionForumPosting',
          headline: r.title,
          text: clean.slice(0, 500),
          author: { '@type': 'Person', name: r.nickname || '회원' },
          datePublished: (r.created_at || new Date().toISOString()).slice(0, 10),
          image: image,
          mainEntityOfPage: { '@type': 'WebPage', '@id': target }
        };
      }
    } else if (type === 'invite') {
      // v2.16.1: 추천 초대 링크 — 매력적 OG 미리보기 + ?ref 귀속 보존(가입 시 양방향 포인트)
      title = '인슈어커넥트 무료 초대장 🎁';
      desc = '보험설계사 통합 플랫폼 — 전산·청구·채용·강의·삼따AI 전부 무료. 이 링크로 가입하면 둘 다 포인트!';
      image = dynamicOgImage('invite', id);
      target = `${SITE}/?ref=${encodeURIComponent(id)}`;
      indexable = false;
    }
  } catch (_) {}

  // v2.29.0: 서버측 집계 폐지 → _via=share 중복방지 플래그 불필요. og→착지 페이지의 클라이언트 trackVisit이 실인간을 1회 집계.

  const robotsTag = indexable ? 'index,follow' : 'noindex,nofollow';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robotsTag}">
<link rel="canonical" href="${esc(target.split('?')[0])}">

<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:url" content="${esc(target)}">
<meta property="og:site_name" content="InsureConnect">
<meta property="og:locale" content="ko_KR">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(title)}">
${jsonLd ? `\n<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;background:#f0f5ff;color:#3d5080;padding:32px 20px;max-width:760px;margin:0 auto;line-height:1.6}h1{font-size:24px;color:#1a3de8;margin-bottom:12px}.r-back{display:inline-block;margin-top:24px;padding:10px 18px;background:#1a3de8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700}img.r-img{max-width:100%;border-radius:12px;margin:16px 0}</style>
</head>
<body>
${bodyContent ? `<article>${bodyContent}${image && image !== FALLBACK_IMG ? `<img class="r-img" src="${esc(image)}" alt="${esc(title)}">` : ''}<a class="r-back" href="${esc(target)}">📖 InsureConnect에서 자세히 보기 →</a></article>` : `<p>이동 중... <a href="${esc(target)}">${esc(title)}</a></p>`}
<script>
// v2.1.39: 봇이 아닌 일반 방문자만 자동 redirect (검색엔진 크롤러는 본문 인덱싱)
(function(){
  var ua = (navigator.userAgent || '').toLowerCase();
  var isBot = /bot|crawler|spider|scrap|yeti|google|bing|baidu|yandex|naver|kakao|preview|facebookexternalhit|twitterbot|slack|discord|line|whatsapp/i.test(ua);
  if (!isBot) setTimeout(function(){ location.replace(${JSON.stringify(target)}); }, 50);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300', // 카카오 봇 캐시 5분
    }
  });
};
