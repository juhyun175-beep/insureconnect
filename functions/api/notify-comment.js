export async function onRequestPost(context) {
  const { WEB3FORMS_KEY } = context.env;

  if (!WEB3FORMS_KEY) {
    return new Response(JSON.stringify({ error: 'WEB3FORMS_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try { body = await context.request.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { post_title = '', author_name = '익명', comment = '' } = body;

  const emailRes = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      subject: `[InsureConnect] 새 댓글 알림 — ${post_title}`,
      from_name: 'InsureConnect 알림',
      message: `📬 보험지식 포스트에 새 댓글이 달렸습니다.\n\n포스트: ${post_title}\n작성자: ${author_name}\n\n댓글 내용:\n${comment}\n\n사이트: https://insureconnect.co.kr`
    })
  });

  const result = await emailRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}
