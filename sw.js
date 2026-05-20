const CACHE = 'ic-pwa-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  // 이전 캐시 전부 삭제 (admin 등이 잘못 캐시됐을 가능성 제거)
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  await clients.claim();
})()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // 관리자 페이지와 모든 API/Supabase 요청은 SW가 절대 가로채지 않음
  const url = new URL(e.request.url);
  if (url.pathname === '/admin' ||
      url.pathname === '/admin.html' ||
      url.pathname.startsWith('/admin/') ||
      url.hostname.endsWith('.supabase.co') ||
      url.pathname.startsWith('/api/')) {
    return; // 브라우저 기본 동작 (네트워크 직행)
  }

  // 일반 navigation: 네트워크 우선, 실패 시에도 fallback 하지 않음 (오류 명시)
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request));
  }
});
