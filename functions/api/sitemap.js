/**
 * v2.39.1: 사이트맵 단일화.
 *   과거 /api/sitemap 이 별도 사이트맵을 생성했으나(보험사·GA 랜딩 + 죽은 Supabase fetch),
 *   해당 URL들을 모두 권위본 functions/sitemap.xml.js(/sitemap.xml)로 통합함.
 *   이중 사이트맵·중복 유지보수·외부 의존을 제거하기 위해 이 엔드포인트는 /sitemap.xml 로 301 영구이동.
 *   v2.105.0: robots.txt 가 /api/ 전체를 Disallow 하므로 준수 크롤러는 이 301에 도달 불가 —
 *   사람/비준수 클라이언트용 잔존 리다이렉트. GSC·네이버 서치어드바이저에 /api/sitemap 이
 *   등록돼 있다면 '가져올 수 없음(robots 차단)'이 되므로 /sitemap.xml 만 등록 유지할 것.
 */
export const onRequestGet = () =>
  new Response(null, {
    status: 301,
    headers: {
      Location: 'https://insureconnect.co.kr/sitemap.xml',
      'cache-control': 'public, max-age=86400',
    },
  });
