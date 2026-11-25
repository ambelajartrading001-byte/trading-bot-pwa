#!/bin/bash
PROJECT_DIR="/root/trading-bot-pwa"
cd "$PROJECT_DIR" || exit 1

# Backup sw.js dan app.js lama
cp sw.js sw.js.bak 2>/dev/null
cp app.js app.js.bak 2>/dev/null

BUILD_VER="aureus-quant-$(date +%Y%m%d%H%M%S)"

# 1. Tulis ulang sw.js agar otomatis mengambil versi terbaru saat online & membersihkan cache lama
cat << SWEOF > "$PROJECT_DIR/sw.js"
const CACHE_NAME = '${BUILD_VER}';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './indicators.js',
  './smc_engine.js',
  './smc_visualizer.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-First: selalu ambil kode terbaru jika online, fallback ke cache jika offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
SWEOF

# 2. Tambahkan auto-reload di app.js ketika Service Worker baru aktif (jika belum ada)
if ! grep -q "controllerchange" "$PROJECT_DIR/app.js"; then
cat << 'APPEOF' >> "$PROJECT_DIR/app.js"

// Auto-reload PWA saat versi baru dari GitHub selesai diunduh
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
APPEOF
fi

# 3. Commit & Push ke GitHub agar PWA di Android langsung terbarui
git add sw.js app.js
git commit -m "feat(pwa): enable network-first auto-update (${BUILD_VER})"
git push origin main

echo "=== SELESAI! PWA Auto-Update (${BUILD_VER}) sudah aktif & dipush ke GitHub ==="
