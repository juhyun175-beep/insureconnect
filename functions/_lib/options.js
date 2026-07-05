/**
 * v2.107.0: 공고 등록 유료 애드온 옵션 — 매출 업셀 (GROWTH: 도달 보장형 상품)
 *   등록 결제 스텝에서 체크박스로 선택 → 등록비에 합산 → ad_orders.final_price 에 포함.
 *   가격은 코드 고정(서버 권위 — 클라 전달값은 key 배열뿐, coupons.js COUPON_CATALOG 패턴).
 *
 *   상품 설계 근거(2026-07-05 리스트업 검증): 소규모 커뮤니티에서 '노출량 판매'는 안 팔림 —
 *   '회원에게 직접 도달시켜 모집 성공 확률을 올리는 것'만 생존. 도입가로 시작해 실측 후 조정.
 *
 *   이행(fulfillment)은 관리자 수동: 승인 시 카톡 브로드캐스트(admin/kakao-broadcast) 발송,
 *   홈배너는 up-homead 캠페인 등록(7일 스케줄, 'AD' 라벨·자동팝업 제외 권장). 관리자 주문표에 옵션 표시됨.
 */

export const OPTION_CATALOG = {
  kakao_blast: {
    label: '카카오톡 전 회원 알림 1회',
    price: 29000,
    types: ['recruit', 'lecture', 'meetup'],
  },
  home_banner7: {
    label: '홈 배너 노출 7일',
    price: 19000,
    types: ['recruit', 'lecture', 'meetup'],
  },
};

/** 클라 전달 key 배열 검증 — 유효 key 만 남기고 서버 가격으로 합산. 중복 제거. */
export function validateOptions(adType, keys) {
  const out = [];
  let total = 0;
  if (Array.isArray(keys)) {
    for (const k of keys) {
      const key = String(k || '');
      const item = OPTION_CATALOG[key];
      if (!item || out.includes(key)) continue;
      if (!item.types.includes(adType)) continue;
      out.push(key);
      total += item.price;
    }
  }
  return { keys: out, total };
}

/** ad_orders 옵션 컬럼 보장(추가형 ALTER, 이미 있으면 무시). */
export async function ensureOrderOptionCols(env) {
  for (const s of [
    `ALTER TABLE ad_orders ADD COLUMN options_json TEXT`,
    `ALTER TABLE ad_orders ADD COLUMN options_price INTEGER NOT NULL DEFAULT 0`,
  ]) await env.DB.prepare(s).run().catch(() => {});
}
