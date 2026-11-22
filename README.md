# TradeBot — Trading Bot PWA (gratis, untuk Android)

Bot trading **Progressive Web App (PWA)** gratis yang bisa dipasang di Android seperti app native.
Berdasar **Binance**, mendukung **XAUUSD (emas), BTCUSD (Bitcoin), ETHUSD (Ethereum)**.

## Fitur
- 📈 **Grafik harga live** + overlay SMA20 / SMA50 (canvas)
- 🧮 **Indikator**: RSI, MACD, Bollinger Bands, SMA, EMA
- 🚦 **Sinyal strategi gabungan** (skor BUY/SELL/HOLD dengan alasan)
- 🤖 **Auto-trading** — eksekusi otomatis berdasarkan sinyal pada interval tertentu
- 🔔 **Notifikasi** push (saat ada sinyal/trade)
- 🔁 **Multi simbol & timeframe** (1m, 5m, 15m, 30m, 1h, 4h, 1d)
- 💾 **Pengaturan tersimpan** di localStorage browser
- 📲 **Installable PWA** — service worker + manifest + icon

## Cara Install di Android
1. Buka URL GitHub Pages di **Chrome Android**:
   `https://ambelajartrading001-byte.github.io/trading-bot-pwa/`
2. Tap **⋮ (menu) → Install app / Tambahkan ke layar utama**
3. Ikon TradeBot muncul di home screen → buka penuh layar.

## Arsitektur / Endpoints
- **Data pasar** (klines, ticker): `https://data-api.binance.vision` — mengizinkan CORS `*`, gratis, tanpa key.
- **Order Testnet**: `https://testnet.binance.vision` — mengizinkan CORS, uang virtual.
- **Order Real**: butuh proxy/server-side karena `api.binance.com` memblokir CORS browser.

## Cara dapat API Key
- **Testnet (disarankan)**: daftar di `testnet.binance.vision` → buat key → isi di Pengaturan (mode Testnet).
- **Real**: key dari akun Binance (butuh server/proxy; risiko tinggi).

## Peringatan
- Strategi indikator **hanya untuk belajar**, bukan jaminan profit.
- **Bukan saran investasi**. Trade dengan risiko sendiri.
- API key tersimpan **lokal** di browser (localStorage) — jangan di perangkat publik.

## Struktur File
```
index.html      # UI dashboard
style.css       # Styling
app.js          # Logika utama (data, trading, auto-trade, notifikasi, settings)
indicators.js   # RSI, MACD, Bollinger, SMA, EMA + strategi
sw.js           # Service Worker (cache + notifikasi)
manifest.json   # Manifes PWA
icons/          # Ikons aplikasi
```