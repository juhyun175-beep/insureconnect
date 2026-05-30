/**
 * v2.1.61: SEO 게시판(SSR) 공통 전환 푸터
 *   - 검색 유입 방문자를 InsureConnect 본 서비스/커뮤니티로 유도 (전환 최적화)
 *   - 자체 <style> 포함 — 각 SSR 페이지에 그대로 삽입
 */
export function seoCtaFooter(SITE) {
  return `
<style>
.seo-cta{max-width:760px;margin:0 auto 40px;padding:0 16px}
.seo-cta-inner{background:linear-gradient(135deg,#1a3de8,#4a70f5);color:#fff;border-radius:16px;padding:28px 26px;text-align:center}
.seo-cta-title{font-size:19px;font-weight:800;margin-bottom:6px;letter-spacing:-0.02em}
.seo-cta-desc{font-size:14px;opacity:.92;margin-bottom:18px;line-height:1.6}
.seo-cta-links{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.seo-cta-links a{display:inline-block;background:rgba(255,255,255,0.16);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:10px;transition:background .15s}
.seo-cta-links a:hover{background:rgba(255,255,255,0.28)}
.seo-cta-links a.primary{background:#fff;color:#1a3de8}
.seo-foot{max-width:760px;margin:0 auto 32px;padding:0 16px;text-align:center;font-size:12px;color:#9ca3af}
.seo-foot a{color:#6b7280;text-decoration:none}
@media(max-width:640px){.seo-cta{padding:0}.seo-cta-inner{border-radius:0}}
</style>
<footer class="seo-cta" aria-label="InsureConnect 바로가기">
  <div class="seo-cta-inner">
    <div class="seo-cta-title">보험설계사를 위한 통합 정보 허브</div>
    <div class="seo-cta-desc">보험사 전산·청구서류·소식지·실무도구·채용공고를 한 곳에서.<br>InsureConnect에서 실무에 바로 쓰는 정보를 만나보세요.</div>
    <div class="seo-cta-links">
      <a class="primary" href="/">🏠 InsureConnect 홈</a>
      <a href="/insurance">📚 보험 정보 게시판</a>
      <a href="https://open.kakao.com/o/gd0a5Cjh" target="_blank" rel="noopener nofollow">💬 설계사 오픈채팅</a>
    </div>
  </div>
</footer>
<div class="seo-foot">
  © InsureConnect · <a href="/about.html">서비스 소개</a> · <a href="/disclaimer.html">면책조항</a> · <a href="/privacy.html">개인정보처리방침</a>
</div>`;
}
