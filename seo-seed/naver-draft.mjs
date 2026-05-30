/**
 * 네이버 블로그 재배포 드래프트 생성기
 *   사용법: node seo-seed/naver-draft.mjs > naver-blog/drafts.txt
 *
 * - 기존 게시판 배치(batch-01~12)에서 제목·요약·핵심포인트·FAQ를 추출
 * - 네이버 블로그에 "복붙"할 수 있는 요약본 + 원문 링크백 생성
 * - 원문 전체를 복제하지 않음(요약 + 링크) → 중복 콘텐츠 회피, 네이버→사이트 유입 유도
 */
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://insureconnect-hub.pages.dev';

const stripTags = (html) => String(html || '')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();

// content HTML 에서 핵심 포인트(.post-key 의 <li>) 추출
function keyPoints(html) {
  const m = String(html || '').match(/post-key[\s\S]*?<ul>([\s\S]*?)<\/ul>/);
  if (!m) return [];
  return [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(x => stripTags(x[1])).filter(Boolean);
}

const files = (await readdir(__dir)).filter(f => /^batch-\d+\.js$/.test(f)).sort();
let count = 0;
const out = [];

for (const f of files) {
  const mod = await import(pathToFileURL(resolve(__dir, f)).href);
  for (const p of (mod.default || [])) {
    count++;
    const link = `${SITE}/insurance/${p.category}/${p.slug}`;
    const kps = keyPoints(p.content);
    const tags = (p.tags || []).map(t => '#' + String(t).replace(/\s+/g, '')).join(' ');
    const faqs = Array.isArray(p.faq) ? p.faq.slice(0, 2) : [];

    out.push('═'.repeat(60));
    out.push(`[제목] ${p.title}`);
    out.push('─'.repeat(60));
    out.push('[본문 — 네이버 블로그에 붙여넣기]');
    out.push('');
    out.push(stripTags(p.excerpt));
    out.push('');
    if (kps.length) {
      out.push('✅ 핵심 포인트');
      kps.forEach(k => out.push(`· ${k}`));
      out.push('');
    }
    if (faqs.length) {
      out.push('❓ 자주 묻는 질문');
      faqs.forEach(q => { out.push(`Q. ${q.q}`); out.push(`A. ${q.a}`); out.push(''); });
    }
    out.push('👉 전체 내용·서류·사례는 원문에서 확인하세요');
    out.push(link);
    out.push('');
    out.push(tags + ' #보험 #보험설계사 #인슈어커넥트');
    out.push('');
  }
}

console.error(`✓ 네이버 드래프트 ${count}건 생성`);
console.log(`네이버 블로그 재배포 드래프트 (총 ${count}건)\n원문 링크백 포함 — 요약 후 "원문 보기"로 유입 유도\n`);
console.log(out.join('\n'));
