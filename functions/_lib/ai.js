/**
 * v2.2.0: AI 보험비서 — LLM 프로바이더 추상화 + 안전 프롬프트
 *   - 키는 서버 시크릿(OPENAI_API_KEY 또는 ANTHROPIC_API_KEY) — 클라이언트 노출 절대 금지
 *   - 있는 키 자동 선택. 둘 다 없으면 미설정 안내.
 */

const SAFETY = `당신은 한국 보험설계사의 실무를 돕는 보조 AI "인슈어커넥트 AI 보험비서"입니다.
규칙:
- 한국어로, 정확하고 일반적인 원칙 위주로 답합니다.
- 특정 보험사의 현재 보험료·보장금액·수치를 지어내지 않습니다. 모르면 "약관·보험사 안내 확인 필요"로 안내합니다.
- 단정적·과장된 수익/보장 표현, 허위·오인 소지 표현을 피합니다(보험 광고·적합성 원칙 의식).
- 보험·설계사 실무와 무관하거나 부적절·위법한 요청은 정중히 거절합니다.
- 답변 끝에 필요 시 "구체적 사항은 약관과 보험사 안내가 우선합니다."를 덧붙입니다.`;

export const AI_MODES = {
  consult: {
    label: '상담 스크립트',
    placeholder: '고객 상황을 적어주세요. 예) 35세 가장, 자녀 2명, 실손만 있고 사망보장 없음. 종신보험 상담 예정.',
    system: SAFETY + `\n[작업] 입력한 고객 상황을 바탕으로 실제 상담에 쓸 수 있는 자연스러운 상담 스크립트를 작성하세요. 흐름: 공감 → 니즈 환기 → 핵심 질문 → 보장 제안 방향. 단정 금지, 고객 적합성 우선.`,
  },
  marketing: {
    label: '마케팅 문구',
    placeholder: '상품/타깃/채널을 적어주세요. 예) 4050 자영업자 대상 건강보험, 카카오톡 채널용 홍보 문구.',
    system: SAFETY + `\n[작업] 입력한 상품·타깃·채널에 맞는 홍보 문구를 2~3가지 톤으로 작성하세요. 과장·허위·단정적 수익 표현 금지. 행동 유도(상담 문의) 포함.`,
  },
  coverage: {
    label: '보장분석 요약',
    placeholder: '고객의 현재 보장 내용을 붙여넣어 주세요. 예) 실손, 암진단비 3000만, 종신 1억 ...',
    system: SAFETY + `\n[작업] 붙여넣은 보장 내용을 고객이 이해하기 쉽게 요약하고, 일반적으로 점검하면 좋은 보장 빈틈 포인트를 정리하세요. 확정 판단 대신 "확인 필요" 관점으로. 표/리스트 활용.`,
  },
  explain: {
    label: '보험 개념 설명',
    placeholder: '궁금한 보험 용어·제도·개념을 물어보세요. 예) 무해지환급형이 뭔가요? 실손 4세대 자기부담은?',
    system: SAFETY + `\n[작업] 보험 용어·제도·개념을 쉽고 정확하게 설명하세요. 핵심 → 예시 → 주의점 순으로, 중립적으로.`,
  },
};

export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${ip}|${salt}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function aiProvider(env) {
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

/** LLM 호출 — {ok, text, error} */
export async function callLLM(env, system, user, { maxTokens = 900 } = {}) {
  const provider = aiProvider(env);
  if (!provider) return { ok: false, error: 'no_key' };

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: String(env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: maxTokens, temperature: 0.6,
        }),
      });
      if (!res.ok) return { ok: false, error: `openai_${res.status}` };
      const d = await res.json();
      const text = d?.choices?.[0]?.message?.content?.trim();
      return text ? { ok: true, text } : { ok: false, error: 'empty' };
    }
    // anthropic
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
        max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return { ok: false, error: `anthropic_${res.status}` };
    const d = await res.json();
    const text = (d?.content || []).map(c => c.text || '').join('').trim();
    return text ? { ok: true, text } : { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, error: 'fetch_fail' };
  }
}

/** 비전(이미지) 호출 — OpenAI gpt-4o(-mini). images: dataURL 배열. {ok, text, error} */
export async function callVision(env, system, userText, images, { maxTokens = 4000, model } = {}) {
  if (!env.OPENAI_API_KEY) return { ok: false, error: 'no_key' };
  const content = [{ type: 'text', text: userText }];
  for (const img of (images || [])) content.push({ type: 'image_url', image_url: { url: img, detail: 'high' } });
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: String(model || env.OPENAI_VISION_MODEL || 'gpt-4o-mini').trim(),  // trim: 시크릿 값 줄바꿈/공백 방지
        messages: [{ role: 'system', content: system }, { role: 'user', content }],
        max_completion_tokens: maxTokens,  // 2026 모델: max_tokens 대신 / temperature 미지정(기본값)
      }),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 400); } catch (_) {}
      return { ok: false, error: `openai_${res.status}`, detail };
    }
    const d = await res.json();
    const text = d?.choices?.[0]?.message?.content?.trim();
    return text ? { ok: true, text } : { ok: false, error: 'empty' };
  } catch (e) { return { ok: false, error: 'exception' }; }
}
