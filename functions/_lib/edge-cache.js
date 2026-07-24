import { json } from './http.js';

/**
 * Cache a generated JSON response in the local Cloudflare data-center cache.
 *
 * Pages Functions still execute on a cache hit, but D1 work is skipped. The
 * synthetic GET key also allows POST-compatible endpoints to share the same
 * cached payload safely. This helper is only for public, non-personalized data.
 */
export async function edgeCachedJson(ctx, key, ttlSeconds, producer) {
  const makeResponse = (data) => json(data, 200, {
    'Cache-Control': `public, max-age=0, s-maxage=${ttlSeconds}`,
  });

  if (!ctx?.request || typeof caches === 'undefined' || !caches.default) {
    return makeResponse(await producer());
  }

  const origin = new URL(ctx.request.url).origin;
  const cacheUrl = new URL(`/__ic-edge-cache/${encodeURIComponent(key)}`, origin);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (_) {
    // Cache API availability must never make the underlying stats endpoint fail.
  }

  const response = makeResponse(await producer());
  try {
    const write = caches.default.put(cacheKey, response.clone()).catch(() => {});
    if (typeof ctx.waitUntil === 'function') ctx.waitUntil(write);
    else await write;
  } catch (_) {
    // Return the freshly generated response even if the cache write fails.
  }
  return response;
}
