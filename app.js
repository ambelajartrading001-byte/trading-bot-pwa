// app.js — Trading Bot PWA main logic
'use strict';

/* ===================== CONFIG & STATE ===================== */
// Publicly-accessible, CORS-friendly endpoints (no API key needed for data)
const DATA_BASE = 'https://data-api.binance.vision';       // live market data (CORS *)
const TESTNET_ORDER_BASE = 'https://testnet.binance.vision'; // testnet ordering (CORS *)

const SYMBOL_MAP = {
  XAUUSD: { api: 'XAUTUSDT', label: 'Emas (XAUUSD)' },
  BTCUSD: { api: 'BTCUSDT', label: 'Bitcoin (BTCUSD)' },
  ETHUSD: { api: 'ETHUSDT', label: 'Ethereum (ETHUSD)' },
};
let currentDisplay = 'BTCUSD'; // default

const state = {
  prices: [],            // closes, oldest first
  klines: [],
  lastSignal: null,
  lastTradeSide: null,
  autoTrading: false,
  autoTimer: null,
  notifyEnabled: false,
  settings: { mode: 'testnet', apiKey: '', apiSecret: '', interval: '5m', format: 100 },
};

/* ===================== PERSISTENCE ===================== */
function loadSettings() {
  try {
    const raw = localStorage.getItem('tb_settings');
    if (raw) state.settings = { ...state.settings, ...JSON.parse(raw) };
  } catch (e) {}
}
function saveSettings() {
  localStorage.setItem('tb_settings', JSON.stringify(state.settings));
}

