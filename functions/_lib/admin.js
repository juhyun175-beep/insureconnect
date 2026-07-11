/**
 * 관리자 시크릿 검증 — x-admin-secret 헤더 vs ADMIN_SECRET 환경변수
 *
 * Workers Pages에서 환경변수 등록:
 *   npx wrangler pages secret put ADMIN_SECRET --project-name=insureconnect-hub
 *
 * v2.1.28 보안 보강:
 *   - 문자열 비교를 길이/문자별 변동 시간으로 분기하지 않도록 constant-time 으로 변경
 *     (`===` 는 일부 엔진에서 차이 발견 시 조기 종료 가능 → timing-attack 표면)
 */

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function verifyAdmin(request, env) {
  if (!env.ADMIN_SECRET) return false;
  const secret = request.headers.get('x-admin-secret') || '';
  if (!secret) return false;
  return constantTimeEqual(secret, env.ADMIN_SECRET);
}

/** 401 응답 헬퍼 */
export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
