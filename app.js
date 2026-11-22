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
  settings: { mode: 'testnet', apiKey: '', apiSecret: '', interval: '5m', format: 100, proxyUrl: '' },
  history: [],           // trade history
  activeTab: 'dashboard',
};

/* ===================== TRADE HISTORY ===================== */
function loadHistory() {
  try {
    const raw = localStorage.getItem('tb_history');
    if (raw) state.history = JSON.parse(raw);
  } catch (e) { state.history = []; }
}
function saveHistory() {
  localStorage.setItem('tb_history', JSON.stringify(state.history));
}
function recordTrade(entry) {
  state.history.unshift({
    ...entry, ts: Date.now(), id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
  });
  if (state.history.length > 100) state.history.length = 100;
  saveHistory();
  renderHistory();
  renderStats();
}
function tradePnl(t) {
  // For closed trades: sell-buy on qty; for our demo record realized side
  if (t.pnl !== undefined) return t.pnl;
  return 0;
}
function renderStats() {
  const el = document.getElementById('statsTotal');
  if (!el) return;
  const wins = state.history.filter((t) => (t.pnl || 0) > 0).length;
  const losses = state.history.filter((t) => (t.pnl || 0) < 0).length;
  const totalPnl = state.history.reduce((a, t) => a + (t.pnl || 0), 0);
  el.innerHTML =
    `Total Trade: <b>${state.history.length}</b>` +
    ` &nbsp; Win: <b style="color:#22c55e">${wins}</b>` +
    ` &nbsp; Loss: <b style="color:#e5484d">${losses}</b>` +
    ` &nbsp; Total PnL: <b style="color:${totalPnl >= 0 ? '#22c55e' : '#e5484d'}">$${totalPnl.toFixed(2)}</b>`;
}
function renderHistory() {
  const el = document.getElementById('historyList');
  if (!el) return;
  if (!state.history.length) {
    el.innerHTML = '<p class="muted">Belum ada trade tercatat.</p>';
    return;
  }
  el.innerHTML = state.history.map((t) => {
    const pnl = t.pnl || 0;
    const cls = pnl > 0 ? 'up' : (pnl < 0 ? 'down' : '');
    const when = new Date(t.ts).toLocaleString();
    return `<div class="hrow"><span class="badge ${t.side === 'BUY' ? 'buy' : 'sell'}" style="font-size:.85rem">${t.side}</span>
      <span>${t.symbol}</span><span>@ ${t.price}</span>
      <span class="${cls}" style="font-weight:700">$${pnl.toFixed(2)}</span>
      <span class="muted small">${when}</span></div>`;
  }).join('');
}

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

