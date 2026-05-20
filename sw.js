/* PWA 임시 비활성화 — 옛 캐시로 인한 무한 로딩 문제 해결 후 재활성화 예정 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil((async () => {
  // 모든 캐시 삭제
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch (_) {}
  // 자기 자신(SW) 등록 해제
  try { await self.registration.unregister(); } catch (_) {}
  // 모든 열린 클라이언트 새로고침 → 새 콘텐츠 즉시 적용
  const all = await self.clients.matchAll({ type: 'window' });
  for (const c of all) {
    try { c.navigate(c.url); } catch (_) {}
  }
})()));

// fetch는 절대 가로채지 않음 (브라우저 기본 동작)
