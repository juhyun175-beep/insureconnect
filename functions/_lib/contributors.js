import { normalizeDisease } from './cases-seo.js';

export function mask(name) {
  const chars = Array.from(String(name || '').trim());
  if (!chars.length) return '회원';
  return chars[0] + '●'.repeat(Math.min(Math.max(chars.length - 1, 1), 3));
}

export async function loadCaseContributors(env, disease = null, limit = 5) {
  const where = ["c.verify_status = 'approved'", 'c.submitter_id IS NOT NULL'];
  const binds = [];
  const normalized = disease == null ? '' : normalizeDisease(disease);
  if (normalized) {
    where.push("TRIM(COALESCE(c.disease,'')) = ?");
    binds.push(normalized);
  }
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 5));
  try {
    const rs = await env.DB.prepare(
      `SELECT c.submitter_id AS id, m.nickname AS nickname, m.role AS role, COUNT(*) AS n
       FROM ic_insurance_cases c LEFT JOIN ic_members m ON m.id = c.submitter_id
       WHERE ${where.join(' AND ')}
       GROUP BY c.submitter_id ORDER BY n DESC, c.submitter_id ASC LIMIT ?`
    ).bind(...binds, boundedLimit).all();
    return rs.results || [];
  } catch (_) {
    return [];
  }
}
