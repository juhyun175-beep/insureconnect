/**
 * v2.0.0 (master): SEO 게시판 카테고리 enum
 * URL slug 와 한국어 라벨 매핑 + breadcrumb / sitemap 에서 공통 사용.
 */

export const SEO_CATEGORIES = [
  { slug: 'claim',         label: '보험금청구',  desc: '실손/암/수술 등 보험금 청구 가이드' },
  { slug: 'actual-loss',   label: '실손보험',    desc: '실비 청구·인수기준·세대별 비교' },
  { slug: 'whole-life',    label: '종신보험',    desc: '종신보험 상품·인수·해약환급 정보' },
  { slug: 'cancer',        label: '암보험',      desc: '암보험 보장·진단비·갱신 구조' },
  { slug: 'car',           label: '자동차보험',  desc: '자동차보험 갱신·할인할증·과실비율' },
  { slug: 'practice',      label: '설계사실무',  desc: '상담·청약·DB·관리 실무 노하우' },
  { slug: 'recruit-tips',  label: '리쿠르팅',    desc: '신입/경력 설계사 채용·교육' },
  { slug: 'notice',        label: '보험사공지',  desc: '국내 보험사 공식 공지 모음' },
  { slug: 'surgery-code',  label: '수술코드',    desc: '수술 분류·코드별 보상 안내' },
  { slug: 'disease-code',  label: '질병코드',    desc: 'KCD 질병코드·보장 매핑' },
  { slug: 'terms',         label: '약관해설',    desc: '주요 약관 조항 해설' },
  { slug: 'underwrite',    label: '인수사례',    desc: '인수·면책·심사 사례' },
];

export const SEO_CATEGORY_MAP = Object.fromEntries(
  SEO_CATEGORIES.map(c => [c.slug, c])
);

export function isValidCategory(slug) {
  return !!SEO_CATEGORY_MAP[slug];
}
