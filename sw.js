/* v2.1.43: PWA Push 알림 전용 Service Worker
   - 캐시·fetch 가로채기 일절 없음 (옛 PWA 사고 방지)
   - install / activate: 즉시 활성화
   - push: 서버에서 보낸 알림 표시
   - notificationclick: 지정 URL 열거나 기존 탭 포커스 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil((async () => {
  try { await self.clients.claim(); } catch (_) {}
  // 옛 캐시는 한 번 청소 (이전 PWA 잔재 제거)
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch (_) {}
})()));

/* push 이벤트 — 서버에서 발송된 메시지 수신 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    try { data = { title: 'InsureConnect', body: event.data ? event.data.text() : '' }; } catch (_) {}
  }

  const title = data.title || 'InsureConnect';
  const options = {
    body: data.body || '새 콘텐츠가 등록되었습니다',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    image: data.image,
    data: {
      url: data.url || '/',
      type: data.type || 'general',
      id: data.id || null,
    },
    tag: data.tag || 'ic-general',
    renotify: data.renotify !== false,
    requireInteraction: data.requireInteraction || false,
    silent: false,
    vibrate: data.vibrate || [120, 60, 120],
    actions: data.actions || [
      { action: 'open', title: '확인하기' }
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* 알림 클릭 — 지정 URL 열거나 기존 탭 포커스 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // 이미 InsureConnect 탭 열려있으면 포커스 + 해당 URL로 이동
    for (const client of allClients) {
      const u = new URL(client.url);
      if (u.origin === self.location.origin) {
        try { await client.focus(); } catch (_) {}
        try { await client.navigate(absoluteUrl); } catch (_) {}
        return;
      }
    }
    // 없으면 새 창
    if (self.clients.openWindow) await self.clients.openWindow(absoluteUrl);
  })());
});

/* push 구독 만료 시 자동 재구독 시도 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      // 새 구독으로 서버 갱신 — 페이지 로드 시 다시 시도됨
      // (서비스워커 자체 재구독은 VAPID 공개키 필요)
    } catch (_) {}
  })());
});
