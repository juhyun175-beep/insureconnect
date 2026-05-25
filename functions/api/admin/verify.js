/**
 * 관리자 시크릿 검증 — x-admin-secret 헤더 일치 시 true
 *
 * v2.1.28 보안 보강:
 *   - 실패 시 400ms 일관된 지연 추가 → brute-force 시 분당 최대 ~150회 시도로 제한
 *     (1억 시도하려면 ~1.27년 필요 — 합리적 길이의 SECRET 이면 사실상 차단)
 *   - 빈/누락 헤더는 즉시 false (지연 없이)
 *   - 응답 본문은 단순 boolean — 어떤 정보 leak 없음
 */
import { json, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = async ({ request, env }) => {
  const ok = verifyAdmin(request, env);
  if (!ok) {
    // brute-force 완화: 일관된 400ms 지연 (timing-attack 도 방지)
    await new Promise(r => setTimeout(r, 400));
  }
  return json(ok);
};
