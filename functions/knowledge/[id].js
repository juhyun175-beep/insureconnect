/* v2.139.0: 옛 수파베이스 의존 제거 — 프로젝트 폐기로 전 ID HTTP 500이었다.
   데이터 원본은 D1 ic_knowledge_posts(관리자 업로드·OG·목록과 동일 소스). */

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function splitTableCells(raw) {
  const cells = [];
  let cur = '';
  let escaped = false;
  for (const ch of String(raw || '')) {
    if (escaped) {
      if (ch === 'n') cur += '\n';
      else if (ch === ',' || ch === '[' || ch === ']' || ch === '\\') cur += ch;
      else cur += ch;
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (escaped) cur += '\\';
  cells.push(cur);
  return cells;
}

function normalizeTableLines(lines) {
  const normalized = [];
  const isControl = line => line.startsWith('rows=') || line.startsWith('style:') || line.startsWith('merge:');
  const isRow = line => /^[HD],/.test(line);
  for (const line of lines) {
    if (isControl(line) || isRow(line)) {
      normalized.push(line);
      continue;
    }
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (isRow(normalized[i])) {
        normalized[i] += '\n' + line;
        break;
      }
    }
  }
  return normalized;
}

function renderTableBlock(lines) {
  const mergeMap = {};
  const styleMap = {};
  const dataLines = [];

  for (const line of normalizeTableLines(lines)) {
    if (line.startsWith('rows=')) continue;
    if (line.startsWith('style:')) {
      const m = line.match(/^style:(\d+)-(\d+)=(.+)$/);
      if (m) {
        const key = `${m[1]}-${m[2]}`;
        const obj = {};
        m[3].split(';').forEach(p => {
          const [k, v] = p.split(':');
          if (k === 'bg') obj.bg = v;
          if (k === 'align') obj.align = v;
        });
        styleMap[key] = obj;
      }
      continue;
    }
    if (line.startsWith('merge:')) {
      const m = line.match(/^merge:(\d+)-(\d+)=(.+)$/);
      if (m) {
        const key = `${m[1]}-${m[2]}`;
        const obj = {};
        m[3].split(';').forEach(p => {
          const [k, v] = p.split(':');
          if (k === 'colspan') obj.colspan = parseInt(v);
          if (k === 'rowspan') obj.rowspan = parseInt(v);
        });
        mergeMap[key] = obj;
      }
      continue;
    }
    if (/^[HD],/.test(line)) dataLines.push(line);
  }

  if (!dataLines.length) return '<p>[표 데이터 없음]</p>';

  const skipSet = new Set();
  Object.entries(mergeMap).forEach(([key, val]) => {
    const [r, c] = key.split('-').map(Number);
    const cs = val.colspan || 1;
    const rs = val.rowspan || 1;
    for (let dr = 0; dr < rs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        if (dr === 0 && dc === 0) continue;
        skipSet.add(`${r + dr}-${c + dc}`);
      }
    }
  });

  const rows = dataLines.map((line, r) => {
    const type = line[0];
    const cells = splitTableCells(line.slice(2));
    const tds = cells.map((cellText, c) => {
      if (skipSet.has(`${r}-${c}`)) return '';
      const tag = type === 'H' ? 'th' : 'td';
      const merge = mergeMap[`${r}-${c}`] || {};
      const csAttr = merge.colspan > 1 ? ` colspan="${merge.colspan}"` : '';
      const rsAttr = merge.rowspan > 1 ? ` rowspan="${merge.rowspan}"` : '';
      const st = styleMap[`${r}-${c}`] || {};
      const safeBg = st.bg && /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d,.\s]+\)$/.test(st.bg) ? st.bg : '';
      const safeAlign = ['left','center','right','justify'].includes(st.align) ? st.align : '';
      const styleStr = [
        safeBg ? `background:${safeBg}` : '',
        safeAlign ? `text-align:${safeAlign}` : ''
      ].filter(Boolean).join(';');
      const styleAttr = styleStr ? ` style="${styleStr}"` : '';
      return `<${tag}${csAttr}${rsAttr}${styleAttr}>${esc(cellText).replace(/\n/g, '<br>')}</${tag}>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  return `<div class="kn-table-wrap"><table class="kn-table">${rows}</table></div>`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function parseContent(text) {
  const result = [];
  const lines = (text || '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '[table]') {
      const blockLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '[/table]') {
        blockLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        result.push(renderTableBlock(blockLines));
        i++;
      } else {
        result.push('<p style="color:#e53e3e">[표 닫힘 태그 누락]</p>');
      }
      continue;
    }
    const m = line.match(/^\[img:(https?:\/\/[^\]]+)\]$/);
    if (m) result.push(`<img src="${esc(m[1])}" style="max-width:100%;border-radius:10px;margin:12px 0;display:block;" alt="" loading="lazy">`);
    else if (line.trim() === '') result.push('<br>');
    else result.push(`<p>${esc(line)}</p>`);
    i++;
  }
  return result.join('');
}

function renderPage(post, canonicalUrl, related) {
  const title = esc(post.title);
  const date  = fmtDate(post.created_at);
  const plain = (post.content || '').replace(/\[img:[^\]]+\]/g,'').replace(/\s+/g,' ').trim().slice(0, 160);
  const desc  = esc(plain || '보험 설계사를 위한 보험지식 콘텐츠를 인슈어커넥트에서 확인하세요.');
  const img   = esc(post.image_url || 'https://insureconnect.co.kr/logo-full.png');
  const body  = parseContent(post.content);
  // v2.26.0: 콘텐츠 상호 내부링크(소프트 SEO #14) — 다른 보험지식으로 크롤 경로 + 체류 유도
  const relatedHtml = (related && related.length) ? `
    <section class="kn-related" aria-label="다른 보험지식">
      <h2 class="kn-related-title">📚 다른 보험지식</h2>
      <ul class="kn-related-list">${related.map(function(r){ return `<li><a href="/knowledge/${r.id}">${esc(r.title)}</a></li>`; }).join('')}</ul>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — InsureConnect 보험지식</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${esc(canonicalUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="InsureConnect">
  <meta property="og:title" content="${title} — InsureConnect 보험지식">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${img}">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${img}">
  <link rel="preconnect" href="https://cdn.jsdelivr.net">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'Pretendard',-apple-system,sans-serif;}
    :root{--blue:#0c1fb8;--blue-mid:#1a3de8;--cyan:#00c8ee;--bg:#f0f5ff;--card:#fff;--border:rgba(12,31,184,0.10);--txt:#080f30;--mid:#3d5080;--lo:#8fa5cc;}
    body{background:var(--bg);color:var(--txt);min-height:100vh;}

    /* 상단 바 */
    .topbar{background:#fff;border-bottom:1.5px solid var(--border);padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(12,31,184,0.06);}
    .topbar-logo{font-size:15px;font-weight:800;color:var(--blue);letter-spacing:-0.02em;text-decoration:none;}
    .topbar-logo span{color:var(--cyan);}
    .topbar-back{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--mid);text-decoration:none;padding:6px 12px;border-radius:8px;border:1.5px solid var(--border);background:#fff;transition:border-color .15s,color .15s;}
    .topbar-back:hover{border-color:var(--blue-mid);color:var(--blue-mid);}

    /* 본문 */
    .wrap{max-width:720px;margin:0 auto;padding:40px 24px 80px;}

    /* 커버 이미지 */
    .cover{width:100%;max-height:360px;object-fit:cover;border-radius:16px;margin-bottom:32px;display:block;}

    /* 메타 */
    .post-category{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--blue-mid);background:rgba(26,61,232,0.07);padding:4px 12px;border-radius:100px;margin-bottom:16px;}
    .post-category::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--cyan);display:inline-block;}
    h1.post-title{font-size:1.65rem;font-weight:800;color:var(--txt);line-height:1.3;letter-spacing:-0.02em;margin-bottom:14px;}
    .post-date{font-size:13px;color:var(--lo);margin-bottom:32px;padding-bottom:24px;border-bottom:1.5px solid var(--border);}

    /* 본문 콘텐츠 */
    .post-body{font-size:15px;color:var(--mid);line-height:1.9;}
    .post-body p{margin-bottom:10px;}
    .post-body br{line-height:2.4;}
    .kn-table-wrap{overflow-x:auto;margin:16px 0;-webkit-overflow-scrolling:touch;}
    .kn-table{border-collapse:collapse;width:100%;min-width:400px;font-size:13px;line-height:1.5;background:#fff;}
    .kn-table th,.kn-table td{border:1px solid rgba(12,31,184,0.14);padding:10px 12px;vertical-align:top;text-align:left;color:var(--mid);}
    .kn-table th{background:rgba(26,61,232,0.06);font-weight:800;color:var(--blue);}
    .kn-table tr:nth-child(even) td{background:#f8fafc;}

    /* 앱 열기 배너 */
    .app-banner{margin-top:48px;background:linear-gradient(135deg,rgba(12,31,184,0.05),rgba(0,200,238,0.05));border:1.5px solid var(--border);border-radius:16px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
    .app-banner-txt strong{display:block;font-size:15px;font-weight:700;color:var(--txt);margin-bottom:4px;}
    .app-banner-txt p{font-size:13px;color:var(--mid);}
    .app-banner-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--blue-mid),var(--blue));color:#fff;font-size:14px;font-weight:700;padding:11px 22px;border-radius:10px;text-decoration:none;flex-shrink:0;transition:opacity .15s;}
    .app-banner-btn:hover{opacity:.88;}

    /* 목록 링크 */
    .back-list{display:inline-flex;align-items:center;gap:7px;margin-top:32px;font-size:14px;font-weight:600;color:var(--mid);text-decoration:none;}
    .back-list:hover{color:var(--blue-mid);}

    /* v2.26.0: 다른 보험지식(내부링크) */
    .kn-related{margin-top:44px;padding-top:28px;border-top:1.5px solid var(--border);}
    .kn-related-title{font-size:15px;font-weight:800;color:var(--txt);margin-bottom:12px;}
    .kn-related-list{list-style:none;display:flex;flex-direction:column;gap:0;}
    .kn-related-list li{border-bottom:1px solid var(--border);}
    .kn-related-list li:last-child{border-bottom:none;}
    .kn-related-list a{display:block;padding:12px 4px;font-size:14px;font-weight:600;color:var(--mid);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .15s;}
    .kn-related-list a:hover{color:var(--blue-mid);}

    @media(max-width:600px){
      h1.post-title{font-size:1.3rem;}
      .app-banner{padding:18px 20px;}
      .wrap{padding:28px 16px 60px;}
    }
  </style>
</head>
<body>
  <nav class="topbar">
    <a href="/" class="topbar-logo">Insure<span>Connect</span></a>
    <a href="/?knowledge=1#knowledge" class="topbar-back" onclick="history.length>1&&(history.back(),event.preventDefault())">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      목록으로
    </a>
  </nav>

  <main class="wrap" itemscope itemtype="https://schema.org/Article">
    ${post.image_url ? `<img class="cover" src="${img}" alt="${title}" itemprop="image">` : ''}

    <div class="post-category">보험지식</div>
    <h1 class="post-title" itemprop="headline">${title}</h1>
    <p class="post-date" itemprop="datePublished" content="${esc(post.created_at)}">${date}</p>

    <article class="post-body" itemprop="articleBody">
      ${body}
    </article>

    <a href="/" class="back-list">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      보험지식 목록으로
    </a>

    ${relatedHtml}

    <div class="app-banner">
      <div class="app-banner-txt">
        <strong>더 많은 보험지식이 있어요</strong>
        <p>인슈어커넥트에서 보험사 전산·소식지·청구서류도 확인하세요.</p>
      </div>
      <a href="/" class="app-banner-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        인슈어커넥트 홈
      </a>
    </div>
  </main>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const id = context.params.id;
  if (!id || isNaN(Number(id))) {
    return new Response('Not Found', { status: 404 });
  }
  const pid = Number(id);

  try {
    const post = await context.env.DB.prepare(
      `SELECT id, title, content, image_url, created_at
         FROM ic_knowledge_posts WHERE id = ? LIMIT 1`
    ).bind(pid).first();

    if (!post) {
      return new Response('Not Found', { status: 404 });
    }

    const canonicalUrl = `https://insureconnect.co.kr/knowledge/${id}`;
    // v2.26.0: 다른 보험지식 6개(현재 글 제외) — 콘텐츠 상호 내부링크용
    let related = [];
    try {
      const rr = await context.env.DB.prepare(
        `SELECT id, title, created_at
           FROM ic_knowledge_posts WHERE id != ? ORDER BY created_at DESC LIMIT 6`
      ).bind(pid).all();
      related = rr.results || [];
    } catch (_) {}
    const html = renderPage(post, canonicalUrl, related);

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=3600',
      },
    });
  } catch (e) {
    return new Response('Server Error', { status: 500 });
  }
}
