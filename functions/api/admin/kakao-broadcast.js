/**
 * v2.5.0: 카카오톡 공고 알림 발송 — POST /api/admin/kakao-broadcast (admin)
 *   body: { title, body, url?, image? }  → alert_optin=1 회원 전체에게 카톡 메모 발송
 * v2.6.9: 카톡 미리보기 이미지 = 링크의 첫 표지(og:image) 자동 사용 (image 직접 지정 시 우선)
 */
import { json, error, handle, corsPreflight } from '../../_lib/http.js';
import { verifyAdmin, unauthorized } from '../../_lib/admin.js';
import { optinCount, enqueueBroadcast, drainKakaoQueue } from '../../_lib/kakao-queue.js';
import { SITE } from '../../_lib/auth.js';

export const onRequestOptions = () => corsPreflight();

/** 상대경로 → 절대 URL */
function toAbs(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return SITE + u;
  return SITE + '/' + u;
}

/** 링크 페이지에서 og:image(첫 표지)를 추출 → 절대 URL 반환 (실패 시 '') */
async function fetchOgImage(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KakaoTalk-Scrap/1.0; +InsureConnect)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return '';
    const html = (await res.text()).slice(0, 200000);
    const pick = (re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
    const img =
      pick(/<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      pick(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i) ||
      pick(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    return img ? toAbs(img) : '';
  } catch (_) {
    return '';
  }
}

export const onRequestPost = async ({ env, request }) => handle(async () => {
  if (!verifyAdmin(request, env)) return unauthorized();
  if (!env.KAKAO_REST_KEY) return error('카카오 설정이 필요합니다.', 503);

  let body = {};
  try { body = await request.json(); } catch (_) { return error('Invalid JSON'); }
  const title = String(body?.title || '').trim();
  const desc = String(body?.body || '').trim();
  const url = toAbs(body?.url ? String(body.url).trim() : '') || SITE;
  let image = toAbs(body?.image ? String(body.image).trim() : '');
  if (!title || !desc) return error('제목과 내용을 입력해주세요.');

  // 표지 이미지 미지정 시 → 링크의 og:image(첫 표지)를 미리보기로 사용
  // (없거나 실패하면 sendMemoToMember 가 로고로 폴백)
  if (!image && url) {
    image = await fetchOgImage(url);
  }

  // v2.123.0: 즉시 전량 순차발송(서브리퀘스트 한도·수십초 응답) → 대기열 등록 + 인라인 1청크.
  //   나머지는 cron 워커(5분)·관리자 대시보드 폴링 킥이 자동 드레인.
  const total = await optinCount(env);
  if (total === 0) {
    return json({ ok: true, total: 0, queued: 0, sent: 0, failed: 0, revoked: 0, remaining: 0, image: image || `${SITE}/logo-full.png`, url });
  }
  const batchKey = `broadcast:${Date.now()}`;
  await enqueueBroadcast(env, { title, description: desc, url, image }, batchKey);
  const d = await drainKakaoQueue(env, 20).catch(() => ({ sent: 0, failed: 0, revoked: 0, remaining: total }));
  return json({
    ok: true, total, queued: total, batch_key: batchKey,
    sent: d.sent, failed: d.failed, revoked: d.revoked, remaining: Math.max(0, d.remaining),
    image: image || `${SITE}/logo-full.png`, url,
  });
});
