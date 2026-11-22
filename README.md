# TradeBot — Trading Bot PWA (gratis, untuk Android)

Bot trading **Progressive Web App (PWA)** gratis yang bisa dipasang di Android seperti app native.
Berdasar **Binance**, mendukung **BTCUSD (Bitcoin), XAUUSD (emas), ETHUSD (Ethereum)**.

## Fitur
- 📈 **Grafik harga live** + overlay SMA20 / SMA50 (canvas)
- 🧮 **Indikator**: RSI, MACD, Bollinger Bands, SMA, EMA
- 🚦 **Sinyal strategi gabungan** (skor BUY/SELL/HOLD dengan alasan)
- 📊 **Backtest** — jalankan strategi pada data historis, lihat return, win rate, max drawdown, profit factor, equity curve, & daftar trade
- 🤖 **Auto-trading** — eksekusi otomatis berdasarkan sinyal pada interval tertentu
- 🔔 **Notifikasi** push (saat ada sinyal/trade)
- 🧾 **Riwayat trade + statistik** (total, win/loss, total PnL)
- 🌐 **Trading real** via Cloudflare Worker proxy (aman, secret di server)
- 🔁 **Multi simbol & timeframe** (1m, 5m, 15m, 30m, 1h, 4h, 1d)
- 💾 **Pengaturan tersimpan** di localStorage browser
- 📲 **Installable PWA** — service worker + manifest + icon

## Cara Install di Android
1. Buka URL GitHub Pages di **Chrome Android**:
   `https://ambelajartrading001-byte.github.io/trading-bot-pwa/`
2. Tap **⋮ (menu) → Install app / Tambahkan ke layar utama**
3. Ikon TradeBot muncul di home screen → buka penuh layar.

## Tabs
- **Dashboard** — harga, signal, indikator, chart, tombol trading & auto-trade
- **Backtest** — uji strategi pada historis (pilih jumlah bar & mode long/short)
- **Riwayat** — statistik & daftar trade yang terekam

## Arsitektur / Endpoints
- **Data pasar** (klines, ticker): `https://data-api.binance.vision` — izinkan CORS `*`, gratis, tanpa key.
- **Order Testnet**: `https://testnet.binance.vision` — izinkan CORS, uang virtual, sign di browser.
- **Order Real**: lewat **Cloudflare Worker proxy** (`worker/_worker.js`) karena `api.binance.com` memblokir CORS browser.

## Cara dapat API Key
- **Testnet (disarankan)**: daftar di `testnet.binance.vision` → buat key → isi di Pengaturan (mode Testnet).
- **Real**: butuh Cloudflare Worker (gratis) + key Binance. API Secret disimpan di worker, bukan di browser.

## Deploy Proxy Real (Cloudflare Worker, gratis)
```bash
cd worker/
chmod +x deploy_worker.sh && ./deploy_worker.sh
# Lalu isi URL worker (…workers.dev) di Pengaturan app -> Proxy URL Real
npx wrangler deploy _worker.js --name trading-bot-proxy
npx wrangler secret put BINANCE_SECRET   # isi API Secret Binance kamu
```
Lihat `worker/_worker.js` untuk detail API.

## Peringatan
- Strategi indikator **hanya untuk belajar**, bukan jaminan profit.
- **Bukan saran investasi**. Trade dengan risiko sendiri.
- API key & riwayat tersimpan **lokal** di browser (localStorage) — jangan di perangkat publik.

## Struktur File
```
index.html      # UI dashboard + tabs
style.css       # Styling
app.js          # Logika utama (data, trading, auto-trade, notifikasi, riwayat, settings)
indicators.js   # RSI, MACD, Bollinger, SMA, EMA + strategi
backtest.js     # Backtest engine (O(n))
sw.js           # Service Worker (cache + notifikasi)
manifest.json   # Manifes PWA
worker/         # Cloudflare Worker proxy untuk trading real
icons/          # Ikons aplikasi
```