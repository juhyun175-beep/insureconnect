/**
 * v2.39.1: 사이트맵 단일화.
 *   과거 /api/sitemap 이 별도 사이트맵을 생성했으나(보험사·GA 랜딩 + 죽은 Supabase fetch),
 *   해당 URL들을 모두 권위본 functions/sitemap.xml.js(/sitemap.xml)로 통합함.
 *   이중 사이트맵·중복 유지보수·외부 의존을 제거하기 위해 이 엔드포인트는 /sitemap.xml 로 301 영구이동.
 *   robots.txt 도 /sitemap.xml 만 광고하므로 크롤러 영향 없음(하위호환 목적).
 */
export const onRequestGet = () =>
  new Response(null, {
    status: 301,
    headers: {
      Location: 'https://insureconnect-hub.pages.dev/sitemap.xml',
      'cache-control': 'public, max-age=86400',
    },
  });
