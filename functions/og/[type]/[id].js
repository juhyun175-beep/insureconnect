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
import { isBoardIndexable } from '../../_lib/board-seo.js';

const SITE = 'https://insureconnect.co.kr';
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
        // v2.38.0: 카드뉴스는 이미지형 → 크롤 가능한 본문 텍스트가 없어(제목+링크뿐) 색인 시
        //          thin/low-value 콘텐츠로 판정됨(AdSense 반려·"크롤됐지만 색인안됨" 유발).
        //          카톡/SNS 공유 미리보기(OG meta)는 그대로 유지하되, 검색 색인만 차단(noindex)하고
        //          sitemap.xml에서도 제외한다.
        indexable = false;
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
          url: target,
          datePosted: (r.created_at || new Date().toISOString()).slice(0, 10),
          validThrough: new Date(Date.now() + 90 * 86400e3).toISOString().slice(0, 10),
          employmentType: 'CONTRACTOR',
          jobLocationType: 'TELECOMMUTE',
          // v2.91.1: jobLocationType=TELECOMMUTE(원격)인 공고는 Google이 applicantLocationRequirements를
          //   필수로 요구함(누락 시 리치결과 미노출). 전국 단위 채용이므로 지원 가능 지역 = 대한민국(KR).
          applicantLocationRequirements: { '@type': 'Country', name: 'KR' },
          hiringOrganization: {
            '@type': 'Organization',
            name: r.company_name || 'InsureConnect 등록 채용',
            sameAs: SITE,
            url: SITE
          },
          jobLocation: {
            '@type': 'Place',
            address: { '@type': 'PostalAddress', addressCountry: 'KR', addressLocality: '전국', addressRegion: '전국' }
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
    } else if (type === 'meetup') {
      // v2.70.0: 모임은 '참여 게이트' — 상세(장소·일시·신청폼·설명)는 로그인+참여해야 공개.
      //   공유 미리보기·검색에는 제목·주최만 노출(noindex). 실제 상세는 SPA에서 참여 후.
      const r = await env.DB.prepare(
        `SELECT title, host FROM ic_meetings WHERE id = ? AND status = 'approved'`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        desc = (r.host ? `주최: ${r.host} · ` : '') + '로그인 후 참여하면 모임 장소·일시·신청 방법을 확인할 수 있어요.';
        image = dynamicOgImage('meetup', id);
        target = `${SITE}/?meeting=${encodeURIComponent(id)}`;
        indexable = false; // 참여 게이트 — 상세 비공개라 색인하지 않음
        bodyContent = `<h1>${esc(r.title)}</h1>${r.host ? `<p><strong>주최: ${esc(r.host)}</strong></p>` : ''}<p>🔒 이 모임의 <strong>장소·일시·신청 방법</strong>은 로그인 후 「참여하기」를 누르면 확인할 수 있습니다.</p>`;
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
          url: target,
          datePublished: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
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
        indexable = isBoardIndexable({ content: clean, view_count: r.view_count, comment_count: r.comment_count });
        bodyContent = `<h1>${esc(r.title)}</h1><div style="white-space:pre-line">${esc(clean.slice(0, 1500))}</div>`;
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'DiscussionForumPosting',
          headline: r.title,
          text: clean.slice(0, 500),
          url: target,
          author: { '@type': 'Person', name: r.nickname || '회원', url: SITE },
          datePublished: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
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

  // v2.91.0: canonical 정정 — 쿼리형 타깃(?recruit=·?lecture= 등 SPA 뷰)은 전용 색인 페이지가 없어
  //   기존 target.split('?')[0] 가 홈('/')으로 접혀, 사이트맵에 등록된 og 페이지가 "홈 중복"으로 색인 제외됐다.
  //   → 쿼리형이면 og 페이지 자신(self)을 canonical로(사이트맵 URL과 일치), 경로형(/knowledge/·/board/)은
  //     전용 SSR 페이지를 canonical로 유지.
  const selfUrl = `${SITE}/og/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
  // v2.105.0: 색인 자격(board 품질 게이트 통과) 글도 canonical을 self로 —
  //   기존엔 /og/board/N(index,follow·sitemap 등재)이 canonical을 /board/N으로 가리켰는데
  //   /board/N은 전수 noindex라 "색인해도 되는 글"이 구조적으로 색인 불가(모순).
  //   GSC 실측: og/board/16·22가 "적절한 canonical이 있는 대체 페이지"로 색인 제외됨.
  const canonicalUrl = (target.includes('?') || (type === 'board' && indexable))
    ? selfUrl
    : target.split('?')[0];

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robotsTag}">
<link rel="canonical" href="${esc(canonicalUrl)}">

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
