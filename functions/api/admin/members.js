/**
 * v2.4.0: 회원 관리 — /api/admin/members (admin)
 *   GET           : 회원 목록(+ 차단여부·접속중) + online_count
 *   POST          : { member_id, role }            → 등급 변경
 *                   { member_id, action:'ban' }    → 차단(세션 무효화)
 *                   { member_id, action:'unban' }  → 차단 해제
 *   DELETE ?member_id= : 계정 삭제(세션·차단기록·회원행 제거. 글은 닉네임 귀속이라 보존)
 *   v2.65.0: 차단/삭제/실시간 접속(last_seen) 운영 기능 추가. 관리자 계정은 차단·삭제 불가(안전).
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { ROLES } from '../../_lib/auth.js';
import { ensureModerationTables } from '../../_lib/moderation.js';

export const onRequestOptions = () => corsPreflight();

async function ensureMemberCols(env) {
  await env.DB.prepare(`ALTER TABLE ic_members ADD COLUMN last_seen TEXT`).run().catch(() => {});
}

async function roleOf(env, memberId) {
  const r = await env.DB.prepare(`SELECT role FROM ic_members WHERE id = ?`).bind(memberId).first().catch(() => null);
  return r?.role || null;
}

export const onRequestGet = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureModerationTables(env);
  await ensureMemberCols(env);
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  // v2.78.0: 페이지당 인원 선택(관리자 UI 10/20/50/100). 안전 범위 5~200, 기본 50.
  const per = Math.min(200, Math.max(5, parseInt(url.searchParams.get('per') || '50', 10)));
  // v2.103.0: 닉네임/#ID 검색 — 오픈채팅방순위 상위 회원 찾기용. q 있으면 WHERE 필터(SELECT·COUNT 동일 적용).
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  let where = '';
  const filterBinds = [];
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    if (/^#?\d+$/.test(q)) {
      where = `WHERE (m.nickname LIKE ? ESCAPE '\\' OR m.id = ?)`;
      filterBinds.push(like, parseInt(q.replace(/^#/, ''), 10));
    } else {
      where = `WHERE m.nickname LIKE ? ESCAPE '\\'`;
      filterBinds.push(like);
    }
  }
  const rs = await env.DB.prepare(
    `SELECT m.id, m.nickname, m.role, m.created_at, m.last_login, m.last_seen,
            CASE WHEN b.member_id IS NOT NULL THEN 1 ELSE 0 END AS banned,
            CASE WHEN m.last_seen IS NOT NULL AND m.last_seen > datetime('now','-5 minutes') THEN 1 ELSE 0 END AS online
       FROM ic_members m
       LEFT JOIN ic_banned_members b ON b.member_id = m.id
      ${where}
      ORDER BY m.id DESC LIMIT ? OFFSET ?`
  ).bind(...filterBinds, per, (page - 1) * per).all();
  const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ic_members m ${where}`).bind(...filterBinds).first();
  const online = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ic_members WHERE last_seen IS NOT NULL AND last_seen > datetime('now','-5 minutes')`
  ).first().catch(() => null);
  return json({ members: rs.results || [], total: c?.n || 0, page, per, q, online_count: online?.n || 0 });
});

export const onRequestPost = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  await ensureModerationTables(env);
  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const memberId = parseInt(body?.member_id, 10);
  if (!memberId) return error('member_id required');
  const action = String(body?.action || '');

  if (action === 'ban' || action === 'unban') {
    if (action === 'ban') {
      if ((await roleOf(env, memberId)) === 'admin') return error('관리자 계정은 차단할 수 없습니다. 먼저 등급을 낮춰주세요.');
      await env.DB.prepare(`INSERT OR IGNORE INTO ic_banned_members (member_id, reason) VALUES (?, ?)`)
        .bind(memberId, String(body?.reason || '운영자 차단').slice(0, 200)).run();
      await env.DB.prepare(`DELETE FROM ic_member_sessions WHERE user_id = ?`).bind(memberId).run().catch(() => {}); // 즉시 로그아웃
    } else {
      await env.DB.prepare(`DELETE FROM ic_banned_members WHERE member_id = ?`).bind(memberId).run();
    }
    return json({ ok: true, action, member_id: memberId });
  }

  // 기본: 등급 변경
  const role = String(body?.role || '');
  if (!ROLES.includes(role)) return error('invalid role');
  const r = await env.DB.prepare(`UPDATE ic_members SET role = ? WHERE id = ?`).bind(role, memberId).run();
  return json({ ok: true, changes: r?.meta?.changes ?? 0 });
});

export const onRequestDelete = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);
  const memberId = parseInt(url.searchParams.get('member_id') || '', 10);
  if (!memberId) return error('member_id required');
  if ((await roleOf(env, memberId)) === 'admin') return error('관리자 계정은 삭제할 수 없습니다. 먼저 등급을 낮춰주세요.');
  await env.DB.prepare(`DELETE FROM ic_member_sessions WHERE user_id = ?`).bind(memberId).run().catch(() => {});
  await env.DB.prepare(`DELETE FROM ic_banned_members WHERE member_id = ?`).bind(memberId).run().catch(() => {});
  const r = await env.DB.prepare(`DELETE FROM ic_members WHERE id = ?`).bind(memberId).run();
  return json({ ok: true, deleted: r?.meta?.changes ?? 0, member_id: memberId });
});
