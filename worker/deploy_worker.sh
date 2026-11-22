#!/bin/bash
# deploy_worker.sh — Deploy Cloudflare Worker proxy untuk trading real.
# Prasyarat: akun Cloudflare gratis, Node.js, dan sudah login wrangler.
set -e
cd "$(dirname "$0")/worker"

echo "=== 1. Cek Wrangler ==="
if ! command -v npx >/dev/null 2>&1; then echo "Butuh Node.js (npx)."; exit 1; fi

echo "=== 2. Login Cloudflare (sekali) ==="
npx wrangler login || echo "Gagal login — coba manual: npx wrangler login"

echo "=== 3. Set BINANCE_SECRET (sekali) ==="
# Ganti contoh ini dengan API Secret Binance real kamu saat dipanggil.
npx wrangler secret put BINANCE_SECRET --name trading-bot-proxy

echo "=== 4. Deploy ==="
npx wrangler deploy _worker.js --name trading-bot-proxy

echo ""
echo "SELESAI. Worker URL kira-kira:"
echo "  https://trading-bot-proxy.<subdomain>.workers.dev"
echo "Isi URL itu di Pengaturan app PWA -> Proxy URL Real"