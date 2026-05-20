/**
 * 관리자 시크릿 검증 — x-admin-secret 헤더 vs ADMIN_SECRET 환경변수
 *
 * Workers Pages에서 환경변수 등록:
 *   npx wrangler pages secret put ADMIN_SECRET --project-name=insureconnect-hub
 */
export function verifyAdmin(request, env) {
  const secret = request.headers.get('x-admin-secret') || '';
  return !!env.ADMIN_SECRET && secret === env.ADMIN_SECRET;
}

/** 401 응답 헬퍼 */
export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
