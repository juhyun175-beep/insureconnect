/* PWA 비활성화 — 자체 등록 해제 + 모든 캐시 삭제 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch (_) {}
  try { await self.registration.unregister(); } catch (_) {}
  try {
    const all = await self.clients.matchAll({ type: 'window' });
    for (const c of all) {
      try { c.navigate(c.url); } catch (_) {}
    }
  } catch (_) {}
})()));
/* fetch handler 없음 — 옛 SW의 fetch hijack과 달리 모든 요청은 브라우저 기본 동작 */
