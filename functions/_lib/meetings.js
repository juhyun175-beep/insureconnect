/**
 * v2.57.0: 모임공고(오프라인 모임·세미나·스터디) — 신규 공고타입.
 *   채용(ic_recruitments)·강의(ic_lectures) 패턴을 그대로 따르되, 모임 고유 필드(host/location/event_at) 추가.
 *   테이블은 런타임 lazy 생성(CREATE IF NOT EXISTS) — 별도 마이그레이션 실행 없이 안전하게 추가.
 *   등록가·쿠폰 컬럼(price/coupon_id/coupon_rate)을 스키마에 내장 → ensurePostingCouponCols 의존 없이 동작.
 */

/** 모임공고 테이블 보장(추가형 — 기존 테이블 무관, 새 테이블만 생성). */
export async function ensureMeetingsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_meetings (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT NOT NULL,
       host TEXT,
       description TEXT,
       location TEXT,
       event_at TEXT,
       file_url TEXT,
       file_type TEXT,
       form_url TEXT,
       status TEXT NOT NULL DEFAULT 'pending',
       submitter_name TEXT,
       submitter_contact TEXT,
       submitter_id INTEGER,
       reject_reason TEXT,
       approved_at TEXT,
       featured_until TEXT,
       price INTEGER,
       coupon_id INTEGER,
       coupon_rate INTEGER,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT
     )`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_meetings_status ON ic_meetings(status, featured_until)`
  ).run().catch(() => {});
}
