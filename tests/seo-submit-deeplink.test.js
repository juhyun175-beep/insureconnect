const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadSsrHub(rel, promoRemaining) {
  const source = fs
    .readFileSync(path.join(root, rel), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/\bexport\s+/g, '');
  const script = `${source}\nthis.__exports = { onRequestGet };`;
  const sandbox = {
    Response,
    URLSearchParams,
    console,
    seoCtaFooter: () => '<footer data-seo-cta-footer></footer>',
    seoShareBar: () => '<div data-share-bar></div>',
    getPromoRemaining: async () => ({ enabled: true, remaining: promoRemaining, limit: 30 }),
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: rel });
  return sandbox.__exports;
}

async function renderHub(rel, promoRemaining) {
  const { onRequestGet } = loadSsrHub(rel, promoRemaining);
  const env = {
    DB: {
      prepare() {
        return { all: async () => ({ results: [] }) };
      },
    },
  };
  const res = await onRequestGet({ env });
  return res.text();
}

module.exports = (async () => {
  {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert(html.includes('function openPostFromURL()'), 'home page should define ?post= submit deeplink handler');
    assert(html.includes("if (post === 'recruit' || post === 'lecture' || post === 'meetup')"), 'handler should accept only posting modes');
    assert(html.includes('setTimeout(() => openSubmitModal(post), 300)'), 'handler should wait briefly for modal DOM before opening');
    assert(html.includes('openRecruitFromURL(); openLectureFromURL(); openMeetupFromURL(); openPostFromURL(); openChatFromURL();'), 'DOMContentLoaded init should include post deeplink');
    assert(html.includes('openMeetupFromURL();\n      openPostFromURL();\n      openChatFromURL();'), 'already-loaded init should include post deeplink');
    assert(!html.includes("로그인 후 공고를 등록할 수 있어요."), 'anonymous posting fallback should not route submitters to Kakao login');
    assert(html.includes('postGateBypass'), 'anonymous posting deeplink should hide the login gate so the submit modal is visible');
  }

  for (const [rel, mode, promoCopy, fallbackCopy] of [
    ['functions/recruit/index.js', 'recruit', '등록비 0원 · 선착순 7건 남음', '＋ 구인 담당자세요? 공고 등록 →'],
    ['functions/lecture/index.js', 'lecture', '등록비 0원 · 선착순 7건 남음', '＋ 강사·교육기관이세요? 강의 공고 등록하기 →'],
    ['functions/meeting/index.js', 'meetup', '등록비 0원 · 선착순 7건 남음', '＋ 모임 주최자세요? 모임 공고 등록하기 →'],
  ]) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    assert(source.includes("import { getPromoRemaining } from '../_lib/promo.js';"), `${rel} should import promo status helper`);
    assert(source.includes('const promo = await getPromoRemaining(env);'), `${rel} should load promo remaining in the handler`);
    assert(source.includes(`href="/?post=${mode}"`), `${rel} should send registration CTA to anonymous submit deeplink`);
    assert(!source.includes('href="/api/auth/kakao/login">＋'), `${rel} registration CTA should not require Kakao login`);

    const promoHtml = await renderHub(rel, 7);
    assert(promoHtml.includes(`href="/?post=${mode}"`), `${rel} rendered CTA should use ?post=${mode}`);
    assert(promoHtml.includes(promoCopy), `${rel} rendered CTA should show promo remaining count`);

    const exhaustedHtml = await renderHub(rel, 0);
    assert(exhaustedHtml.includes(fallbackCopy), `${rel} rendered CTA should remove free-copy when promo is exhausted`);
    assert(!exhaustedHtml.includes('선착순 0건'), `${rel} should not render zero remaining as a promo`);
  }

  {
    const recruit = fs.readFileSync(path.join(root, 'functions/recruit/index.js'), 'utf8');
    assert(!recruit.includes('구인 담당자는 무료로 공고를 등록할 수 있습니다.'), 'recruit meta description should not promise free registration');
    assert(recruit.includes('구인 담당자는 직접 공고를 등록할 수 있습니다.'), 'recruit meta description should use price-neutral copy');
  }

  {
    const footer = fs.readFileSync(path.join(root, 'functions/_lib/seo-cta.js'), 'utf8');
    assert(footer.includes('<a class="primary" href="/api/auth/kakao/login">'), 'footer should keep Kakao signup entry');
    assert(footer.includes('<a href="/?post=recruit">📤 공고 등록</a>'), 'footer should add anonymous posting entrypoint');
  }

  console.log('seo submit deeplink tests passed');
})();

if (require.main === module) {
  module.exports.catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
