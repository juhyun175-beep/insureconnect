/**
 * v2.1.70: 유입 경로 분류 유틸 (referrer host → 채널, UA → 기기)
 */
export function sourceFromReferrer(ref) {
  let host = '';
  try { host = ref ? new URL(ref).hostname.toLowerCase() : ''; } catch (_) { host = String(ref || '').toLowerCase(); }
  if (!host) return { source: '직접/앱', host: '' };
  if (host.includes('insureconnect.co.kr')) return { source: '내부 이동', host };
  // AI 답변 엔진(AEO) — google 계열보다 먼저 검사 (gemini.google.com 등)
  if (host.includes('chatgpt') || host.includes('openai'))   return { source: 'ChatGPT', host };
  if (host.includes('perplexity'))                            return { source: 'Perplexity', host };
  if (host.includes('gemini.google') || host.includes('bard')) return { source: 'Gemini', host };
  if (host.includes('claude.ai') || host.includes('anthropic')) return { source: 'Claude', host };
  if (host.includes('copilot'))                               return { source: 'Copilot', host };
  if (host.includes('you.com'))                               return { source: 'You.com', host };
  if (host.includes('google'))                       return { source: 'Google', host };
  if (host.includes('blog.naver'))                   return { source: '네이버블로그', host };
  if (host.includes('cafe.naver'))                   return { source: '네이버카페', host };
  if (host.includes('post.naver'))                   return { source: '네이버포스트', host };
  if (host.includes('kin.naver'))                    return { source: '네이버지식iN', host };
  if (host.includes('naver'))                        return { source: 'Naver', host };
  if (host.includes('daum') || host.includes('kakao')) return { source: host.includes('kakao') ? 'KakaoTalk' : 'Daum', host };
  if (host.includes('bing'))                         return { source: 'Bing', host };
  if (host.includes('instagram'))                    return { source: 'Instagram', host };
  if (host.includes('facebook') || host === 'l.facebook.com' || host.includes('fb.')) return { source: 'Facebook', host };
  if (host.includes('youtube') || host.includes('youtu.be')) return { source: 'YouTube', host };
  if (host.includes('t.co') || host.includes('twitter') || host.includes('x.com')) return { source: 'X(트위터)', host };
  if (host.includes('band.us') || host.includes('band.'))    return { source: 'Band', host };
  if (host.includes('tistory'))                      return { source: 'Tistory', host };
  return { source: '기타', host };
}

export function deviceFromUA(ua) {
  const s = String(ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s) || (/android/.test(s) && !/mobile/.test(s))) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) return 'mobile';
  return 'desktop';
}
