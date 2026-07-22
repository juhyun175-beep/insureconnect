import { seoCtaFooter } from './seo-cta.js';

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ld = (value) => `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;

// Keep this source aligned with the verified company detail page.
const STYLE = `*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1a202c;background:#f9fafb;line-height:1.7;margin:0;padding:0}
.crumb{font-size:13px;color:#6b7280;padding:16px 20px;max-width:760px;margin:0 auto}.crumb a{color:#1a3de8;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:0 16px}
header.c-head{background:#fff;border-radius:14px;padding:28px 26px;box-shadow:0 4px 16px rgba(0,0,0,0.04);margin-bottom:16px}
header.c-head .badge{display:inline-block;background:#eff6ff;color:#1a3de8;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:10px}
header.c-head h1{margin:0 0 6px;font-size:26px;color:#0f172a;letter-spacing:-0.02em}
header.c-head p{margin:0;color:#6b7280;font-size:14px}
.cta-erp{display:block;text-align:center;background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px;border-radius:12px;margin:16px 0}
.card{background:#fff;border-radius:14px;padding:22px 24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:16px}
.card h2{margin:0 0 12px;font-size:18px;color:#0f172a}
table.info{width:100%;border-collapse:collapse}
table.info th{text-align:left;width:120px;color:#6b7280;font-weight:600;padding:9px 0;vertical-align:top;font-size:14px}
table.info td{padding:9px 0;color:#1f2937;font-weight:600;border-bottom:1px solid #f1f5f9}
table.info a{color:#1a3de8;text-decoration:none}
.cf-list{list-style:none;padding:0;margin:0}
.cf-list li{padding:11px 0;border-bottom:1px solid #f1f5f9}
.cf-list a{color:#1a3de8;text-decoration:none;font-weight:700;display:flex;align-items:center;gap:8px}
.cf-ft{font-size:10.5px;font-weight:800;color:#fff;background:#ef4444;padding:2px 7px;border-radius:5px}
.btn-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.btn-row a{display:inline-block;background:#eff6ff;color:#1a3de8;text-decoration:none;font-weight:700;font-size:14px;padding:9px 16px;border-radius:9px}
.faq dl{margin:0 0 12px}.faq dt{font-weight:700;color:#1e3a8a;margin-bottom:4px}.faq dd{margin:0;color:#374151}
.rel ul{list-style:none;padding:0;margin:0}.rel li{padding:9px 0;border-bottom:1px solid #f1f5f9}.rel a{color:#1a3de8;text-decoration:none;font-weight:600}
.coverage-table-wrap{overflow-x:auto}.coverage-table{width:100%;min-width:620px;border-collapse:collapse;font-size:13px}.coverage-table th{padding:9px 8px;text-align:left;color:#475569;background:#f8fafc;border-bottom:1px solid #e2e8f0}.coverage-table td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.coverage-table td:nth-child(3){color:#1a3de8;font-weight:700}
.case-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.case-card{border:1px solid #e2e8f0;border-radius:11px;padding:14px;background:#f8fafc}.case-card-head{display:flex;align-items:center;gap:8px;margin-bottom:7px}.case-badge{display:inline-block;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:11px;font-weight:800;padding:2px 8px}.case-card p{margin:5px 0;color:#475569;font-size:13px;line-height:1.55}.case-card b{color:#1e293b}.case-profile,.case-reliability{color:#64748b!important;font-size:11.5px!important}.case-reliability{display:block;margin-top:8px}
.note{font-size:12px;color:#9ca3af;margin-top:8px}
@media(max-width:640px){header.c-head,.card{border-radius:0}.wrap{padding:0}.crumb{padding:12px 16px}.case-grid{grid-template-columns:1fr}}`;

export function shellStyle() {
  return STYLE;
}

function renderBreadcrumb(breadcrumb) {
  if (!Array.isArray(breadcrumb) || !breadcrumb.length) return '';
  return `<nav class="crumb" aria-label="breadcrumb">${breadcrumb.map((item, index) => {
    const label = esc(item?.label);
    if (index === breadcrumb.length - 1 || !item?.href) return `<span>${label}</span>`;
    return `<a href="${esc(item.href)}">${label}</a>`;
  }).join(' &raquo; ')}</nav>`;
}

export function renderPage({
  title,
  description = '',
  robots = 'index,follow',
  canonical = '',
  jsonLd = [],
  breadcrumb = [],
  bodyHtml = '',
  headerHtml = '',
  site,
} = {}) {
  const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  const noindex = String(robots).toLowerCase().includes('noindex');
  const canonicalHtml = canonical && !noindex
    ? `<link rel="canonical" href="${esc(canonical)}">`
    : '';
  const jsonLdHtml = blocks.filter(Boolean).map(ld).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${esc(robots)}">
${canonicalHtml}
${jsonLdHtml}
<style>${shellStyle()}</style>
</head>
<body>
${renderBreadcrumb(breadcrumb)}
<main class="wrap">
<header class="c-head"><a href="/" aria-label="InsureConnect 홈">InsureConnect</a>${headerHtml}</header>
${bodyHtml}
</main>
${seoCtaFooter(site)}
</body>
</html>`;
}
