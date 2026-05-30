/**
 * llms.txt 생성기 (AEO) — LLM/AI 답변엔진용 콘텐츠 맵
 *   사용법: node seo-seed/llms-gen.mjs > llms.txt
 *   배치 데이터(batch-*.js) + 핵심 허브를 마크다운 맵으로 출력
 */
import { readdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://insureconnect-hub.pages.dev';
const CAT = {
  claim: '보험금청구', 'actual-loss': '실손보험', 'whole-life': '종신보험', cancer: '암보험',
  car: '자동차보험', practice: '설계사실무', 'recruit-tips': '리쿠르팅', notice: '보험사공지',
  'surgery-code': '수술코드', 'disease-code': '질병코드', terms: '약관해설', underwrite: '인수사례',
};
const stripTags = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const files = (await readdir(__dir)).filter(f => /^batch-\d+\.js$/.test(f)).sort();
const byCat = {};
for (const f of files) {
  const mod = await import(pathToFileURL(resolve(__dir, f)).href);
  for (const p of (mod.default || [])) {
    (byCat[p.category] ||= []).push(p);
  }
}

const out = [];
out.push('# InsureConnect (인슈어커넥트)');
out.push('');
out.push('> 보험설계사를 위한 통합 정보 허브. 국내 생명·손해보험사의 설계사 전산(사이버창구) 바로가기·고객센터 전화·보험금 청구 팩스·청구서류 양식·상품공시, GA(법인보험대리점) 전산, 그리고 실손·암·자동차·종신보험 등 보험 전문 정보 게시판을 한 곳에서 제공합니다. 모든 정보는 일반적 안내이며 구체적 보장 여부는 가입 상품의 약관과 보험사 안내를 기준으로 합니다.');
out.push('');
out.push('## 핵심 허브');
out.push(`- [보험사 전산·고객센터·청구 안내](${SITE}/company): 보험사별 설계사 전산 바로가기, 대표전화/보상접수, 청구 팩스, 상품공시`);
out.push(`- [보험사 고객센터 전화번호 총정리](${SITE}/company/customer-center)`);
out.push(`- [보험금 청구 팩스번호 모음](${SITE}/company/claim-fax)`);
out.push(`- [보험금 청구서류 양식 다운로드](${SITE}/company/claim-forms)`);
out.push(`- [GA 법인대리점 전산 바로가기](${SITE}/ga)`);
out.push(`- [보험 정보 게시판(전체)](${SITE}/insurance)`);
out.push('');

let total = 0;
out.push('## 보험 정보 게시판 — 카테고리별 문서');
for (const cat of Object.keys(CAT)) {
  const posts = byCat[cat];
  if (!posts || !posts.length) continue;
  out.push('');
  out.push(`### ${CAT[cat]} ([목록](${SITE}/insurance/${cat}))`);
  for (const p of posts) {
    total++;
    const ex = stripTags(p.excerpt).slice(0, 100);
    out.push(`- [${p.title}](${SITE}/insurance/${cat}/${p.slug})${ex ? ': ' + ex : ''}`);
  }
}
out.push('');
out.push('## 안내');
out.push('- 본 사이트의 보험 정보는 교육·참고용 일반 정보이며, 보험금 지급 등 구체적 사안은 약관과 보험사 공식 안내가 우선합니다.');
out.push('- 보험사 고객센터·전산·청구 정보는 변경될 수 있으니 공식 채널에서 최종 확인을 권장합니다.');
out.push(`- 운영: InsureConnect (${SITE})`);

console.error(`✓ llms.txt 생성: 게시판 ${total}편 + 핵심 허브`);
console.log(out.join('\n'));
