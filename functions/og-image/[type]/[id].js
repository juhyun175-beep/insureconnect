/**
 * v2.1.42: 동적 OG 이미지 생성기 (SVG)
 *
 *   /og-image/recruit/{id}      → 채용공고 디자인 카드 (1200×630)
 *   /og-image/lecture/{id}      → 강의공고 디자인 카드
 *   /og-image/news/{set_id}     → 카드뉴스
 *   /og-image/knowledge/{id}    → 보험지식
 *
 * SVG 반환. wsrv.nl 프록시로 PNG 변환 가능:
 *   https://wsrv.nl/?url=...&output=png&w=1200&h=630
 *
 * 이미지 업로드 없는 텍스트 콘텐츠의 카톡 미리보기 클릭률 향상.
 */

const PRESETS = {
  recruit: {
    badge: '💼 채용공고',
    grad: ['#1a3de8', '#4a70f5', '#5b8cff'],
    accent: '#ffd000',
    label: 'recruit',
  },
  lecture: {
    badge: '🎓 강의 일정',
    grad: ['#7c3aed', '#a855f7', '#c084fc'],
    accent: '#fde047',
    label: 'lecture',
  },
  news: {
    badge: '📰 카드뉴스',
    grad: ['#0ea5e9', '#06b6d4', '#22d3ee'],
    accent: '#ffe066',
    label: 'news',
  },
  knowledge: {
    badge: '📚 보험지식',
    grad: ['#059669', '#10b981', '#34d399'],
    accent: '#fde68a',
    label: 'knowledge',
  },
  board: {
    badge: '💬 자유게시판',
    grad: ['#d97706', '#f97316', '#fb923c'],
    accent: '#fff7ed',
    label: 'board',
  },
  answer: {
    badge: '🤖 삼따AI 답변',
    grad: ['#1a3de8', '#4f46e5', '#22d3ee'],
    accent: '#7ee0ff',
    label: 'answer',
  },
  invite: {
    badge: '🎁 무료 초대장',
    grad: ['#f59e0b', '#f97316', '#fb7185'],
    accent: '#fff7ed',
    label: 'invite',
  },
};

/** XML 안전 이스케이프 */
const xmlEsc = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** 한글/이모지 안전한 문자열 트림 — 코드포인트 기준 */
function truncateChars(s, maxChars) {
  const arr = Array.from(String(s || ''));
  if (arr.length <= maxChars) return arr.join('');
  return arr.slice(0, maxChars - 1).join('') + '…';
}

/** 줄 단위로 자르기 — 폭에 맞게 (한글 1자 ≈ 2 영문자) */
function wrapLines(text, maxCharsPerLine, maxLines) {
  if (!text) return [];
  const words = String(text).split(/(\s+)/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur + w;
    if (Array.from(trial).length > maxCharsPerLine && cur) {
      lines.push(cur.trim());
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = trial;
    }
  }
  if (lines.length < maxLines && cur.trim()) lines.push(cur.trim());
  if (lines.length >= maxLines && cur.length > 0) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = truncateChars(last, maxCharsPerLine);
  }
  return lines.slice(0, maxLines);
}

function svgCard({ type, title, subtitle, dateStr }) {
  const p = PRESETS[type] || PRESETS.recruit;
  const [g1, g2, g3] = p.grad;
  const titleLines = wrapLines(title, 22, 3);
  const subtitleClean = truncateChars(subtitle || '', 50);

  // 제목 줄별 y 좌표 (centered around y=320)
  const lineCount = titleLines.length;
  const lineHeight = 72;
  const startY = 320 - ((lineCount - 1) * lineHeight) / 2;

  const titleSvg = titleLines.map((line, i) =>
    `<text x="80" y="${startY + i * lineHeight}" font-size="64" font-weight="900" fill="#fff" letter-spacing="-1.5">${xmlEsc(line)}</text>`
  ).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${g1}"/>
      <stop offset="60%" stop-color="${g2}"/>
      <stop offset="100%" stop-color="${g3}"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)" />
      <stop offset="50%" stop-color="rgba(255,255,255,0.18)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
    <radialGradient id="dot" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- 장식 원 -->
  <circle cx="1050" cy="100" r="200" fill="url(#dot)"/>
  <circle cx="150" cy="550" r="170" fill="url(#dot)"/>

  <!-- 광택 띠 -->
  <polygon points="200,0 400,0 250,630 50,630" fill="url(#shine)"/>

  <!-- 상단 배지 -->
  <rect x="80" y="70" rx="22" ry="22" width="${Math.min(380, p.badge.length * 30 + 60)}" height="44"
        fill="rgba(0,0,0,0.32)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
  <text x="100" y="101" font-size="22" font-weight="800" fill="#fff" letter-spacing="0.5">${xmlEsc(p.badge)}</text>

  <!-- 제목 -->
  ${titleSvg}

  <!-- 부제목 (회사명·강사명 등) -->
  ${subtitleClean ? `<text x="80" y="480" font-size="28" font-weight="700" fill="${p.accent}" letter-spacing="-0.5">${xmlEsc(subtitleClean)}</text>` : ''}

  <!-- 날짜 -->
  ${dateStr ? `<text x="80" y="520" font-size="22" font-weight="600" fill="rgba(255,255,255,0.75)">${xmlEsc(dateStr)}</text>` : ''}

  <!-- 하단 브랜드 -->
  <line x1="80" y1="555" x2="1120" y2="555" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="80" y="595" font-size="26" font-weight="900" fill="#fff" letter-spacing="-0.5">InsureConnect</text>
  <text x="80" y="617" font-size="14" font-weight="600" fill="rgba(255,255,255,0.7)">보험설계사를 위한 통합 허브 · insureconnect.co.kr</text>

  <!-- 우측 하단 화살표 -->
  <circle cx="1100" cy="585" r="36" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
  <text x="1100" y="600" font-size="40" font-weight="900" fill="#fff" text-anchor="middle">→</text>
