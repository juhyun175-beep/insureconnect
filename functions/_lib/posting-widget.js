import { getPromoRemaining } from './promo.js';

const CACHE_URL = 'https://insureconnect.co.kr/__cache/posting-widget-v2';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const BOOST_ALTERS = [
  'ALTER TABLE ic_recruitments ADD COLUMN seo_boost_until TEXT',
  'ALTER TABLE ic_lectures ADD COLUMN seo_boost_until TEXT',
  'ALTER TABLE ic_meetings ADD COLUMN seo_boost_until TEXT',
];

export async function ensureBoostCols(env) {
  for (const sql of BOOST_ALTERS) {
    await env.DB.prepare(sql).run().catch(() => {});
  }
}

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function trackAttrs(type, id, placement = 'widget') {
  const name = `seo_${placement}_${type}_${id}`;
  return `onclick="try{navigator.sendBeacon('/api/track/link-click',new Blob([JSON.stringify({company_type:'seo_widget_click',company_name:'${name}'})],{type:'application/json'}));}catch(_){}"`;
}

function detailPath(type, id) {
  return type === 'meetup' ? `/og/meetup/${esc(id)}` : `/og/${type}/${esc(id)}`;
}

function promoCta(promo, full = true) {
  const remaining = promo && promo.enabled ? Math.max(0, Number(promo.remaining || 0)) : 0;
  if (remaining <= 0) return full ? '＋ 내 공고 등록하기' : '내 공고 등록하기';
  return full
    ? `＋ 내 공고도 여기에 노출 — 등록비 0원 (선착순 ${remaining}건 남음)`
    : `등록비 0원 · 선착순 ${remaining}건`;
}

function renderRail(items, promo) {
  if (!items.length) return '';
  const itemHtml = items.slice(0, 2).map((it) => `
    <a class="spw-rail-item" href="${detailPath(it.type, it.id)}" ${trackAttrs(it.type, it.id, 'rail')}>
      <span class="spw-type">${esc(it.icon)} ${esc(it.label)}</span>
      <span class="spw-main">
        <strong>${esc(it.title)}</strong>
        ${it.sub ? `<small>${esc(it.sub)}</small>` : ''}
      </span>
      ${it.boosted ? '<span class="spw-pick">PICK</span>' : ''}
    </a>`).join('');
  return `
<aside class="spw-rail" aria-label="공고 미리보기">
  <button class="spw-rail-close" type="button" aria-label="공고 미리보기 닫기" onclick="try{sessionStorage.setItem('spw_rail_hide','1');this.closest('.spw-rail').style.display='none';}catch(_){this.closest('.spw-rail').style.display='none';}">✕</button>
  <div class="spw-rail-title">📌 공고 미리보기</div>
  <div class="spw-rail-list">${itemHtml}</div>
  <a class="spw-rail-cta" href="/?post=recruit">${esc(promoCta(promo, false))}</a>
</aside>
<script>(function(){try{if(sessionStorage.getItem('spw_rail_hide')==='1'){var r=document.querySelector('.spw-rail');if(r)r.style.display='none';}}catch(_){}})();</script>`;
}

