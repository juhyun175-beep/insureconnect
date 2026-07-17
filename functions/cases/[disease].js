import { caseDiseaseUrl, diseaseFromParam, CASES_INDEX_WHERE, isCasesIndexable } from '../_lib/cases-seo.js';
import { insurerSlugForName } from '../_lib/insurers.js';
import { seoCtaFooter } from '../_lib/seo-cta.js';
const SITE='https://insureconnect.co.kr';
const esc=(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const ld=(o)=>`<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`;
const ageBand=(age)=>{ const n=Number(age); return Number.isFinite(n)&&n>0 ? `${Math.floor(n/10)*10}대` : '비공개'; };

export async function onRequestGet({ params, env }) {
  const disease=diseaseFromParam(params.disease);
  const rows=(await env.DB.prepare(`SELECT category, insurer, gender, age, elapsed_period, join_condition, result, summary, reliability, created_at FROM ic_insurance_cases WHERE ${CASES_INDEX_WHERE} AND TRIM(COALESCE(disease,'')) = ? ORDER BY reliability DESC, created_at DESC`).bind(disease).all()).results || [];
  if (!rows.length) return new Response('Not found',{status:404});
  const underwriting=rows.filter(r=>r.category==='underwrite'||r.category==='disclosure').length;
  const indexable=isCasesIndexable({count:rows.length,underwriting});
  const insurers=[...new Set(rows.map(r=>r.insurer).filter(Boolean))];
  const title=`${disease} 보험 가입·고지·보상 사례 ${rows.length}건 | InsureConnect`;
  const desc=`${disease} 관련 승인 보험 사례 ${rows.length}건과 ${insurers.length}개 보험사의 가입·고지·보상 정보를 확인하세요. 개인별 심사 결과는 달라질 수 있습니다.`.slice(0,160);
  const section=(cat,label)=>{const list=rows.filter(r=>cat.includes(r.category)); return list.length?`<section><h2>${label}</h2><ul>${list.map(r=>`<li><strong>${esc(r.result||'사례')}</strong> · ${esc(r.insurer||'보험사 미상')} · ${esc(ageBand(r.age))} · ${esc(r.elapsed_period||'')} · ${esc(r.join_condition||'')} · ${esc(r.summary||'')} (${esc(r.reliability)})</li>`).join('')}</ul></section>`:'';};
  const url=`${SITE}${caseDiseaseUrl(disease)}`;
  const crumb={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:SITE},{'@type':'ListItem',position:2,name:'질병별 사례',item:`${SITE}/cases`},{'@type':'ListItem',position:3,name:disease,item:url}]};
  const collection={'@context':'https://schema.org','@type':'CollectionPage',name:title,url,mainEntity:{'@type':'ItemList',numberOfItems:rows.length,itemListElement:rows.map((r,i)=>({'@type':'ListItem',position:i+1,name:r.result||'보험 사례'}))}};
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="${indexable?'index,follow':'noindex,follow'}">${indexable?`<link rel="canonical" href="${url}">`:''}${ld(crumb)}${ld(collection)}</head><body><nav><a href="/">홈</a> &gt; <a href="/cases">질병별 사례</a> &gt; ${esc(disease)}</nav><main><h1>${esc(title)}</h1>${section(['underwrite'],'인수심사')}${section(['disclosure'],'고지')}${section(['claim'],'보상')}<p>유사 사례가 있어도 개인별 심사 결과는 달라질 수 있습니다.</p><p><a href="/">사례 제출하기: 제출 +10P · 승인 +20P</a></p></main>${seoCtaFooter(SITE)}</body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300, s-maxage=300'}});
}
