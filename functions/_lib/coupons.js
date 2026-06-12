/**
 * v2.51.0: 공고 등록 할인권(쿠폰) — 수익화 확장.
 *   포인트 → 할인권(쿠폰) → 공고 등록 할인. 기존 포인트 시스템(ic_members.points, ic_point_log)을
 *   그대로 사용하며 새 포인트를 만들지 않는다. 직접 포인트 결제는 없고, 항상 쿠폰을 거친다.
 *
 *   가격/할인율/포인트가는 코드 고정(서버 권위 — 클라 입력 신뢰 금지, redeem.js ITEMS 패턴 동일).
 *   final = 등록가 × (1 - 할인율).  하한 로직 없음(스펙 명시).
 */

export const COUPON_TTL_DAYS = 14;

// 공고 등록가 (원). 모임은 운영부담 최고가.
export const AD_BASE = { recruit: 59000, lecture: 99000, meetup: 149000 };
export const AD_LABEL = { recruit: '채용공고', lecture: '강의공고', meetup: '모임공고' };
export const AD_MAX_RATE = { recruit: 15, lecture: 35, meetup: 49 };

// 코드 고정 카탈로그(상점 상품). 클라가 보내는 건 key 뿐 — 서버가 ad_type/rate/cost를 해석.
export const COUPON_CATALOG = {
  rc10: { ad_type: 'recruit', rate: 10, cost: 100 },
  rc15: { ad_type: 'recruit', rate: 15, cost: 180 },
  lc10: { ad_type: 'lecture', rate: 10, cost: 180 },
  lc25: { ad_type: 'lecture', rate: 25, cost: 350 },
  lc35: { ad_type: 'lecture', rate: 35, cost: 500 },
  mt10: { ad_type: 'meetup', rate: 10, cost: 300 },
  mt20: { ad_type: 'meetup', rate: 20, cost: 500 },
  mt30: { ad_type: 'meetup', rate: 30, cost: 800 },
  mt49: { ad_type: 'meetup', rate: 49, cost: 1500 },
};

/** 등록가 × (1-할인율). 정수(원). 하한 없음. */
export function finalPrice(adType, rate) {
  const base = AD_BASE[adType] || 0;
  return Math.round(base * (100 - (Number(rate) || 0)) / 100);
}

/** 테이블 보장(런타임 lazy — referral.js ensureReferralTables 패턴). 추가형 CREATE/INSERT만. */
export async function ensureCouponTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coupon_templates (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       coupon_type TEXT NOT NULL UNIQUE,
       ad_type TEXT NOT NULL,
       discount_rate INTEGER NOT NULL,
       point_cost INTEGER NOT NULL,
       label TEXT,
       status TEXT NOT NULL DEFAULT 'active',
       expires_at TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       used_at TEXT
     )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_coupons (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       member_id INTEGER NOT NULL,
       coupon_type TEXT NOT NULL,
       ad_type TEXT NOT NULL,
       discount_rate INTEGER NOT NULL,
       point_cost INTEGER NOT NULL,
       status TEXT NOT NULL DEFAULT 'active',
       expires_at TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       used_at TEXT,
       used_ad_type TEXT,
       used_ad_id INTEGER
     )`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_coupons_member ON user_coupons(member_id, status)`).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coupon_logs (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       member_id INTEGER,
       coupon_id INTEGER,
       coupon_type TEXT,
       ad_type TEXT,
       discount_rate INTEGER,
       point_cost INTEGER,
       action TEXT NOT NULL,
       status TEXT,
       expires_at TEXT,
       used_at TEXT,
       meta TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
  // 템플릿 시드(비었을 때만) — 관리자 조회/통계용 기록. 구매 권위는 코드 카탈로그.
  try {
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM coupon_templates`).first();
    if ((c?.n || 0) === 0) {
      for (const [key, v] of Object.entries(COUPON_CATALOG)) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO coupon_templates (coupon_type, ad_type, discount_rate, point_cost, label) VALUES (?, ?, ?, ?, ?)`
        ).bind(key, v.ad_type, v.rate, v.cost, `${AD_LABEL[v.ad_type]} ${v.rate}% 할인권`).run();
      }
    }
  } catch (_) {}
}

/** 만료 처리(lazy) — active인데 기한 지난 쿠폰을 expired로. */
export async function expireStale(env, memberId) {
  try {
    await env.DB.prepare(
      `UPDATE user_coupons SET status='expired' WHERE member_id=? AND status='active' AND expires_at < datetime('now')`
    ).bind(memberId).run();
  } catch (_) {}
}