function renderWidget(items, promo) {
  const itemHtml = items.map((it) => `
    <a class="spw-item" href="${detailPath(it.type, it.id)}" ${trackAttrs(it.type, it.id)}>
      <span class="spw-type">${esc(it.icon)} ${esc(it.label)}</span>
      <span class="spw-main">
        <strong>${esc(it.title)}</strong>
        ${it.sub ? `<small>${esc(it.sub)}</small>` : ''}
      </span>
      ${it.boosted ? '<span class="spw-pick">PICK</span>' : ''}
    </a>`).join('');

  return `
<!-- __cache/posting-widget-v2 -->
<style>
.seo-posting-widget{max-width:760px;margin:0 auto 16px;padding:0 16px}
.spw-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;box-shadow:0 2px 8px rgba(0,0,0,.035)}
.spw-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.spw-title{font-size:15.5px;font-weight:900;color:#0f172a;letter-spacing:-.01em}
.spw-list{display:grid;gap:8px}
.spw-item{display:flex;align-items:center;gap:10px;text-decoration:none;color:#0f172a;border:1px solid #eef2f7;border-radius:10px;padding:10px 11px;background:#fbfdff;transition:border-color .15s,background .15s,transform .15s}
.spw-item:hover{border-color:#bfdbfe;background:#eff6ff;transform:translateY(-1px)}
.spw-type{flex:0 0 auto;font-size:12px;font-weight:800;color:#1a3de8;background:#eef2ff;border-radius:999px;padding:3px 8px;white-space:nowrap}
.spw-main{min-width:0;display:flex;flex-direction:column;gap:1px;flex:1}
.spw-main strong{font-size:13.5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spw-main small{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spw-pick{font-size:10px;font-weight:900;color:#fff;background:#ef4444;border-radius:5px;padding:2px 6px;letter-spacing:.04em}
.spw-empty{font-size:13px;color:#64748b;line-height:1.55;margin:4px 0 10px}
.spw-cta{display:block;margin-top:10px;text-align:center;text-decoration:none;font-size:13.5px;font-weight:900;color:#1a3de8;background:#eef2ff;border:1px solid #dbeafe;border-radius:10px;padding:10px 12px}
.spw-rail{position:fixed;right:20px;top:120px;width:230px;z-index:30;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 13px 13px;box-shadow:0 8px 22px rgba(15,23,42,.08)}
.spw-rail-close{position:absolute;right:8px;top:8px;width:24px;height:24px;border:0;background:#f1f5f9;color:#64748b;border-radius:999px;font-size:13px;font-weight:900;line-height:24px;cursor:pointer}
.spw-rail-title{font-size:13.5px;font-weight:900;color:#0f172a;margin:2px 28px 10px 1px}
.spw-rail-list{display:grid;gap:8px}
.spw-rail-item{display:block;text-decoration:none;color:#0f172a;border:1px solid #eef2f7;border-radius:10px;padding:9px 10px;background:#fbfdff;transition:border-color .15s,background .15s,transform .15s}
.spw-rail-item:hover{border-color:#bfdbfe;background:#eff6ff;transform:translateY(-1px)}
.spw-rail-item .spw-type{display:inline-flex;margin-bottom:6px}
.spw-rail-item .spw-main{display:block}
.spw-rail-item .spw-main strong{display:block;font-size:12.5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spw-rail-item .spw-main small{display:block;font-size:11.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.spw-rail-item .spw-pick{display:inline-block;margin-top:6px}
.spw-rail-cta{display:block;margin-top:10px;text-align:center;text-decoration:none;font-size:12.5px;font-weight:900;color:#1a3de8;background:#eef2ff;border:1px solid #dbeafe;border-radius:10px;padding:9px 8px}
@media(max-width:1279px){.spw-rail{display:none}}
@media(max-width:640px){.seo-posting-widget{padding:0 16px}.spw-item{align-items:flex-start}.spw-type{margin-top:1px}.spw-main strong{white-space:normal}}
</style>
<section class="seo-posting-widget" aria-label="지금 올라온 공고">
  <div class="spw-card">
    <div class="spw-head"><div class="spw-title">📌 지금 올라온 공고</div></div>
    ${items.length ? `<div class="spw-list">${itemHtml}</div>` : '<p class="spw-empty">아직 노출할 승인 공고가 없습니다. 첫 공고를 등록하고 SEO 페이지 하단 노출을 시작해보세요.</p>'}
    <a class="spw-cta" href="/?post=recruit">${esc(promoCta(promo, true))}</a>
  </div>
</section>${renderRail(items, promo)}`;
}

async function loadRows(env) {
  const queries = [
    ['recruit', '채용', '💼', `SELECT id, title, company_name AS sub, created_at, seo_boost_until
       FROM ic_recruitments WHERE status='approved' ORDER BY created_at DESC LIMIT 8`],
    ['lecture', '강의', '🎓', `SELECT id, title, instructor AS sub, created_at, seo_boost_until
       FROM ic_lectures WHERE status='approved' ORDER BY created_at DESC LIMIT 8`],
    ['meetup', '모임', '🤝', `SELECT id, title, host AS sub, created_at, seo_boost_until
       FROM ic_meetings WHERE status='approved' ORDER BY created_at DESC LIMIT 8`],
  ];
  const groups = await Promise.all(queries.map(([type, label, icon, sql]) =>
    env.DB.prepare(sql).all()
      .catch(() => ({ results: [] }))
      .then((rs) => (rs.results || []).map((row) => ({ ...row, type, label, icon }))),
  ));
  return groups.flat();
}

function pickItems(rows) {
  const now = Date.now();
  const boosted = rows
    .filter((row) => row.seo_boost_until && Date.parse(row.seo_boost_until) > now)
    .sort((a, b) => Date.parse(a.seo_boost_until) - Date.parse(b.seo_boost_until))
    .slice(0, 2)
    .map((row) => ({ ...row, boosted: true }));
  const used = new Set(boosted.map((row) => `${row.type}:${row.id}`));
  const rest = shuffle(rows.filter((row) => !used.has(`${row.type}:${row.id}`)));
  return [...boosted, ...rest].slice(0, 3);
}

async function collectPostings(env) {
  await ensureBoostCols(env);
  const rows = await loadRows(env);
  return pickItems(rows);
}

export async function seoPostingWidget(env) {
  try {
    const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
    const cacheKey = new Request(CACHE_URL);
    if (cache) {
      const hit = await cache.match(cacheKey).catch(() => null);
      if (hit) return await hit.text();
    }

    const items = await collectPostings(env);
    const promo = await getPromoRemaining(env).catch(() => ({ enabled: false, remaining: 0, limit: 0 }));
    const html = renderWidget(items, promo);

    if (cache) {
      const res = new Response(html, { headers: { 'Cache-Control': 's-maxage=60' } });
      await cache.put(cacheKey, res).catch(() => {});
    }
    return html;
  } catch (_) {
    return '';
  }
}