</svg>`;
}

const CACHE_HEADERS = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  'Access-Control-Allow-Origin': '*',
};

/** Kakao/Slack 등 스크래퍼의 og:image preflight HEAD 통과용 */
export const onRequestHead = async () => new Response(null, { headers: CACHE_HEADERS });

export const onRequestGet = async ({ params, env }) => {
  const { type, id } = params;
  if (!PRESETS[type]) {
    return new Response('Unknown type', { status: 400 });
  }

  let title = 'InsureConnect';
  let subtitle = '';
  let dateStr = '';

  try {
    if (type === 'recruit') {
      const r = await env.DB.prepare(
        `SELECT title, company_name, created_at FROM ic_recruitments WHERE id = ? AND status = 'approved'`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        subtitle = r.company_name || '';
        if (r.created_at) dateStr = String(r.created_at).slice(0, 10).replace(/-/g, '.');
      }
    } else if (type === 'lecture') {
      const r = await env.DB.prepare(
        `SELECT title, instructor, created_at FROM ic_lectures WHERE id = ? AND status = 'approved'`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        subtitle = r.instructor ? `강사 ${r.instructor}` : '';
        if (r.created_at) dateStr = String(r.created_at).slice(0, 10).replace(/-/g, '.');
      }
    } else if (type === 'news') {
      const r = await env.DB.prepare(
        `SELECT title, created_at FROM ic_card_news WHERE set_id = ? ORDER BY sort_order ASC LIMIT 1`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        if (r.created_at) dateStr = String(r.created_at).slice(0, 10).replace(/-/g, '.');
      }
    } else if (type === 'knowledge') {
      const r = await env.DB.prepare(
        `SELECT title, created_at FROM ic_knowledge_posts WHERE id = ?`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        if (r.created_at) dateStr = String(r.created_at).slice(0, 10).replace(/-/g, '.');
      }
    } else if (type === 'board') {
      const r = await env.DB.prepare(
        `SELECT title, content, created_at FROM ic_board_posts WHERE id = ? AND deleted = 0`
      ).bind(id).first();
      if (r) {
        title = r.title || title;
        subtitle = (r.content || '').replace(/\s+/g, ' ').trim().slice(0, 48);
        if (r.created_at) dateStr = String(r.created_at).slice(0, 10).replace(/-/g, '.');
      }
    } else if (type === 'answer') {
      // v2.15.8: 공유된 삼따AI 답변 — 질문을 카드 제목으로(카톡 미리보기 클릭률↑)
      const r = await env.DB.prepare(
        `SELECT question, case_count FROM ic_shared_answers WHERE id = ?`
      ).bind(id).first();
      if (r) {
        title = r.question || title;
        subtitle = (r.case_count > 0) ? `실제 사례 ${r.case_count}건 기반 답변` : '실제 사례 기반 답변';
      }
    } else if (type === 'invite') {
      // v2.16.1: 추천 초대 카드 (코드 비노출 — 정적 메시지)
      title = '가입하면 둘 다 포인트!';
      subtitle = '보험설계사 통합 플랫폼 · 전부 무료';
    }
  } catch (_) {}

  const svg = svgCard({ type, title, subtitle, dateStr });
  return new Response(svg, { headers: CACHE_HEADERS });
};
