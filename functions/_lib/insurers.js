/**
 * v2.1.62: 보험사 전산/연락처 데이터 (프로그래매틱 SEO용 SSR 소스)
 *   - index.html 의 LIFE / NONLIFE 배열에서 추출 (전산 URL·대표전화·보상접수·청구팩스·상품공시)
 *   - /company/{slug} SSR 랜딩에서 사용
 *   - 데이터 변경 시 index.html 과 함께 갱신
 */
export const INSURERS = [
  // ───── 생명보험 ─────
  { type:'life', slug:'shinhan-life', name:'신한라이프', call:'1588-5580', incall:'1522-2285', fax:'가상번호 부여', gongsi:'https://www.shinhanlife.co.kr/hp/cdhi0010.do', erp:'https://ga.shinhanlife.co.kr:11043/colomga010m.msv' },
  { type:'life', slug:'miraeasset-life', name:'미래에셋생명', call:'1588-0220', incall:'1588-0220', fax:'가상번호 부여', gongsi:'https://life.miraeasset.com/micro/disclosure/product/PC-HO-080301-000000.do', erp:'https://www.loveageplan.com/websquare/websquare.jsp?w2xPath=/view/lap/ui/lg/lga/PLGA010M00.xml' },
  { type:'life', slug:'hanwha-life', name:'한화생명', call:'1588-6363', incall:'1800-6633', fax:'가상번호 부여', gongsi:'https://www.hanwhalife.com/main/disclosure/goods/disclosurenotice/DF_GDDN000_P10000.do', erp:'https://hmp.hanwhalife.com/online/solutions/websquare/websquare.html?w2xPath=/online/ui/uv/gmn/uvgmn010mvw.xml' },
  { type:'life', slug:'samsung-life', name:'삼성생명', call:'1588-3114', incall:'1588-3115', fax:'가상번호 부여', gongsi:'https://www.samsunglife.com/individual/products/disclosure/sales/PDO-PRPRI010110M', erp:'https://connectplus.samsunglife.com:10443/gasso/login?contextType=external' },
  { type:'life', slug:'kyobo-life', name:'교보생명', call:'1588-1001', incall:'1588-1636', fax:'가상번호 부여', gongsi:'https://www.kyobo.com/dgt/web/product-official/all-product/search', erp:'https://sso.kyobo.com:5443/nls3/fcs' },
  { type:'life', slug:'heungkuk-life', name:'흥국생명', call:'1588-2288', incall:'1577-7006', fax:'가상번호 부여', gongsi:'https://www.heungkuklife.co.kr/front/public/saleProduct.do?searchFlgSale=Y', erp:'https://sales.heungkuklife.co.kr/login.html' },
  { type:'life', slug:'fubon-hyundai-life', name:'푸본현대생명', call:'1577-3311', incall:'X', fax:'0505-106-0311', gongsi:'https://www.fubonhyundai.com/#CUSI150102010101', erp:'https://wsfa.fubonhyundai.com/GA/index_etc.jsp' },
  { type:'life', slug:'im-life', name:'IM라이프', call:'1588-4770', incall:'1588-4770', fax:'콜센터 접수 후 0505-083-5420', gongsi:'https://www.imlifeins.co.kr/BA/BA_A020.do', erp:'https://fgs.imlifeins.co.kr:8443/' },
  { type:'life', slug:'kdb-life', name:'KDB생명', call:'1588-4040', incall:'1588-4040', fax:'콜센터 접수 후 02-2669-7939', gongsi:'https://www.kdblife.co.kr/ajax.do?scrId=HDLMA002M02P', erp:'https://kss.kdblife.co.kr/Install/x_installAX.html' },
  { type:'life', slug:'kb-life', name:'KB라이프', call:'1588-3374', incall:'1566-2730', fax:'02-6220-9912', gongsi:'https://www.kblife.co.kr/customer-common/productList.do', erp:'https://sfa.kblife.co.kr/scr/m/sfa-login?request=sfaLogin' },
  { type:'life', slug:'db-life', name:'DB생명', call:'1588-3131', incall:'02-6470-7911', fax:'0505-129-3134', gongsi:'https://www.idblife.com/notice/product/sale', erp:'http://etopia.dongbulife.com/' },
  { type:'life', slug:'tongyang-life', name:'동양생명', call:'1577-1004', incall:'080-899-1004', fax:'실손 02-3289-4516 / 정액 02-3289-4517', gongsi:'https://pbano.myangel.co.kr/notice/product/WE_PA_AP_01_00_00.jsp', erp:'https://1004.myangel.co.kr/colgnsf001m.wqv' },
  { type:'life', slug:'nh-life', name:'농협생명', call:'1544-4000', incall:'1544-4422', fax:'02-6971-6040', gongsi:'https://www.nhlife.co.kr/ho/on/HOON0004M00.nhl', erp:'https://sfa.nhlife.co.kr:8443/websquare/websquare.jsp' },
  { type:'life', slug:'abl-life', name:'ABL생명', call:'1588-6500', incall:'1566-1002', fax:'가상번호 부여', gongsi:'https://www.abllife.co.kr/st/pban/prdtPban/whlPrdt', erp:'https://ga.abllife.co.kr/ui2/login/login.jsp' },
  { type:'life', slug:'cardif-life', name:'카디프생명', call:'1688-1118', incall:'1688-1118', fax:'가상번호 부여', gongsi:'https://www.cardif.co.kr/disclosure/papag101.do', erp:'https://ga.cardif.co.kr/login/loginForm.do' },
  { type:'life', slug:'aia-life', name:'AIA생명', call:'1588-9898', incall:'1588-2513', fax:'02-2021-4540', gongsi:'https://www.aia.co.kr/ko/products.html', erp:'https://imap.aia.co.kr/NBSE/aiaone/' },
  { type:'life', slug:'metlife-life', name:'메트라이프생명', call:'1588-9600', incall:'1588-9609', fax:'가상번호 부여', gongsi:'https://brand.metlife.co.kr/pn/paReal/insuProductDisclMain.do', erp:'https://metplus.metlife.co.kr/nexacro/AgentPortal/index.jsp' },
  { type:'life', slug:'ibk-pension', name:'IBK연금보험', call:'1577-4117', incall:'02-2270-1661', fax:'02-2270-1577', gongsi:'https://www.ibki.co.kr/process/HP_PBANO_PDT_SP_INDV', erp:'https://sf.ibki.co.kr/websquare/websquare.html?w2xPath=/ui/SF/CO/SFCO100M01.xml' },
  { type:'life', slug:'chubb-life', name:'처브라이프', call:'1599-4600', incall:'1599-4600', fax:'02-3480-7801', gongsi:'https://www.chubblife.co.kr/front/official/sale/list.do', erp:'https://esmart.chubblife.co.kr/index.do' },
  { type:'life', slug:'hana-life', name:'하나생명', call:'1577-1112', incall:'1577-1112', fax:'가상번호 부여', gongsi:'https://hanalife.co.kr/anm/product/allProduct.do?status=on', erp:'https://ga.hanalife.co.kr/' },
  // ───── 손해보험 ─────
  { type:'nonlife', slug:'meritz-fire', name:'메리츠화재', call:'1566-7711', incall:'1577-7711', fax:'0505-021-3400', gongsi:'https://www.meritzfire.com/disclosure/product-announcement/product-list.do', erp:'https://nsso.meritzfire.com/LoginServer/loginFormPageMulti.jsp' },
  { type:'nonlife', slug:'hanwha-general', name:'한화손해보험', call:'1566-8000', incall:'1670-1882', fax:'콜센터 청구', gongsi:'https://www.hwgeneralins.com/notice/ir/product-ing01.do', erp:'https://portal.hwgeneralins.com/nls3/fcs' },
  { type:'nonlife', slug:'lotte-insurance', name:'롯데손해보험', call:'1588-3344', incall:'1600-5182', fax:'0507-333-9999', gongsi:'https://lotteins.co.kr/web/C/D/H/cdh190.jsp', erp:'https://lottero.lotteins.co.kr/ncrmwebroot/webfw/html/nawlogon.jsp' },
  { type:'nonlife', slug:'heungkuk-fire', name:'흥국화재', call:'1688-1688', incall:'1688-6997', fax:'0504-800-1300', gongsi:'https://www.heungkukfire.co.kr/FRW/announce/insGoodsGongsiSale.do', erp:'https://sales.heungkukfire.co.kr/#/login' },
  { type:'nonlife', slug:'samsung-fire', name:'삼성화재', call:'1588-5114', incall:'1566-0553', fax:'0505-162-0872', gongsi:'https://www.samsungfire.com/vh/page/VH.HPIF0103.do', erp:'https://login.samsungfire.com/nl/p/login/ui/SPGENLP00000' },
  { type:'nonlife', slug:'hyundai-marine', name:'현대해상', call:'1588-5656', incall:'1577-3223', fax:'0507-774-6060', gongsi:'https://www.hi.co.kr/serviceAction.do?view=bin/PA/03/HHPA03010M', erp:'https://sp.hi.co.kr/websquare/websquare.html?w2xPath=/common/xml/Login.xml' },
  { type:'nonlife', slug:'kb-insurance', name:'KB손해보험', call:'1544-0114', incall:'1544-0119', fax:'0505-136-6500', gongsi:'https://www.kbinsure.co.kr/CG802030001.ec', erp:'https://nsales.kbinsure.co.kr/eus/ch/ch_index.jsp' },
  { type:'nonlife', slug:'db-insurance', name:'DB손해보험', call:'1588-0100', incall:'1566-0757', fax:'0505-181-4862', gongsi:'https://www.idbins.com/FWMAIV1534.do', erp:'https://www.mdbins.com/chrome.html' },
  { type:'nonlife', slug:'aig-insurance', name:'AIG손해보험', call:'1544-2792', incall:'1544-2792', fax:'02-2011-4607', gongsi:'https://www.aig.co.kr/wo/dpwot001.html', erp:'https://sso.aig.co.kr/gaLogin/gaLogin.jsp' },
  { type:'nonlife', slug:'lina-nonlife', name:'라이나손해보험', call:'1566-5800', incall:'1833-9513', fax:'02-2127-2308', gongsi:'https://www.chubb.com/kr-kr/disclosure/product.html', erp:'https://ga.linagi.com/html/gap/GA/GAZ911M0.html' },
  { type:'nonlife', slug:'nh-fire', name:'농협손해보험', call:'1644-9000', incall:'1644-9600', fax:'0505-060-7000', gongsi:'https://www.nhfire.co.kr/announce/productAnnounce/retrieveInsuranceProductsAnnounce.nhfire', erp:'https://www.nhfire.co.kr/fc/fd.nhfire' },
  { type:'nonlife', slug:'hana-insurance', name:'하나손해보험', call:'1566-3000', incall:'1660-4590', fax:'0505-170-0765', gongsi:'https://www.hanainsure.co.kr/w/disclosure/product/saleProduct', erp:'https://sfa.saleshana.com/wq/login' },
];

