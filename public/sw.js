// Bump this version whenever offline.html changes.
const CACHE_PREFIX = `csdemo-offline:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Fetch only the public, standalone fallback without cookies or credentials.
    const response = await fetch(OFFLINE_URL, { credentials: 'omit', cache: 'no-store', redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Offline page could not be loaded');
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.put(OFFLINE_URL, response);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  // API, authentication, non-navigation and cross-origin requests use the browser's network path.
  const relativePath = url.pathname.slice(scope.pathname.length);
  if (request.method !== 'GET' || request.mode !== 'navigate' ||
      url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) ||
      /^(api|auth|login|logout|signin|signout|oauth|callback)(\/|$)/i.test(relativePath)) return;

  event.respondWith((async () => {
    try {
      // Never write network HTML or other runtime responses to Cache Storage.
      return await fetch(request, { cache: 'no-store' });
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_URL) || Response.error();
    }
  })());
});
