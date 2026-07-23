/**
 * v2.137.0: 제휴 파트너 광고 카드 — 목록/등록
 *   GET  /api/partners?active=1  → 공개(활성·미삭제 카드, 공개 컬럼만, 최대 12개)
 *   GET  /api/partners           → 관리자 목록(미삭제 전체) · verifyAdmin 필수
 *   POST /api/partners           → 관리자 등록 · verifyAdmin 필수
 *
 *   인슈어커넥트는 광고 게재 매체다. 파트너명·계약 내용은 코드에 하드코딩하지 않는다.
 *   삭제는 소프트 삭제(deleted_at)이며 물리 삭제하지 않는다([id].js 참고).
 */
import { json, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { buildPartnerWrite } from '../../_lib/partners.js';

export const onRequestOptions = () => corsPreflight();

/**
 * v2.138.0: 파트너 성과 통계(관리자). ic_card_clicks_daily(menu='제휴파트너')의
 *   imp:{id} / click:{id} 카드키를 파싱해 파트너별 노출·클릭·CTR을 집계한다.
 *
 *   ※ 데이터 성격: 브라우저 viewability 기준 "운영 통계"다. 공개 추적 API 기반이라
 *      반복 새로고침·직접 POST·UA 위장을 막지 못하므로 감사 가능한 CPM 과금·정산
 *      데이터로 간주하지 않는다. 정식 광고비 산정 노출 기준은 네이버 서치어드바이저 등
 *      검색 노출이며, 자체 viewable 노출은 게재 활동 보고·내부 성과 비교용 보조 지표다.
 *      과금용 감사 데이터가 필요해지면 Origin/Referer 검증·이벤트 토큰·IP/세션 제한·
 *      이상 반복 필터를 후속으로 추가한다(이번 범위 아님).
 *
 *   완전성: 현재 등록된(미삭제) 모든 파트너를 0으로 먼저 초기화한 뒤 집계 병합한다.
 *   실적 0인 파트너도 행으로 반환. 삭제된 파트너의 잔여 집계는 name을 partner_id로
 *   대체해 별도 행으로 보존(집계 유실 금지). partner_id는 전 구간 문자열로 정규화.
 */
async function getPartnerStats(env, days) {
  const from = new Date(Date.now() + 9 * 3600 * 1000 - (days - 1) * 86400 * 1000).toISOString().slice(0, 10);
  const byId = new Map();
  const partners = await env.DB.prepare(
    `SELECT id, name FROM ic_partner_cards WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC`
  ).all().catch(() => ({ results: [] }));
  (partners.results || []).forEach((p) => {
    const pid = String(p.id);
    byId.set(pid, { partner_id: pid, name: p.name, impressions: 0, clicks: 0 });
  });
  const rs = await env.DB.prepare(
    `SELECT card, SUM(clicks) AS n FROM ic_card_clicks_daily
      WHERE menu = '제휴파트너' AND date >= ? GROUP BY card`
  ).bind(from).all().catch(() => ({ results: [] }));
  (rs.results || []).forEach((r) => {
    const m = String(r.card || '').match(/^(imp|click):(.+)$/);
    if (!m) return;
    const pid = String(m[2]);
    let row = byId.get(pid);
    if (!row) { row = { partner_id: pid, name: pid, impressions: 0, clicks: 0 }; byId.set(pid, row); }
    if (m[1] === 'imp') row.impressions += (r.n || 0);
    else row.clicks += (r.n || 0);
  });
  return Array.from(byId.values()).map((o) => ({
    partner_id: o.partner_id,
    name: o.name,
    impressions: o.impressions,
    clicks: o.clicks,
    ctr: o.impressions ? +((o.clicks / o.impressions) * 100).toFixed(1) : 0,
  })).sort((a, b) => (b.impressions - a.impressions) || (b.clicks - a.clicks));
}

export const onRequestGet = async ({ request, env }) => handle(async () => {
  const url = new URL(request.url);
  // 성과 통계(관리자) — active 판정보다 먼저 두어 stats=1 은 항상 인증 요구.
  if (url.searchParams.get('stats') === '1') {
    if (!verifyAdmin(request, env)) return unauthorized();
    const days = Math.max(7, Math.min(90, parseInt(url.searchParams.get('days'), 10) || 30));
    return json({ ok: true, days, stats: await getPartnerStats(env, days) });
  }
  // 공개 모드는 정확히 active=1 인 경우로만 제한한다.
  if (url.searchParams.get('active') === '1') {
    const rs = await env.DB.prepare(
      `SELECT id, name, tagline, category, href, img
         FROM ic_partner_cards
        WHERE is_active = 1 AND deleted_at IS NULL
        ORDER BY sort_order ASC, id ASC
        LIMIT 12`
    ).all();
    // v2.138.0: SEO 랜딩이 트래픽 대부분 — 매 방문 D1 조회는 낭비. 짧게 캐시(관리자 CRUD 후 수분 반영 지연 허용).
    return json(rs.results || [], 200, { 'Cache-Control': 'public, max-age=60, s-maxage=300' });
  }
  // active=1 이 아닌 모든 GET(빈 값·다른 값·미지정 포함)은 관리자 인증 필요.
  if (!verifyAdmin(request, env)) return unauthorized();
  const rs = await env.DB.prepare(
    `SELECT id, name, tagline, category, href, img, sort_order, is_active, created_at, updated_at
       FROM ic_partner_cards
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, id ASC`
  ).all();
  return json(rs.results || []);
});

export const onRequestPost = async ({ request, env }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }
  const built = buildPartnerWrite(body, { partial: false });
  if (built.error) return json({ error: built.error }, 400);
  const cols = built.columns;
  const placeholders = cols.map(() => '?').join(', ');
  const row = await env.DB.prepare(
    `INSERT INTO ic_partner_cards (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`
  ).bind(...built.values).first();
  return json({ id: row.id });
});