export const INSURER_MAP = Object.fromEntries(INSURERS.map(i => [i.slug, i]));
export const TYPE_LABEL = { life: '생명보험', nonlife: '손해보험' };

// Keep the established slug -> exact alias list shape for company aggregation.
export const INSURER_ALIASES = {
  'shinhan-life':['신한라이프','신한','신한생명'], 'miraeasset-life':['미래에셋생명','미래에셋'],
  'hanwha-life':['한화생명','한화'], 'samsung-life':['삼성생명','삼성'],
  'kyobo-life':['교보생명','교보'], 'heungkuk-life':['흥국생명','흥국'],
  'fubon-hyundai-life':['푸본현대생명','푸본현대'], 'im-life':['IM라이프','IM생명','DGB생명'],
  'kdb-life':['KDB생명','KDB'], 'kb-life':['KB라이프','KB생명'], 'db-life':['DB생명'],
  'tongyang-life':['동양생명','동양'], 'nh-life':['농협생명','NH생명'], 'abl-life':['ABL생명','ABL'],
  'cardif-life':['카디프생명','카디프'], 'aia-life':['AIA생명','AIA'],
  'metlife-life':['메트라이프생명','메트라이프'], 'ibk-pension':['IBK연금보험','IBK연금'],
  'chubb-life':['처브라이프','처브'], 'hana-life':['하나생명'],
  'meritz-fire':['메리츠화재','메리츠'], 'hanwha-general':['한화손해보험','한화손보'],
  'lotte-insurance':['롯데손해보험','롯데손보'], 'heungkuk-fire':['흥국화재'],
  'samsung-fire':['삼성화재'], 'hyundai-marine':['현대해상','현대'],
  'kb-insurance':['KB손해보험','KB손보'], 'db-insurance':['DB손해보험','DB손보','DB'],
  'aig-insurance':['AIG손해보험','AIG손보','AIG'], 'lina-nonlife':['라이나손해보험','라이나손보','라이나'],
  'nh-fire':['농협손해보험','농협손보','NH손보'], 'hana-insurance':['하나손해보험','하나손보'],
};

export function insurerNames(slug) {
  const ins = INSURER_MAP[slug];
  if (!ins) return [];
  return [...new Set([ins.name, ...(INSURER_ALIASES[slug] || [])].filter(Boolean))];
}

export function insurerSlugForName(name) {
  const value = String(name ?? '').normalize('NFC').trim();
  if (!value) return null;
  const matches = new Set();
  for (const insurer of INSURERS) {
    if (String(insurer.name ?? '').normalize('NFC').trim() === value) matches.add(insurer.slug);
  }
  for (const [slug, aliases] of Object.entries(INSURER_ALIASES)) {
    if (aliases.some((alias) => String(alias ?? '').normalize('NFC').trim() === value)) matches.add(slug);
  }
  return matches.size === 1 ? [...matches][0] : null;
}
