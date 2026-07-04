// Cloudflare Pages Function — dynamic OG tags for shared links
// Works for:
//   ?news=<set_id>   → 카드뉴스
//   ?recruit=<id>    → 채용공고
//   ?post=<id>       → 보험지식

const SB_URL  = 'https://rzllpymhtygnooduevgf.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bGxweW1odHlnbm9vZHVldmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjg1NjYsImV4cCI6MjA4NzkwNDU2Nn0.Z2K720NiFo191fVBllr0_OiTxvJYjwTSv3ZSiNgc2bs';

const TRUSTED_IMAGE_PREFIX = `${SB_URL}/storage/`;
const DEFAULT_OG_IMAGE     = 'https://insureconnect.co.kr/logo-full.png';

const SB_HEADERS = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };

function safeImage(url) {
  if (typeof url === 'string' && url.startsWith(TRUSTED_IMAGE_PREFIX)) return url;
  return DEFAULT_OG_IMAGE;
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function sbFetch(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows : null;
}

function buildOg({ title, description, image, url }) {
  const t = esc(title);
  const d = esc(description);
  const i = esc(image);
  const u = esc(url);
  return `<!-- OG:START -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="InsureConnect">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${i}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${u}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${i}">
  <!-- OG:END -->`;
}

// 내부 파일(문서/SQL/설정/스크립트)이 정적 자산으로 공개 서빙되는 것을 차단.
// `wrangler pages deploy` 는 .assetsignore 를 적용하지 않아 파일이 업로드되므로, 미들웨어에서 직접 404 처리한다.
// 공개 유지: *.html, 이미지, sw.js, robots.txt/ads.txt/llms.txt, sitemap.xml, /api/*
const BLOCK_EXT  = /\.(md|sql|toml)$/i;
const BLOCK_DIR  = /^\/(scripts|migrations|docs|tests|seo-seed|naver-blog|\.netlify|\.wrangler|\.claude|\.git)(\/|$)/i;
const BLOCK_FILE = /^\/(\.gitignore|\.assetsignore|package\.json|package-lock\.json)$/i;
function isInternalPath(p) {
  return BLOCK_EXT.test(p) || BLOCK_DIR.test(p) || BLOCK_FILE.test(p) || /pdf_extract\.txt$/i.test(p);
}

export async function onRequest(context) {
  const { request, next } = context;
  const reqUrl = new URL(request.url);

  // v2.97.0: 커스텀 도메인 통합 — 프로덕션 pages.dev 표준 호스트 → insureconnect.co.kr 301(영구).
  //   중복 도메인 색인/AdSense 혼선 방지. 배포 프리뷰(<hash>.insureconnect-hub.pages.dev)·co.kr·로컬은 통과.
  //   카카오 OAuth 콜백(redirect_uri=pages.dev; _lib/auth.js)도 이 301로 co.kr에 funnel → 세션 쿠키(host-only)가
  //   co.kr에 안착해 로그인 정상. (카카오 콘솔 변경 불필요)
  if (reqUrl.hostname === 'insureconnect-hub.pages.dev') {
    return Response.redirect(`https://insureconnect.co.kr${reqUrl.pathname}${reqUrl.search}`, 301);
  }

  // 내부 파일 직접 접근 차단 (정보노출 방지)
  if (isInternalPath(reqUrl.pathname)) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
    });
  }

  // v2.105.0: /api/(JSON)·/og-image/(OG용 SVG)는 검색 색인 대상이 아님 — X-Robots-Tag로 명시.
  //   GSC 실측: /og-image/news/* 15건이 "중복(canonical 미지정)"·"크롤됨-색인안됨" 버킷에,
  //   /api/* 다수가 색인 후보로 잡혀 크롤 예산·품질 신호를 갉아먹음.
  //   /og-image/는 robots.txt로 막으면 카카오/페북 미리보기 스크레이퍼가 이미지를 못 가져올
  //   수 있어 헤더로만 색인 제외(크롤은 허용). SVG엔 meta 태그를 못 넣으므로 헤더가 유일 수단.
  if (/^\/(api|og-image)\//.test(reqUrl.pathname)) {
    const res = await next();
    const headers = new Headers(res.headers);
    headers.set('x-robots-tag', 'noindex');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }

  // 루트 HTML 요청만 처리
  const isRoot = (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html')
    && request.method === 'GET';
  if (!isRoot) return next();

  const newsId    = reqUrl.searchParams.get('news');
  const recruitId = reqUrl.searchParams.get('recruit');
  const postId    = reqUrl.searchParams.get('post');

  if (!newsId && !recruitId && !postId) return next();

  // 원본 HTML 취득
  const originalRes = await next();
  if (!(originalRes.headers.get('content-type') || '').includes('text/html')) return originalRes;
  const html = await originalRes.text();

  let og = null;
  try {
    if (newsId) {
      const rows = await sbFetch(
        `ic_card_news?set_id=eq.${encodeURIComponent(newsId)}&order=sort_order.asc&select=title,file_url,file_type`
      );
      if (rows) {
        const cover = rows.find(r => r.file_type === 'image') || rows[0];
        og = buildOg({
          title: `${rows[0].title} · InsureConnect 카드뉴스`,
          description: `${rows.length}장의 카드뉴스로 확인하는 최신 보험 이슈.`,
          image: safeImage(cover?.file_url),
          url: reqUrl.toString(),
        });
      }
    } else if (recruitId) {
      const rows = await sbFetch(
        `ic_recruitments?id=eq.${encodeURIComponent(recruitId)}&select=title,company_name,description,file_url,file_type&limit=1`
      );
      if (rows) {
        const r = rows[0];
        og = buildOg({
          title: `${r.company_name ? '['+r.company_name+'] ' : ''}${r.title} · InsureConnect 채용공고`,
          description: (r.description || '보험사 채용공고를 인슈어커넥트에서 확인하세요.').slice(0, 150),
          image: r.file_type === 'image' ? safeImage(r.file_url) : DEFAULT_OG_IMAGE,
          url: reqUrl.toString(),
        });
      }
    } else if (postId) {
      const rows = await sbFetch(
        `ic_knowledge_posts?id=eq.${encodeURIComponent(postId)}&select=title,content,image_url&limit=1`
      );
      if (rows) {
        const p = rows[0];
        const plain = (p.content || '')
          .replace(/\[img:[^\]]+\]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 150);
        og = buildOg({
          title: `${p.title} · InsureConnect 보험지식`,
          description: plain || '보험 설계사를 위한 보험지식 콘텐츠를 인슈어커넥트에서 확인하세요.',
          image: safeImage(p.image_url),
          url: reqUrl.toString(),
        });
      }
    }
  } catch (_) {}

  if (!og) return new Response(html, {
    status: originalRes.status,
    headers: { ...Object.fromEntries(originalRes.headers), 'content-type': 'text/html; charset=utf-8' }
  });

  const rewritten = html.replace(/<!-- OG:START -->[\s\S]*?<!-- OG:END -->/, og);

  return new Response(rewritten, {
    status: originalRes.status,
    headers: {
      ...Object.fromEntries(originalRes.headers),
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300',
    },
  });
}
