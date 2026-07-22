/**
 * 동적 sitemap.xml
 * v2.1.39: 채용공고/강의공고/카드뉴스 + 기존 보험지식 + 정적 URL 통합
 *           Google Jobs / 네이버 검색 노출용 인덱싱 시드
 */
import { INSURERS, safeInsurerNames } from './_lib/insurers.js';
import { GA_LIST } from './_lib/ga-companies.js';
import { BOARD_SEO_WHERE } from './_lib/board-seo.js';
import { caseDiseaseUrl, CASES_INDEX_WHERE } from './_lib/cases-seo.js';

const BASE = 'https://insureconnect.co.kr';

function fmtDate(iso) {
  return iso ? String(iso).slice(0, 10) : new Date().toISOString().slice(0, 10);
}
function urlEntry(loc, lastmod, changefreq = 'weekly', priority = 0.6) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// v2.105.0: lastmod 신뢰 복원 — 기존엔 정적/회사/카테고리 URL의 lastmod가 '요청 시점 오늘'로
//   매 크롤마다 바뀌어 Google이 사이트 전체 lastmod 신호를 불신(부정확한 lastmod는 무시됨).
//   GSC 실측 '발견됨-크롤 안 됨' 63페이지의 재크롤 우선순위에 악영향 → 고정 날짜로 전환.
//   해당 페이지들의 내용이 실제로 크게 바뀐 릴리즈에서만 수동으로 올린다.
const STATIC_LASTMOD = '2026-07-04';

export async function loadCompanyLastmods(env) {
  const names = INSURERS.flatMap((ins) =>
    safeInsurerNames(ins.slug).map((name) => ({ slug: ins.slug, name, official: name === ins.name ? 1 : 0 }))
  );
  try {
    const rs = await env.DB.prepare(
      `WITH insurer_names AS (
         SELECT json_extract(value, '$.slug') AS slug,
                json_extract(value, '$.name') AS name,
                json_extract(value, '$.official') AS official
         FROM json_each(?)
       ), company_updates AS (
         SELECT names.slug, forms.created_at
         FROM insurer_names names
         JOIN ic_claim_forms forms ON forms.company = names.name
         UNION ALL
         SELECT names.slug, COALESCE(cases.updated_at, cases.approved_at, cases.created_at) AS created_at
         FROM insurer_names names
         JOIN ic_insurance_cases cases ON cases.insurer = names.name
         WHERE cases.verify_status = 'approved'
         UNION ALL
         SELECT names.slug, COALESCE(coverages.updated_at, coverages.approved_at, coverages.created_at) AS created_at
         FROM insurer_names names
         JOIN ic_product_coverages coverages ON coverages.insurer = names.name
         WHERE coverages.verify_status = 'approved'
         UNION ALL
         SELECT names.slug, posts.created_at
         FROM insurer_names names
         JOIN ic_board_posts posts
           ON names.official = 1
          AND posts.deleted = 0
          AND (posts.title LIKE '%' || names.name || '%' OR posts.content LIKE '%' || names.name || '%')
       )
       SELECT slug, MAX(created_at) AS lastmod
       FROM company_updates
       GROUP BY 1`
    ).bind(JSON.stringify(names)).all();
    return new Map((rs.results || []).filter((row) => row.slug && row.lastmod).map((row) => [row.slug, row.lastmod]));
  } catch (_) {
    return new Map();
  }
}

