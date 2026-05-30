/**
 * v2.1.68: GA(법인보험대리점) 전산 데이터 — 프로그래매틱 SEO SSR 소스
 *   - index.html 의 GA 배열에서 추출 (전산 ERP URL + 공식 홈페이지 도메인)
 *   - /ga/{slug} 개별 전산 랜딩, /ga 허브에서 사용
 */
export const GA_LIST = [
  { slug: 'aplus-asset',   name: '에이플러스에셋',   site: 'aplusga.com',      erp: 'https://www.aplusga.com/tfa/login.do' },
  { slug: 'authentic-fg',  name: '어센틱금융그룹',   site: 'afg.kr',           erp: 'https://line.afg.kr/login' },
  { slug: 'thebest-fs',    name: '더베스트금융',     site: 'thebestfs.co.kr',  erp: 'https://erp.thebestfs.co.kr/login.go' },
  { slug: 'prime-asset',   name: '프라임에셋',       site: 'pams.kr',          erp: 'https://pams.kr/' },
  { slug: 'mega',          name: '메가',             site: 'megafn.com',       erp: 'https://mega.megafn.com/' },
  { slug: 'ifa',           name: 'IFA',              site: 'ifacloud.co.kr',   erp: 'https://www1.ifacloud.co.kr/new_index.aspx?ReturnUrl=%2f' },
  { slug: 'ga-korea',      name: '지에이코리아',     site: 'gakorea.biz',      erp: 'https://nerp.gakorea.biz/login.go' },
  { slug: 'global-fn',     name: '글로벌금융판매',   site: 'globalgoms.co.kr', erp: 'https://www.globalgoms.co.kr/#/login' },
  { slug: 'metarich',      name: '메타리치',         site: 'meta-on.kr',       erp: 'https://meta-on.kr/#/login' },
  { slug: 'fm-asset',      name: 'FM에셋',           site: 'inskorea.net',     erp: 'https://inskorea.net/irs/login/' },
  { slug: 'm-fn',          name: '엠금융서비스',     site: 'm-fn.co.kr',       erp: 'https://ap2.gaiasystem.co.kr/mfweb/x_install2.jsp' },
  { slug: 'kga-asset',     name: 'KGA에셋',          site: 'kgaasset.com',     erp: 'https://ktams.kgaasset.com/Install/newLauncher_XP.html' },
  { slug: 'toss-insurance',name: '토스인슈어런스',   site: 'tossinsu.com',     erp: 'https://erp.tossinsu.com/login.go' },
  { slug: 'goodrich',      name: '굿리치',           site: 'goodrich.kr',      erp: 'https://sso.goodrich.kr/account/login' },
  { slug: 'valuemark',     name: '벨류마크',         site: 'valuemark.co.kr',  erp: 'https://login.valuemark.co.kr/login' },
  { slug: 'peoplelife',    name: '한화피플라이프',   site: 'peoplelife.co.kr', erp: 'https://pines.peoplelife.co.kr/login' },
  { slug: 'az-finance',    name: '에즈금융서비스',   site: 'azlife.kr',        erp: 'https://az.azlife.kr/login' },
];

export const GA_MAP = Object.fromEntries(GA_LIST.map(g => [g.slug, g]));
