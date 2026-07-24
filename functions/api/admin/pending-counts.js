import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';

export const onRequestOptions = () => corsPreflight();

/**
 * 관리자 승인대기 경량 집계.
 *
 * 상세 공고·신청자 개인정보·주문/동의 데이터는 반환하지 않는다. 관리자
 * 대시보드의 주기 갱신은 이 엔드포인트만 사용하고, 상세 목록은 탭 진입
 * 또는 승인/반려 후에 기존 공고 API에서 별도로 불러온다.
 */
export const onRequestGet = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();

  const row = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM ic_recruitments WHERE status = 'pending') AS recruitments,
      (SELECT COUNT(*) FROM ic_lectures WHERE status = 'pending') AS lectures,
      (SELECT COUNT(*) FROM ic_meetings WHERE status = 'pending') AS meetings
  `).first();

  const recruitments = Number(row?.recruitments || 0);
  const lectures = Number(row?.lectures || 0);
  const meetings = Number(row?.meetings || 0);

  return json({
    ok: true,
    recruitments,
    lectures,
    meetings,
    total: recruitments + lectures + meetings,
  });
});