/* ===================== API HELPERS ===================== */
// Binance signed request: HMAC-SHA256 signature
async function signQuery(queryString, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(queryString));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ===================== DATA FETCHING ===================== */
async function fetchKlines(apiSymbol, interval, limit = 200) {
  const url = `${DATA_BASE}/api/v3/klines?symbol=${apiSymbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Fetch klines: ' + res.status);
  const data = await res.json();
  // each: [openTime, open, high, low, close, volume, ...]
  state.klines = data;
  state.prices = data.map((k) => parseFloat(k[4]));
  return state;
}

async function fetchTicker(apiSymbol) {
  const url = `${DATA_BASE}/api/v3/ticker/price?symbol=${apiSymbol}`;
  const res = await fetch(url);
  const d = await res.json();
  return parseFloat(d.price);
}

/* ===================== CHART ===================== */
function drawChart() {
  const canvas = document.getElementById('priceChart');
  if (!canvas || state.prices.length < 2) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  const H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  const data = state.prices;
  const min = Math.min(...data), max = Math.max(...data);
  const pad = 10;
  const step = (w - 20) / (data.length - 1 || 1);

  // grid + SMA overlays
  const sma20Vals = data.map((_, i) => {
    if (i < 20) return null;
    const s = data.slice(i - 20, i); return s.reduce((a, b) => a + b, 0) / 20;
  });
  const sma50Vals = data.map((_, i) => {
    if (i < 50) return null;
    const s = data.slice(i - 50, i); return s.reduce((a, b) => a + b, 0) / 50;
  });

  function mapY(v) { return h - pad - ((v - min) / ((max - min) || 1)) * (h - 2 * pad); }
  function line(vals, color, width) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    let started = false;
    vals.forEach((v, i) => {
      if (v === null || v === undefined) return;
      const x = 10 + i * step, y = mapY(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  line(data, '#3b82f6', 2);          // price blue
  line(sma20Vals, '#f0b90b', 1.5);   // sma20 gold
  line(sma50Vals, '#22c55e', 1.5);   // sma50 green

  // last price dot
  const lastPrice = data[data.length - 1];
  const lastX = 10 + (data.length - 1) * step;
  ctx.beginPath(); ctx.arc(lastX, mapY(lastPrice), 4, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
}

/* ===================== DISPLAY ===================== */
function fmtPrice(p) {
  const fmt = state.settings.format || 100;
  return p >= fmt ? p.toFixed(2) : p.toFixed(4);
}

function updateDisplay() {
  const sym = SYMBOL_MAP[currentDisplay];
  document.getElementById('displaySymbol').textContent = `${currentDisplay} (${sym.api})`;

  const last = state.prices[state.prices.length - 1];
  const liveEl = document.getElementById('livePrice');
  if (last) {
    liveEl.textContent = '$ ' + fmtPrice(last);
    // change color based on last movement
    const prev = state.prices[state.prices.length - 2];
    if (prev && last !== prev) {
      liveEl.className = last > prev ? 'up' : 'down';
    }
  }

  // Indicators
  const inds = window.indicators;
  const show = (el, val, tpl) => { const n = document.getElementById(el); if (n) n.textContent = tpl(val); };

  const sma20 = inds.sma(state.prices, 20);
  const sma50 = inds.sma(state.prices, 50);
  const r = inds.rsi(state.prices, 14);
  const m = inds.macd(state.prices);
  const bb = inds.bollinger(state.prices);

  show('sma20', sma20, (v) => v === null ? '—' : fmtPrice(v));
  show('sma50', sma50, (v) => v === null ? '—' : fmtPrice(v));
  show('rsi', r, (v) => v === null ? '—' : v.toFixed(1));
  show('macd', m, (v) => v ? `${fmtPrice(v.macd)} / ${fmtPrice(v.signal)}` : '—');
  show('bbU', bb, (v) => v ? fmtPrice(v.upper) : '—');
  show('bbL', bb, (v) => v ? fmtPrice(v.lower) : '—');

  // Strategy signal
  const sig = inds.strategySignal(state.prices);
  const sigEl = document.getElementById('signalBadge');
  const sigTxt = document.getElementById('signalText');
  sigEl.className = 'badge ' + (sig.signal === 'BUY' ? 'buy' : sig.signal === 'SELL' ? 'sell' : 'hold');
  sigEl.textContent = sig.signal;
  sigTxt.innerHTML = `Skor: <b>${sig.score}</b> — ${sig.reasons.join('; ') || 'Data belum cukup'}`;

  // Fire notification on signal change
  if (state.lastSignal && state.lastSignal !== sig.signal && sig.signal !== 'HOLD') {
    notify('Sinyal Trading', `${currentDisplay}: ${sig.signal} (skor ${sig.score})`);
  }
  state.lastSignal = sig.signal;

  drawChart();
  updateStatus();
}

function updateStatus(msg) {
  const el = document.getElementById('statusMsg');
  if (msg) { el.textContent = msg; return; }
  el.textContent = `Mode: ${state.settings.mode.toUpperCase()} | Update: ${new Date().toLocaleTimeString()}`;
}

/* ===================== NOTIFICATIONS ===================== */
async function enableNotifications() {
  if (!('Notification' in window)) { alert('Browser tidak mendukung notifikasi'); return; }
  const perm = await Notification.requestPermission();
  state.notifyEnabled = perm === 'granted';
  try {
    const reg = await navigator.serviceWorker.ready;
    // show a test notification
    reg.showNotification('Notifikasi Aktif', { body: 'Kamu akan dapat notifikasi saat ada sinyal/trade.', icon: './icons/icon-192.png' });
  } catch (e) {}
  if (state.notifyEnabled) updateStatus('Notifikasi diaktifkan');
}
function notify(title, body) {
  if (!state.notifyEnabled) return;
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) =>
        reg.showNotification(title, { body, icon: './icons/icon-192.png', vibrate: [200, 100, 200] })
      );
    } else if (Notification) {
      new Notification(title, { body });
    }
  } catch (e) {}
}

/* ===================== TRADING ===================== */
function orderBase() {
  return state.settings.mode === 'testnet' ? TESTNET_ORDER_BASE : DATA_BASE;
}
function signedAllowed() {
  // Note: real mode against api.binance.com via browser is BLOCKED by CORS.
  // We use data-api.binance.vision (CORS *) — real-mode signed orders will
  // only function if Binance permits CORS there (testnet does). Real
  // production api.binance.com requires a server-side proxy.
  return true;
}

async function placeOrder(side) {
  const { apiKey, apiSecret, interval } = state.settings;
  if (!apiKey || !apiSecret) {
    alert('Isi API Key & Secret di Pengaturan dulu (testnet: buat di testnet.binance.vision).');
    return { error: 'no-keys' };
  }
  const sym = SYMBOL_MAP[currentDisplay].api;
  const price = state.prices[state.prices.length - 1];
  const qtyPrecision = 3; // simplified; production: query exchangeInfo
  const quantity = Number((state.settings.format * 0.1 / (price || 1)).toFixed(qtyPrecision));
  const now = Date.now();
  const params = {
    symbol: sym, side, type: 'LIMIT', timeInForce: 'GTC',
    price: price.toFixed(2), quantity: String(quantity), timestamp: now,
  };
  // via BTCUSDT etc, price might be < 100 for some; but fine for demo
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const signature = await signQuery(query, apiSecret);
  const url = `${orderBase()}/api/v3/order?${query}&signature=${signature}`;

  const btn = document.getElementById(side === 'BUY' ? 'buyBtn' : 'sellBtn');
  if (btn) btn.disabled = true;
  document.getElementById('lastOrder').textContent = `Mengeksekusi ${side}...`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' } });
    const data = await res.json();
    if (res.ok || data.orderId) {
      state.lastTradeSide = side;
      notify('Order Terkirim', `${currentDisplay} ${side} @ ${fmtPrice(price)} qty ${quantity}`);
      document.getElementById('lastOrder').textContent = `✓ Order ${side} terkirim (ID ${data.orderId || '?'})`;
    } else {
      document.getElementById('lastOrder').textContent = `✗ Gagal: ${data.msg || JSON.stringify(data)}`;
      alert('Order gagal: ' + (data.msg || res.status));
    }
  } catch (e) {
    document.getElementById('lastOrder').textContent = '✗ Error: ' + e.message;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ===================== AUTO TRADING ===================== */
function setAutoTrading(on) {
  state.autoTrading = on;
  const btn = document.getElementById('autoBtn');
  if (btn) { btn.textContent = on ? '⏸ Stop Auto-trade' : '▶ Auto-trade'; btn.classList.toggle('active', on); }
  if (on) {
    const interval = parseInt(state.settings.interval.replace(/[^\d]/g, ''), 10) || 5;
    state.autoTimer = setInterval(async () => {
      await refresh();
      const sig = window.indicators.strategySignal(state.prices).signal;
      state.lastTradeSide = sig;
      if (sig === 'BUY' || sig === 'SELL') {
        document.getElementById('statusMsg').textContent = `Auto-trade: sinyal ${sig}, mencoba eksekusi...`;
        notify('Auto-trade', `${currentDisplay}: ${sig}`);
        await placeOrder(sig);
      } else {
        updateStatus(`Auto-trade: HOLD (menunggu sinyal)`);
      }
    }, interval * 60 * 1000);
    // run once immediately
    (async () => {
      await refresh();
      const sig = window.indicators.strategySignal(state.prices).signal;
      notify('Auto-trade Dimulai', `Monitor ${currentDisplay}, sinyal awal: ${sig}`);
    })();
  } else {
    if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; }
    updateStatus('Auto-trade dihentikan');
  }
}

/* ===================== REFRESH ===================== */
async function refresh() {
  const sym = SYMBOL_MAP[currentDisplay];
  try {
    await fetchKlines(sym.api, state.settings.interval, 150);
    updateDisplay();
  } catch (e) {
    updateStatus('Error: ' + e.message);
  }
}

/* ===================== EVENTS / INIT ===================== */
function renderSettingsForm() {
  document.getElementById('setMode').value = state.settings.mode;
  document.getElementById('setKey').value = state.settings.apiKey;
  document.getElementById('setSecret').value = state.settings.apiSecret;
  document.getElementById('setInterval').value = state.settings.interval;
}
function saveSettingsForm() {
  state.settings.mode = document.getElementById('setMode').value;
  state.settings.apiKey = document.getElementById('setKey').value.trim();
  state.settings.apiSecret = document.getElementById('setSecret').value.trim();
  state.settings.interval = document.getElementById('setInterval').value;
  saveSettings();
  closeSettings();
  updateStatus('Pengaturan disimpan');
  refresh();
}

function openSettings() { renderSettingsForm(); document.getElementById('settingsModal').style.display = 'flex'; }
function closeSettings() { document.getElementById('settingsModal').style.display = 'none'; }

function init() {
  loadSettings();
  document.getElementById('buyBtn').addEventListener('click', () => placeOrder('BUY'));
  document.getElementById('sellBtn').addEventListener('click', () => placeOrder('SELL'));
  document.getElementById('autoBtn').addEventListener('click', () => setAutoTrading(!state.autoTrading));
  document.getElementById('notifyBtn').addEventListener('click', enableNotifications);
  document.getElementById('refreshBtn').addEventListener('click', refresh);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('settingsSave').addEventListener('click', saveSettingsForm);

  // symbol selector
  document.getElementById('symbolSel').addEventListener('change', (e) => {
    currentDisplay = e.target.value;
    refresh();
  });
  document.getElementById('symbolSel').value = currentDisplay;

  // interval selector from settings
  document.getElementById('intervalSel').addEventListener('change', (e) => {
    state.settings.interval = e.target.value;
    saveSettings();
    refresh();
  });
  document.getElementById('intervalSel').value = state.settings.interval;

  renderSettingsForm();
  document.getElementById('intervalSel').value = state.settings.interval;

  refresh();
  setInterval(() => { if (!state.autoTrading) refresh(); }, 60 * 1000);

  // Service worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);