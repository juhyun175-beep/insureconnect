const HOST = 'insureconnect.co.kr';
const ORIGIN = `https://${HOST}`;
const INDEXNOW_KEY = 'baec816b6c916fb26e8f3258def82499535482f7689db1fd76c0f279a9b5a818';
const KEY_PATTERN = /^[a-fA-F0-9-]{8,128}$/;
const CHUNK_SIZE = 100;
const RETRY_DELAYS = [500, 1500];

export const ENDPOINTS = ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow'];
export const INDEXNOW_KEY_LOCATION = `${ORIGIN}/${INDEXNOW_KEY}.txt`;

function normalizeUrl(url) {
  const u = new URL(String(url || '').trim(), ORIGIN);
  u.hash = '';
  if (u.protocol !== 'https:' || u.hostname !== HOST) {
    throw new Error(`IndexNow URL must be under ${ORIGIN}`);
  }
  return u.href;
}

function resolveKey(env) {
  const configured = String(env.INDEXNOW_KEY || '').trim();
  if (!configured) return { key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, keyWarning: '' };
  if (!KEY_PATTERN.test(configured)) {
    return {
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      keyWarning: 'INDEXNOW_KEY 형식이 올바르지 않아 내장 키로 대체했습니다. Pages 시크릿을 확인하세요.',
    };
  }
  return {
    key: configured,
    keyLocation: env.INDEXNOW_KEY_LOCATION || `${ORIGIN}/${configured}.txt`,
    keyWarning: '',
  };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isSuccessStatus = (status) => status === 200 || status === 202;
const isRetryableStatus = (status) => status === 0 || status === 429 || status >= 500;

async function submitChunk(endpoint, payload, chunk, sleep) {
  let status = 0;
  let response = '';
  let retries = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      status = res.status;
      response = (await res.text().catch(() => '')).slice(0, 1000);
    } catch (error) {
      status = 0;
      response = String(error?.message || error).slice(0, 1000);
    }

    if (isSuccessStatus(status)) {
      return { endpoint, chunk, status, ok: true, retries, response };
    }
    if (!isRetryableStatus(status) || attempt === 2) break;
    await sleep(RETRY_DELAYS[attempt]);
    retries += 1;
  }

  return { endpoint, chunk, status, ok: false, retries, response };
}

export async function submitUrls(env = {}, urls = [], options = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  const urlList = [...new Set(list.filter(Boolean).map(normalizeUrl))];
  if (!urlList.length) throw new Error('No URLs to submit');
  if (urlList.length > 10000) throw new Error('IndexNow supports up to 10000 URLs per submission');

  const { key, keyLocation, keyWarning } = resolveKey(env);
  const sleep = typeof options.sleep === 'function' ? options.sleep : delay;
  const chunks = [];
  for (let i = 0; i < urlList.length; i += CHUNK_SIZE) chunks.push(urlList.slice(i, i + CHUNK_SIZE));

  const attempts = [];
  const succeededUrls = [];
  const failedUrls = [];
  let lastStatus = 0;
  let lastResponse = '';
  let successStatus = 0;
  let successResponse = '';

  for (let index = 0; index < chunks.length; index += 1) {
    const chunkUrls = chunks[index];
    const payload = { host: HOST, key, keyLocation, urlList: chunkUrls };
    let chunkSucceeded = false;

    for (const endpoint of ENDPOINTS) {
      const result = await submitChunk(endpoint, payload, index + 1, sleep);
      attempts.push(result);
      lastStatus = result.status;
      lastResponse = result.response;
      if (result.ok) {
        chunkSucceeded = true;
        successStatus = result.status;
        successResponse = result.response;
        break;
      }
    }

    (chunkSucceeded ? succeededUrls : failedUrls).push(...chunkUrls);
  }

  const succeeded = succeededUrls.length;
  const failed = failedUrls.length;
  return {
    ok: succeeded > 0,
    complete: failed === 0,
    status: successStatus || lastStatus,
    submitted: urlList.length,
    succeeded,
    failed,
    urls: urlList,
    succeededUrls,
    failedUrls,
    attempts,
    keyLocation,
    keyWarning,
    checkUrl: `https://www.bing.com/indexnow?url=${encodeURIComponent(urlList[0])}&key=${encodeURIComponent(key)}`,
    response: successStatus ? successResponse : lastResponse,
  };
}