async function placeOrder(side) {
  const { apiKey, apiSecret, interval, proxyUrl } = state.settings;
  if (!apiKey) {
    alert('Isi API Key di Pengaturan dulu (testnet: buat di testnet.binance.vision).');
    return { error: 'no-keys' };
  }
  const sym = SYMBOL_MAP[currentDisplay].api;
  const price = state.prices[state.prices.length - 1];
  const qtyPrecision = 3; // simplified; production: query exchangeInfo
  const quantity = Number((state.settings.format * 0.1 / (price || 1)).toFixed(qtyPrecision));
  const now = Date.now();

  // Determine endpoint + payload per mode
  let url, payload, headers;
  if (state.settings.mode === 'real') {
    // Route through Cloudflare Worker proxy (secret stays on server)
    if (!proxyUrl) {
      alert('Mode Real butuh Proxy URL. Isi URL Cloudflare Worker di Pengaturan (lihat README / folder worker/).');
      return { error: 'no-proxy' };
    }
    if (!apiSecret) {
      alert('Untuk mode real, API Secret disimpan di worker (BINANCE_SECRET), bukan di browser. Isi Proxy URL lalu di worker set secret-nya.');
      return { error: 'no-secret' };
    }
    url = proxyUrl.replace(/\/$/, '') + '/order';
    payload = { apiKey, symbol: sym, side, type: 'LIMIT', timeInForce: 'GTC', price: price.toFixed(2), quantity: String(quantity) };
    headers = { 'Content-Type': 'application/json' };
  } else {
    // Testnet: sign locally (secret stored in browser is fine for testnet)
    if (!apiSecret) {
      alert('Isi API Secret di Pengaturan untuk mode testnet.');
      return { error: 'no-secret' };
    }
    const params = {
      symbol: sym, side, type: 'LIMIT', timeInForce: 'GTC',
      price: price.toFixed(2), quantity: String(quantity), timestamp: now,
    };
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    const signature = await signQuery(query, apiSecret);
    url = `${orderBase()}/api/v3/order?${query}&signature=${signature}`;
    headers = { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  const btn = document.getElementById(side === 'BUY' ? 'buyBtn' : 'sellBtn');
  if (btn) btn.disabled = true;
  document.getElementById('lastOrder').textContent = `Mengeksekusi ${side}...`;
  try {
    const res = await fetch(url, { method: 'POST', headers, body: payload ? JSON.stringify(payload) : undefined });
    const data = await res.json();
    if (res.ok || data.orderId) {
      state.lastTradeSide = side;
      const msg = `Order ${side} terkirim (ID ${data.orderId || '?'}) via ${state.settings.mode.toUpperCase()}`;
      document.getElementById('lastOrder').textContent = `✓ ${msg}`;
      recordTrade({ side, symbol: sym, price: price.toFixed(2), qty: quantity, pnl: undefined, mode: state.settings.mode, orderId: data.orderId });
      notify('Order Terkirim', `${currentDisplay} ${side} @ ${fmtPrice(price)} qty ${quantity}`);
      return { ok: true, orderId: data.orderId };
    } else {
      document.getElementById('lastOrder').textContent = `✗ Gagal: ${data.msg || JSON.stringify(data)}`;
      alert('Order gagal: ' + (data.msg || res.status));
      return { error: data.msg };
    }
  } catch (e) {
    document.getElementById('lastOrder').textContent = '✗ Error: ' + e.message;
    return { error: e.message };
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

/* ===================== BACKTEST ===================== */
let btChart = null;
async function runBacktestUI() {
  const btn = document.getElementById('btRunBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menjalankan backtest...'; }
  const out = document.getElementById('btResult');
  out.innerHTML = '<p class="muted">Menghitung indikator & simulasi...</p>';
  const sym = SYMBOL_MAP[currentDisplay];
  const limit = parseInt(document.getElementById('btLimit').value, 10) || 300;
  const mode = document.getElementById('btMode').value;
  try {
    const result = await window.backtest.runBacktest(sym.api, state.settings.interval, limit, mode);
    const m = result.metrics;
    const mm = [
      ['Return', m.totalReturnPct.toFixed(2) + '%', m.totalReturnPct >= 0 ? 'up' : 'down'],
      ['Profit Bersih', '$' + m.netProfit.toFixed(2), m.netProfit >= 0 ? 'up' : 'down'],
      ['Trade', m.tradesCount, ''],
      ['Win Rate', m.winRatePct.toFixed(1) + '%', ''],
      ['Max Drawdown', m.maxDrawdownPct.toFixed(1) + '%', 'down'],
      ['Profit Factor', m.profitFactor.toFixed(2), m.profitFactor >= 1 ? 'up' : 'down'],
    ].map(([k, v, cls]) => `<div class="bt-m"><span>${k}</span><span class="${cls}">${v}</span></div>`).join('');
    out.innerHTML = `<div class="bt-metrics">${mm}</div>
      <p class="muted small">Equity akhir: <b>$${m.finalEquity.toFixed(2)}</b> (modal 1000) · ${limit} bar · mode ${mode}</p>`;
    drawBacktestChart(result.equityCurve);
    // Top recent trades
    const recent = result.trades.slice(0, 8);
    if (recent.length) {
      out.innerHTML += '<h4 class="bt-h">Trade terbaru (backtest)</h4><div class="bt-trades">' +
        recent.map((t) => `<div class="hrow"><span class="badge ${t.side === 'long' ? 'buy' : 'sell'}" style="font-size:.8rem">${t.side.toUpperCase()}</span>
          <span>${fmtPrice(t.entry)} → ${fmtPrice(t.exit)}</span>
          <span class="${t.pnl >= 0 ? 'up' : 'down'}" style="font-weight:700">$${t.pnl.toFixed(2)}</span></div>`).join('') +
        '</div>';
    }
  } catch (e) {
    out.innerHTML = '<p class="down">Error backtest: ' + e.message + '</p>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Jalankan Backtest'; }
  }
}
function drawBacktestChart(curve) {
  const canvas = document.getElementById('btChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  const H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...curve), max = Math.max(...curve);
  const pad = 10;
  ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
  curve.forEach((v, i) => {
    const x = pad + (i / (curve.length - 1 || 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / ((max - min) || 1)) * (h - 2 * pad);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // baseline 1000
  if (min <= 1000 && max >= 1000) {
    const y0 = h - pad - ((1000 - min) / ((max - min) || 1)) * (h - 2 * pad);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad, y0); ctx.lineTo(w - pad, y0); ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ===================== TABS ===================== */
function setTab(tab) {
  state.activeTab = tab;
  const tabs = ['dashboard', 'backtest', 'history'];
  tabs.forEach((t) => {
    document.getElementById('tab-' + t).style.display = (t === tab) ? 'block' : 'none';
    const btn = document.getElementById('tabBtn-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'history') { renderHistory(); renderStats(); }
}

/* ===================== EVENTS / INIT ===================== */
function renderSettingsForm() {
  document.getElementById('setMode').value = state.settings.mode;
  document.getElementById('setKey').value = state.settings.apiKey;
  document.getElementById('setSecret').value = state.settings.apiSecret;
  document.getElementById('setInterval').value = state.settings.interval;
  document.getElementById('setProxy').value = state.settings.proxyUrl || '';
}
function saveSettingsForm() {
  state.settings.mode = document.getElementById('setMode').value;
  state.settings.apiKey = document.getElementById('setKey').value.trim();
  state.settings.apiSecret = document.getElementById('setSecret').value.trim();
  state.settings.interval = document.getElementById('setInterval').value;
  state.settings.proxyUrl = document.getElementById('setProxy').value.trim();
  saveSettings();
  closeSettings();
  updateStatus('Pengaturan disimpan');
  refresh();
}

function openSettings() { renderSettingsForm(); document.getElementById('settingsModal').style.display = 'flex'; }
function closeSettings() { document.getElementById('settingsModal').style.display = 'none'; }

function init() {
  loadSettings();
  loadHistory();
  document.getElementById('buyBtn').addEventListener('click', () => placeOrder('BUY'));
  document.getElementById('sellBtn').addEventListener('click', () => placeOrder('SELL'));
  document.getElementById('autoBtn').addEventListener('click', () => setAutoTrading(!state.autoTrading));
  document.getElementById('notifyBtn').addEventListener('click', enableNotifications);
  document.getElementById('refreshBtn').addEventListener('click', refresh);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('settingsSave').addEventListener('click', saveSettingsForm);
  document.getElementById('btRunBtn').addEventListener('click', runBacktestUI);
  ['dashboard', 'backtest', 'history'].forEach((t) => {
    const bn = document.getElementById('tabBtn-' + t);
    if (bn) bn.addEventListener('click', () => setTab(t));
  });

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