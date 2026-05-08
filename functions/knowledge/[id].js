const SB_URL  = 'https://rzllpymhtygnooduevgf.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bGxweW1odHlnbm9vZHVldmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjg1NjYsImV4cCI6MjA4NzkwNDU2Nn0.Z2K720NiFo191fVBllr0_OiTxvJYjwTSv3ZSiNgc2bs';
const SB_HDR  = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function parseContent(text) {
  return (text || '').split('\n').map(line => {
    const m = line.match(/^\[img:(https?:\/\/[^\]]+)\]$/);
    if (m) return `<img src="${esc(m[1])}" style="max-width:100%;border-radius:10px;margin:12px 0;display:block;" alt="" loading="lazy">`;
    if (line.trim() === '') return '<br>';
    return `<p>${esc(line)}</p>`;
  }).join('');
}

function renderPage(post, canonicalUrl) {
  const title = esc(post.title);
  const date  = fmtDate(post.created_at);
  const plain = (post.content || '').replace(/\[img:[^\]]+\]/g,'').replace(/\s+/g,' ').trim().slice(0, 160);
  const desc  = esc(plain || '보험 설계사를 위한 보험지식 콘텐츠를 인슈어커넥트에서 확인하세요.');
  const img   = esc(post.image_url || 'https://insureconnect-hub.pages.dev/logo-full.png');
  const body  = parseContent(post.content);

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

    /* 앱 열기 배너 */
    .app-banner{margin-top:48px;background:linear-gradient(135deg,rgba(12,31,184,0.05),rgba(0,200,238,0.05));border:1.5px solid var(--border);border-radius:16px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
    .app-banner-txt strong{display:block;font-size:15px;font-weight:700;color:var(--txt);margin-bottom:4px;}
    .app-banner-txt p{font-size:13px;color:var(--mid);}
    .app-banner-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--blue-mid),var(--blue));color:#fff;font-size:14px;font-weight:700;padding:11px 22px;border-radius:10px;text-decoration:none;flex-shrink:0;transition:opacity .15s;}
    .app-banner-btn:hover{opacity:.88;}

    /* 목록 링크 */
    .back-list{display:inline-flex;align-items:center;gap:7px;margin-top:32px;font-size:14px;font-weight:600;color:var(--mid);text-decoration:none;}
    .back-list:hover{color:var(--blue-mid);}

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

  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_knowledge_posts?id=eq.${encodeURIComponent(id)}&select=id,title,content,image_url,created_at&limit=1`,
      { headers: SB_HDR }
    );
    const rows = await res.json();
    const post = rows?.[0];

    if (!post) {
      return new Response('Not Found', { status: 404 });
    }

    const canonicalUrl = `https://insureconnect-hub.pages.dev/knowledge/${id}`;
    const html = renderPage(post, canonicalUrl);

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