export async function onRequestGet({ env }) {
  const today = new Date().toISOString().slice(0, 10);

  // 정적 페이지
  const staticUrls = [
    urlEntry(`${BASE}/`, STATIC_LASTMOD, 'daily', 1.0),
    urlEntry(`${BASE}/about`, STATIC_LASTMOD, 'monthly', 0.7),
    urlEntry(`${BASE}/contact`, STATIC_LASTMOD, 'monthly', 0.5),
    urlEntry(`${BASE}/guide`, STATIC_LASTMOD, 'monthly', 0.6),
    urlEntry(`${BASE}/privacy`, STATIC_LASTMOD, 'yearly', 0.3),
    urlEntry(`${BASE}/terms`, STATIC_LASTMOD, 'yearly', 0.3),
    urlEntry(`${BASE}/disclaimer`, STATIC_LASTMOD, 'yearly', 0.3),
    urlEntry(`${BASE}/insurance`, STATIC_LASTMOD, 'daily', 0.9),
    urlEntry(`${BASE}/company`, STATIC_LASTMOD, 'weekly', 0.8),
    urlEntry(`${BASE}/recruit`, STATIC_LASTMOD, 'daily', 0.85),
    urlEntry(`${BASE}/lecture`, STATIC_LASTMOD, 'daily', 0.85),
    urlEntry(`${BASE}/meeting`, STATIC_LASTMOD, 'daily', 0.85),
    urlEntry(`${BASE}/newsletter`, STATIC_LASTMOD, 'weekly', 0.7),
    urlEntry(`${BASE}/community`, STATIC_LASTMOD, 'daily', 0.7),
  ];

  // v2.39.1: 보험사·GA 전산 랜딩(SSR 콘텐츠·자기 canonical·index,follow) — 메인 사이트맵 통합.
  //          "○○생명 전산 바로가기" 등 고의도 검색 유입 자산. 잘못된 슬러그는 [slug].js가 404 처리.
  //          (기존 functions/api/sitemap.js에만 있던 페이지를 권위본 /sitemap.xml로 일원화)
  const companyLastmods = await loadCompanyLastmods(env);
  const companyUrls = [
    urlEntry(`${BASE}/company/customer-center`, STATIC_LASTMOD, 'weekly', 0.85),
    urlEntry(`${BASE}/company/claim-fax`, STATIC_LASTMOD, 'weekly', 0.85),
    urlEntry(`${BASE}/company/claim-forms`, STATIC_LASTMOD, 'weekly', 0.85),
    ...INSURERS.map(i => urlEntry(`${BASE}/company/${i.slug}`, fmtDate(companyLastmods.get(i.slug) || STATIC_LASTMOD), 'weekly', 0.8)),
    urlEntry(`${BASE}/ga`, STATIC_LASTMOD, 'weekly', 0.8),
    ...GA_LIST.map(g => urlEntry(`${BASE}/ga/${g.slug}`, STATIC_LASTMOD, 'weekly', 0.75)),
  ];

  // v2.0.0 (master): SEO 게시판 카테고리 + 게시글
  const SEO_SLUGS = ['claim','actual-loss','whole-life','cancer','car','practice','recruit-tips','notice','surgery-code','disease-code','terms','underwrite'];
  const seoCategoryUrls = SEO_SLUGS.map(s => urlEntry(`${BASE}/insurance/${s}`, STATIC_LASTMOD, 'daily', 0.8));
  let seoPosts = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT category, slug, created_at, updated_at FROM ic_seo_posts WHERE status='published' ORDER BY created_at DESC LIMIT 5000`
    ).all();
    seoPosts = rs.results || [];
  } catch (_) {}
  const seoPostUrls = seoPosts.map(p =>
    urlEntry(`${BASE}/insurance/${p.category}/${p.slug}`, fmtDate(p.updated_at || p.created_at), 'weekly', 0.85)
  );

  // v2.38.0: 보험지식(Supabase ic_knowledge_posts) 색인 제거 — 현재 0편(레거시·deprecated)인데
  //          sitemap 생성 시 외부 Supabase fetch가 끼어 있어 Google 사이트맵 패치 실패("가져올 수 없음")
  //          리스크 + 무의미한 지연만 유발. 외부 의존 제거로 사이트맵을 D1-only·고속·안정화.

  // 채용공고 (D1 직접)
  let recruits = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, created_at, updated_at FROM ic_recruitments
       WHERE status = 'approved' ORDER BY created_at DESC LIMIT 1000`
    ).all();
    recruits = rs.results || [];
  } catch (_) {}
  const recruitUrls = recruits.map(r =>
    urlEntry(`${BASE}/og/recruit/${r.id}`, fmtDate(r.updated_at || r.created_at), 'weekly', 0.9)
  );

  // 강의공고
  let lectures = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, created_at, updated_at FROM ic_lectures
       WHERE status = 'approved' ORDER BY created_at DESC LIMIT 1000`
    ).all();
    lectures = rs.results || [];
  } catch (_) {}
  const lectureUrls = lectures.map(r =>
    urlEntry(`${BASE}/og/lecture/${r.id}`, fmtDate(r.updated_at || r.created_at), 'weekly', 0.9)
  );

  // v2.70.0: 모임공고는 '참여 게이트'(상세 비공개·noindex) → 개별 og 페이지는 sitemap 제외.
  //   디렉터리 /meeting(정적, 제목 목록)만 색인. 모임 상세는 로그인+참여 후 SPA에서.
  const meetingUrls = [];

  // v2.38.0: 카드뉴스(og/news) 색인 제거 — 카드뉴스는 이미지형이라 크롤 가능한 본문 텍스트가
  //          제목+"보러가기" 링크뿐(≈157자) → thin/low-value 콘텐츠로 사이트 품질을 끌어내려
  //          AdSense 반려·"크롤됐지만 색인안됨"을 유발. og/news는 noindex 처리하고 sitemap에서도 제외.
  //          (공유 미리보기 OG meta는 og 함수에서 그대로 유지됨)

  // 커뮤니티 인기글 (품질 게이트 통과만 — og/board 색인 기준과 동일)
  let boardPosts = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT id, created_at FROM ic_board_posts
       WHERE deleted = 0 AND ${BOARD_SEO_WHERE}
       ORDER BY created_at DESC LIMIT 500`
    ).all();
    boardPosts = rs.results || [];
  } catch (_) {}
  const boardUrls = boardPosts.map(p =>
    urlEntry(`${BASE}/og/board/${p.id}`, fmtDate(p.created_at), 'weekly', 0.5)
  );

  let caseDiseases = [];
  try {
    const rs = await env.DB.prepare(`SELECT TRIM(COALESCE(disease,'')) disease,
      MAX(COALESCE(updated_at, approved_at, created_at)) lastmod,
      COUNT(*) count, SUM(CASE WHEN category IN ('underwrite','disclosure') THEN 1 ELSE 0 END) underwriting
      FROM ic_insurance_cases WHERE ${CASES_INDEX_WHERE}
      GROUP BY TRIM(COALESCE(disease,''))
      HAVING COUNT(*) >= 3 AND SUM(CASE WHEN category IN ('underwrite','disclosure') THEN 1 ELSE 0 END) >= 1`).all();
    caseDiseases = rs.results || [];
  } catch (_) {}
  const caseUrls = caseDiseases.map(d => urlEntry(`${BASE}${caseDiseaseUrl(d.disease)}`, fmtDate(d.lastmod), 'weekly', 0.85));
  const casesLastmod = caseDiseases.reduce((max, d) => String(d.lastmod || '') > max ? String(d.lastmod) : max, '');
  const casesDirectoryUrl = urlEntry(`${BASE}/cases`, fmtDate(casesLastmod || today), 'daily', 0.85);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
  ...staticUrls,
  ...companyUrls,
  ...seoCategoryUrls,
  ...seoPostUrls,
  ...recruitUrls,
  ...lectureUrls,
  ...meetingUrls,
  ...boardUrls,
  casesDirectoryUrl,
  ...caseUrls,
].join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=1800, s-maxage=3600',
    },
  });
}
