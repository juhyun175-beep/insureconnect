/**
 * v2.7.2: 자유게시판 모더레이션
 *   - 욕설/비속어 필터 + 스팸 휴리스틱
 *   - 차단 회원(ic_banned_members) / 신고(ic_board_reports) — ALTER 없이 신규 테이블만 사용
 */

// 흔한 한글/영문 비속어 (부분일치, 공백 제거 후 검사)
const BAD_WORDS = [
  '시발', '씨발', '시바', '씨바', '시발년', '씨발놈', '병신', '븅신', '지랄', '지랄남',
  '개새', '개색', '새끼', '쌍놈', '쌍년', '좆', '존나', '존만', '니미', '느금', '느개비',
  '엠창', '애미', '애비', '보지', '자지', '썅', '창녀', '걸레', '꺼져', '닥쳐', '대가리',
  'fuck', 'fuckyou', 'shit', 'bitch', 'asshole', 'dick', 'pussy',
];

/** 비속어 포함 시 해당 단어 반환, 없으면 null */
export function findProfanity(text) {
  const norm = String(text || '').toLowerCase().replace(/[\s​._\-*]+/g, '');
  for (const w of BAD_WORDS) {
    if (norm.includes(w)) return w;
  }
  return null;
}

/** 스팸 휴리스틱 (링크 도배 / 같은 문자 과다 반복) */
export function isSpammy(text) {
  const t = String(text || '');
  const urls = (t.match(/https?:\/\//gi) || []).length;
  if (urls >= 5) return true;
  if (/(.)\1{24,}/.test(t)) return true;
  return false;
}

/** 모더레이션 테이블 보장 (idempotent) */
export async function ensureModerationTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_banned_members (
       member_id INTEGER PRIMARY KEY,
       reason TEXT,
       created_at TEXT DEFAULT (datetime('now'))
     )`
  ).run().catch(() => {});
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ic_board_reports (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       target_type TEXT NOT NULL,
       target_id INTEGER NOT NULL,
       post_id INTEGER,
       reporter_id INTEGER,
       reporter_nick TEXT,
       reason TEXT,
       status TEXT DEFAULT 'pending',
       created_at TEXT DEFAULT (datetime('now'))
     )`
  ).run().catch(() => {});
}

/** 차단 회원 여부 (테이블 없으면 false — fail-open) */
export async function isBanned(env, memberId) {
  if (!memberId) return false;
  try {
    const r = await env.DB.prepare(`SELECT 1 FROM ic_banned_members WHERE member_id = ?`).bind(memberId).first();
    return !!r;
  } catch (_) {
    return false;
  }
}
