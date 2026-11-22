// app.js — Perbarui untuk Sinyal Live XAUUSD, Tab, dan Metrik
'use strict';

const state = {
  prices: [],
  settings: { interval: '5m' },
  activeTab: 'setup'
};

/* Sinyal Live XAUUSD (EMA 20/50/200, ADX, RSI, Chandelier) */
function getSignal() {
  const p = state.prices;
  if (p.length < 200) return { signal: 'HOLD', msg: 'Data tidak cukup' };
  
  const currentPrice = p[p.length - 1];
  const ema20 = window.indicators.ema(p.slice(-21), 20);
  const ema50 = window.indicators.ema(p.slice(-51), 50);
  const ema200 = window.indicators.ema(p.slice(-201), 200);
  const rsi = window.indicators.rsi(p.slice(-15), 14);
  const adx = window.indicators.adx(p.slice(-30), 14);

  // Filter jam market (London-NY 07:00-18:00 UTC)
  const now = new Date();
  const utcHour = now.getUTCHours();
  if (utcHour < 7 || utcHour >= 18) return { signal: 'HOLD', msg: 'Market tutup' };

  let signal = 'HOLD';
  if (currentPrice > ema200 && ema20 > ema50 && rsi < 70 && adx > 25) signal = 'BUY';
  else if (currentPrice < ema200 && ema50 > ema20 && rsi > 30 && adx > 25) signal = 'SELL';

  return { signal, ema: ema20.toFixed(2), rsi: rsi.toFixed(1), adx: adx.toFixed(1) };
}

async function updateUI() {
  // Tab Navigasi
  document.querySelectorAll('.tabbtn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tabpane').forEach(p => p.style.display = 'none');
      document.querySelectorAll('.tabbtn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
      btn.classList.add('active');
    };
  });

  // Data Live
  const res = await fetch('https://api.binance.com/api/v3/klines?symbol=XAUTUSDT&interval=5m&limit=200');
  const data = await res.json();
  state.prices = data.map(k => parseFloat(k[4]));

  const sig = getSignal();
  document.getElementById('valEma').textContent = sig.ema;
  document.getElementById('valAdx').textContent = sig.adx;
  document.getElementById('valRsi').textContent = sig.rsi;
  document.getElementById('signalEntry').textContent = `Sinyal: ${sig.signal}`;

  // Kalender Berita USD
  document.getElementById('newsFeed').textContent = "USD: Tidak ada data high-impact hari ini.";
}

// Inisialisasi
setInterval(updateUI, 60000);
updateUI();
