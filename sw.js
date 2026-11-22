// Service Worker for PWA Trading Bot
// Enables offline caching + push notifications
const CACHE_NAME = 'trading-bot-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './indicators.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for shell
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Do not intercept API/notification calls
  if (url.hostname.includes('binance') || url.hostname.includes('vision')) {
    return; // let them go to network
  }

  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return (
        cached ||
        fetch(e.request)
          .then((res) => {
            if (res && res.status === 200 && e.request.method === 'GET') {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Bot Trading', body: 'Ada sinyal baru', icon: './icons/icon-192.png' };
  try {
    data = event.data ? event.data.json() : data;
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click -> open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});