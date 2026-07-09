const HOST = 'insureconnect.co.kr';
const ORIGIN = `https://${HOST}`;
const INDEXNOW_KEY = 'baec816b6c916fb26e8f3258def82499535482f7689db1fd76c0f279a9b5a818';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

export const INDEXNOW_KEY_LOCATION = `${ORIGIN}/${INDEXNOW_KEY}.txt`;

function normalizeUrl(url) {
  const u = new URL(String(url || '').trim(), ORIGIN);
  u.hash = '';
  if (u.protocol !== 'https:' || u.hostname !== HOST) {
    throw new Error(`IndexNow URL must be under ${ORIGIN}`);
  }
  return u.href;
}

export async function submitUrls(env = {}, urls = []) {
  const list = Array.isArray(urls) ? urls : [urls];
  const urlList = [...new Set(list.filter(Boolean).map(normalizeUrl))];
  if (!urlList.length) throw new Error('No URLs to submit');
  if (urlList.length > 10000) throw new Error('IndexNow supports up to 10000 URLs per request');

  const key = env.INDEXNOW_KEY || INDEXNOW_KEY;
  const payload = {
    host: HOST,
    key,
    keyLocation: env.INDEXNOW_KEY_LOCATION || `${ORIGIN}/${key}.txt`,
    urlList,
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => '');
  return {
    ok: res.ok,
    status: res.status,
    submitted: urlList.length,
    urls: urlList,
    keyLocation: payload.keyLocation,
    checkUrl: `https://www.bing.com/indexnow?url=${encodeURIComponent(urlList[0])}&key=${encodeURIComponent(payload.key)}`,
    response: text.slice(0, 1000),
  };
}
