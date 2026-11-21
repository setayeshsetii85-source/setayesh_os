const CACHE = 'setayesh-shell-v3';

const BASE = self.registration.scope;

const SHELL = [
  './',
  './index.html',
  './style.css',
  './center.css',
  './app.js',
  './center.js',
  './expansion.js',
  './vault.js',
  './model.js',
  './store.js',
  './schema.js',
  './push.js',
  './push-shared.js',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest',
  './vazir.woff2'
].map(path => new URL(path, BASE).href);

const ICON = new URL('./icon-192.png', BASE).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith('setayesh-shell-') &&
              key !== CACHE
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (!SHELL.includes(request.url)) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      return await cache.match(request) || fetch(request);
    })
  );
});

self.addEventListener('push', event => {
  let p;

  try {
    p = event.data?.json();
  } catch {}

  if (!p?.id || !p.title) return;

  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      icon: ICON,
      badge: ICON,
      tag: p.id,
      renotify: false,
      dir: 'rtl',
      lang: 'fa',
      data: p.snooze,
      actions: p.snooze
        ? [{ action: 'snooze', title: '۱۰ دقیقه بعد' }]
        : []
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil((async () => {
    if (event.action === 'snooze' && event.notification.data) {
      try {
        const r = await fetch('/api/snooze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event.notification.data)
        });

        if (!r.ok) throw Error();
      } catch {
        await self.registration.showNotification('تعویق ثبت نشد', {
          body: 'اتصال اینترنت را بررسی کن و در تنظیمات یادآور جدید بساز.',
          tag: 'snooze-error',
          icon: ICON
        });
      }

      return;
    }

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    if (windows.length) {
      await windows[0].focus();
      return;
    }

    await self.clients.openWindow(BASE);
  })());
});
