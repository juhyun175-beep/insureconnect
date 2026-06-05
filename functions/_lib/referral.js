/**
 * v2.8.0: 추천 초대 시스템
 *   - 회원별 초대코드(ic_invite_codes), 귀속(ic_referrals: invited_id UNIQUE → 1회만 집계)
 *   - 임계값 도달 시 자동 등급업 (어뷰징 가드: 본인 제외 · 1인 1회 · 등급 하향 없음 · admin 미변경)
 *   - ALTER 없이 신규 테이블만 사용
 */
import { ROLES, roleRank } from './auth.js';

// 유효 초대 수 → 목표 등급 임계값 (낮은→높은)
const THRESHOLDS = [
  { n: 3, role: 'certified' },
  { n: 10, role: 'premium' },
];

// v2.14.0: 양방향 포인트 보상 (신규유입 — 추천인·신규가입자 둘 다 이득 → 공유 동기)
const REFERRER_REWARD = 50; // 추천인
const WELCOME_REWARD = 30;  // 신규 가입자 웰컴

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외
function genCode() {
  const r = crypto.getRandomValues(new Uint8Array(7));
  return [...r].map(x => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

export async function ensureReferralTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_invite_codes (
       member_id INTEGER PRIMARY KEY,
       code TEXT UNIQUE NOT NULL,
       created_at TEXT DEFAULT (datetime('now'))
     )`
  ).run().catch(() => {});
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_referrals (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       referrer_id INTEGER NOT NULL,
       invited_id INTEGER UNIQUE NOT NULL,
       created_at TEXT DEFAULT (datetime('now'))
     )`
  ).run().catch(() => {});
}

export async function getOrCreateCode(env, memberId) {
  await ensureReferralTables(env);
  const ex = await env.DB.prepare(`SELECT code FROM ic_invite_codes WHERE member_id = ?`).bind(memberId).first();
  if (ex) return ex.code;
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    const r = await env.DB.prepare(`INSERT OR IGNORE INTO ic_invite_codes (member_id, code) VALUES (?, ?)`).bind(memberId, code).run();
    if (r?.meta?.changes > 0) return code;
    const again = await env.DB.prepare(`SELECT code FROM ic_invite_codes WHERE member_id = ?`).bind(memberId).first();
    if (again) return again.code; // 동시 생성됨
    // code UNIQUE 충돌 → 재시도
  }
  return 'M' + Number(memberId).toString(36).toUpperCase();
}

export async function resolveReferrer(env, code) {
  if (!code) return null;
  try {
    const r = await env.DB.prepare(`SELECT member_id FROM ic_invite_codes WHERE code = ?`).bind(String(code).slice(0, 32)).first();
    return r?.member_id || null;
  } catch (_) { return null; }
}

function targetRoleFor(count) {
  let role = null;
  for (const t of THRESHOLDS) if (count >= t.n) role = t.role;
  return role;
}

/** 귀속 기록 + 임계값 도달 시 추천인 자동 등급업. 신규 귀속이면 true */
export async function recordReferralAndMaybeUpgrade(env, referrerId, invitedId) {
  try {
    if (!referrerId || !invitedId || referrerId === invitedId) return false; // 본인 추천 차단
    await ensureReferralTables(env);
    const ins = await env.DB.prepare(
      `INSERT OR IGNORE INTO ic_referrals (referrer_id, invited_id) VALUES (?, ?)`
    ).bind(referrerId, invitedId).run();
    if (!(ins?.meta?.changes > 0)) return false; // 이미 귀속된 invited_id (1인 1회)

    // v2.14.0: 양방향 포인트 보상 — 추천인 +50P, 신규 가입자 웰컴 +30P (위 UNIQUE INSERT로 1회만 도달 → 중복 적립 없음)
    try {
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + ? WHERE id = ?`).bind(REFERRER_REWARD, referrerId).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, ?, 'referral_invite')`).bind(referrerId, REFERRER_REWARD).run();
      await env.DB.prepare(`UPDATE ic_members SET points = COALESCE(points,0) + ? WHERE id = ?`).bind(WELCOME_REWARD, invitedId).run();
      await env.DB.prepare(`INSERT INTO ic_point_log (member_id, delta, reason) VALUES (?, ?, 'referral_welcome')`).bind(invitedId, WELCOME_REWARD).run();
    } catch (_) {}

    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_referrals WHERE referrer_id = ?`).bind(referrerId).first();
    const count = c?.n || 0;
    const target = targetRoleFor(count);
    if (target) {
      const cur = await env.DB.prepare(`SELECT role FROM ic_members WHERE id = ?`).bind(referrerId).first();
      const curRole = cur?.role || 'member';
      // 상향만, admin 미변경
      if (curRole !== 'admin' && roleRank(target) > roleRank(curRole)) {
        await env.DB.prepare(`UPDATE ic_members SET role = ? WHERE id = ?`).bind(target, referrerId).run().catch(() => {});
      }
    }
    return true;
  } catch (_) { return false; }
}

export async function referralStats(env, memberId) {
  const code = await getOrCreateCode(env, memberId);
  let count = 0, role = 'member';
  try {
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_referrals WHERE referrer_id = ?`).bind(memberId).first();
    count = c?.n || 0;
  } catch (_) {}
  try {
    const m = await env.DB.prepare(`SELECT role FROM ic_members WHERE id = ?`).bind(memberId).first();
    role = m?.role || 'member';
  } catch (_) {}
  // 다음 등급까지 남은 초대 수
  let next = null;
  for (const t of THRESHOLDS) {
    if (count < t.n && roleRank(t.role) > roleRank(role)) { next = { role: t.role, need: t.n - count, at: t.n }; break; }
  }
  return { code, count, role, next, thresholds: THRESHOLDS };
}
