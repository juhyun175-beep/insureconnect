/**
 * 네이버 블로그 재배포 드래프트 생성기 — 보험사 전산 + GA 전산
 *   사용법: node seo-seed/naver-company-ga-draft.mjs > naver-blog/drafts-company-ga.txt
 *
 * - /company/{slug}, /ga/{slug} 프로그래매틱 SEO 랜딩의 핵심 정보 요약
 * - 원문 전체를 복제하지 않음(요약 + 링크) → 중복 콘텐츠 회피, 네이버→사이트 유입 유도
 */
import { INSURERS } from '../functions/_lib/insurers.js';
import { GA_LIST } from '../functions/_lib/ga-companies.js';

const SITE = 'https://insureconnect.co.kr';
const UTM = '?utm_source=naverblog&utm_medium=repost&utm_campaign=nbcg2607';
const GA_INTRO = 'GA(법인보험대리점)는 여러 보험사 상품을 비교·판매하는 대리점입니다. 소속 설계사는 각 GA의 전산(ERP)에서 청약·고객관리·수수료 등을 처리합니다. 보험사 직접 전산은 인슈어커넥트의 보험사 전산·청구 안내에서 확인할 수 있습니다.';

const isPhone = (s) => /\d{3,}/.test(String(s || ''));
const tag = (s) => '#' + String(s || '').replace(/\s+/g, '');
const topicJosa = (s) => {
  const ch = [...String(s || '')].at(-1) || '';
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '는';
  return (code - 0xac00) % 28 === 0 ? '는' : '은';
};

function insurerFaqs(ins) {
  const topic = topicJosa(ins.name);
  return [
    { q: `${ins.name} 대표 고객센터 전화번호는?`, a: `${ins.name} 대표전화는 ${ins.call} 입니다.${isPhone(ins.incall) && ins.incall !== ins.call ? ` 보험금 보상·접수 문의는 ${ins.incall} 로 연결됩니다.` : ''}` },
    { q: `${ins.name} 보험금 청구는 어떻게 하나요?`, a: `${ins.name}${topic} 모바일 앱·팩스·방문 등으로 청구할 수 있습니다.${isPhone(ins.fax) ? ` 청구 서류 팩스번호는 ${ins.fax} 입니다.` : ` 청구 팩스는 "${ins.fax}" 방식입니다.`} 실손은 영수증·세부내역서, 진단비는 진단서가 기본 서류입니다.` },
    { q: `${ins.name} 설계사 전산(사이버창구)은 어디서 접속하나요?`, a: `인슈어커넥트 원문 페이지의 "전산 바로가기" 버튼으로 ${ins.name} 공식 설계사 전산에 접속할 수 있습니다.` },
    { q: `${ins.name} 상품공시는 어디서 확인하나요?`, a: `${ins.name} 공식 상품공시실에서 판매 상품과 약관을 확인할 수 있습니다. 원문 페이지의 "상품공시실" 링크를 이용하세요.` },
  ];
}

function gaFaqs(ga) {
  return [
    { q: `${ga.name} 전산은 어디서 로그인하나요?`, a: `인슈어커넥트 원문 페이지의 "전산 바로가기" 버튼으로 ${ga.name} 공식 설계사 전산(ERP)에 접속할 수 있습니다. 소속 시 발급받은 아이디·비밀번호로 로그인하세요.` },
    { q: `${ga.name} 전산 비밀번호를 분실했어요.`, a: `전산 비밀번호 분실·초기화는 본인이 소속된 ${ga.name} 지점 또는 본사 전산 담당에 문의해야 합니다. 보안상 소속 GA를 통해서만 재발급됩니다.` },
    { q: '전산 접속이 안 되거나 보안프로그램 설치를 요구해요.', a: '법인대리점 전산은 최초 접속 시 보안 프로그램 설치가 필요한 경우가 많습니다. 안내에 따라 설치 후 브라우저를 재시작하고, PC 환경과 권장 브라우저를 확인하세요.' },
    { q: 'GA(법인보험대리점)가 무엇인가요?', a: `GA는 여러 보험사의 상품을 비교·판매할 수 있는 법인보험대리점입니다. ${ga.name} 같은 GA 소속 설계사는 전속과 달리 여러 보험사 상품을 함께 취급합니다.` },
  ];
}

function pushDraft(out, { title, body, points, faqs, link, tags }) {
  out.push('═'.repeat(60));
  out.push(`[제목] ${title}`);
  out.push('─'.repeat(60));
  out.push('[본문 — 네이버 블로그에 붙여넣기]');
  out.push('');
  out.push(body);
  out.push('');
  out.push('✅ 핵심 포인트');
  points.forEach(p => out.push(`· ${p}`));
  out.push('');
  out.push('❓ 자주 묻는 질문');
  faqs.forEach(q => { out.push(`Q. ${q.q}`); out.push(`A. ${q.a}`); out.push(''); });
  out.push('👉 원문보기 링크');
  out.push(`${link}${UTM}`);
  out.push('');
  out.push(tags.join(' '));
  out.push('');
}

let count = 0;
const out = [];

for (const ins of INSURERS) {
  count++;
  const link = `${SITE}/company/${ins.slug}`;
  const faqs = insurerFaqs(ins);
  pushDraft(out, {
    title: `${ins.name} 전산 바로가기, 청구 팩스번호, 보상접수 번호 정리`,
    body: `${ins.name} 설계사 전산 바로가기와 대표전화, 보상접수 번호, 청구 팩스번호, 상품공시실 링크를 한 번에 확인할 수 있도록 정리했습니다. 보험금 청구 전에는 접수 방식과 필요서류를 먼저 확인하면 처리 지연을 줄일 수 있습니다.`,
    points: [
      `대표전화: ${ins.call}`,
      `보상접수 번호: ${ins.incall}`,
      `청구 팩스번호: ${ins.fax}`,
      '설계사 전산과 상품공시실은 원문 페이지에서 바로 이동할 수 있습니다.',
    ],
    faqs,
    link,
    tags: [tag(ins.name), '#보험사전산', '#보험설계사', '#인슈어커넥트'],
  });
}

for (const ga of GA_LIST) {
  count++;
  const link = `${SITE}/ga/${ga.slug}`;
  const faqs = gaFaqs(ga);
  pushDraft(out, {
    title: `${ga.name} 전산 로그인 바로가기`,
    body: `${GA_INTRO} ${ga.name} 소속 설계사는 원문 페이지에서 공식 전산 로그인 링크와 홈페이지 정보를 확인할 수 있습니다.`,
    points: [
      `${ga.name} 공식 전산(ERP) 로그인 링크 정리`,
      `공식 홈페이지: ${ga.site}`,
      '전산 비밀번호 초기화는 소속 지점 또는 본사 전산 담당을 통해 진행합니다.',
      '보험사 직접 전산은 보험사 전산·청구 안내에서 별도로 확인할 수 있습니다.',
    ],
    faqs,
    link,
    tags: [tag(ga.name), '#GA전산', '#법인대리점', '#보험설계사', '#인슈어커넥트'],
  });
}

console.error(`✓ 네이버 회사·GA 드래프트 ${count}건 생성`);
console.log(`네이버 블로그 재배포 드래프트 — 보험사 전산 + GA 전산 (총 ${count}건)\n원문 링크백 포함 — 요약 후 "원문보기"로 유입 유도\n`);
console.log(out.join('\n'));
