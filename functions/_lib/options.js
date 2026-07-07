/**
 * v2.107.0: 공고 등록 유료 애드온 옵션 — 매출 업셀 (GROWTH: 도달 보장형 상품)
 *   등록 결제 스텝에서 체크박스로 선택 → 등록비에 합산 → ad_orders.final_price 에 포함.
 *   가격은 코드 고정(서버 권위 — 클라 전달값은 key 배열뿐, coupons.js COUPON_CATALOG 패턴).
 *
 *   상품 설계 근거(2026-07-05 리스트업 검증): 소규모 커뮤니티에서 '노출량 판매'는 안 팔림 —
 *   '회원에게 직접 도달시켜 모집 성공 확률을 올리는 것'만 생존. 도입가로 시작해 실측 후 조정.
 *
 *   이행(fulfillment): featured_listing/dm_inquiry/kakao_blast/home_banner7 는 승인 시 자동 이행.
 *   open_chat_promo 는 운영자가 등록자와 직접 대화로 안내하는 수동 이행으로 표시됨.
 *   일수형 옵션은 { key, days } 형태도 허용하며 서버가 단가*일수로만 계산한다.
 */

export const OPTION_CATALOG = {
  featured_listing: {
    label: '추천공고 등록',
    price: 18000,
    types: ['recruit', 'lecture', 'meetup'],
  },
  dm_inquiry: {
    label: '1:1 문의 기능',
    price: 20000,
    types: ['recruit', 'lecture', 'meetup'],
  },
  kakao_blast: {
    label: '카카오톡 전 회원 알림 1회',
    price: 29000,
    types: ['recruit', 'lecture', 'meetup'],
  },
  open_chat_promo: {
    label: '오픈채팅방 홍보',
    price: 280000,
    pricing: 'daily',
    min_days: 1,
    max_days: 30,
    types: ['recruit', 'lecture', 'meetup'],
  },
  home_banner7: {
    label: '홈 배너 노출 7일',
    price: 300000,
    types: ['recruit', 'lecture', 'meetup'],
  },
};

function optionKey(raw) {
  if (raw && typeof raw === 'object') return String(raw.key || raw.id || raw.option || '');
  return String(raw || '');
}

function optionDays(raw, item) {
  const n = raw && typeof raw === 'object'
    ? parseInt(raw.days ?? raw.quantity ?? raw.qty ?? raw.count, 10)
    : item.min_days;
  const min = item.min_days || 1;
  const max = item.max_days || 30;
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

/** 클라 전달 옵션 배열 검증 — 유효 옵션만 남기고 서버 가격으로 합산. 중복 제거. */
export function validateOptions(adType, keys) {
  const out = [];
  const optionKeys = [];
  let total = 0;
  if (Array.isArray(keys)) {
    for (const raw of keys) {
      const key = optionKey(raw);
      const item = OPTION_CATALOG[key];
      if (!item || optionKeys.includes(key)) continue;
      if (!item.types.includes(adType)) continue;
      optionKeys.push(key);
      if (item.pricing === 'daily') {
        const days = optionDays(raw, item);
        out.push({ key, days });
        total += item.price * days;
      } else {
        out.push(key);
        total += item.price;
      }
    }
  }
  return { keys: out, optionKeys, total };
}

/** ad_orders 옵션 컬럼 보장(추가형 ALTER, 이미 있으면 무시). */
export async function ensureOrderOptionCols(env) {
  for (const s of [
    `ALTER TABLE ad_orders ADD COLUMN options_json TEXT`,
    `ALTER TABLE ad_orders ADD COLUMN options_price INTEGER NOT NULL DEFAULT 0`,
  ]) await env.DB.prepare(s).run().catch(() => {});
}
