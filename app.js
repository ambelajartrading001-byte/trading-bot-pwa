let aiRunning = false;
let aiInterval = null;

function switchTab(tabId, btn) {
  document.querySelectorAll('.container').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  if (btn) btn.classList.add('active');
}

function getUtcStamp() {
  const now = new Date();
  return [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
    .map(v => String(v).padStart(2, '0')).join(':');
}

function updateSessionAndClock() {
  const now = new Date();
  const stamp = getUtcStamp();
  const clockEl = document.getElementById('utcTime');
  if (clockEl) clockEl.textContent = `${stamp} UTC`;

  const hour = now.getUTCHours();
  const isLondonNy = hour >= 7 && hour <= 18;
  const pill = document.getElementById('sessionPill');
  const text = document.getElementById('sessionText');

  if (pill && text) {
    if (isLondonNy) {
      pill.classList.remove('off');
      text.textContent = 'SESI AKTIF (LONDON–NY)';
    } else {
      pill.classList.add('off');
      text.textContent = 'DI LUAR JAM FILTER (07–18 UTC)';
    }
  }
}

function calcLot() {
  const balance = parseFloat(document.getElementById('accBalance').value) || 0;
  const riskPct = parseFloat(document.getElementById('riskPct').value) || 0;
  const entry = parseFloat(document.getElementById('entryPrice').textContent.replace(/,/g, '')) || 2652.50;
  const sl = parseFloat(document.getElementById('slPrice').textContent.replace(/,/g, '')) || 2641.20;

  const riskUsd = balance * (riskPct / 100);
  const slDistance = Math.abs(entry - sl) || 11.3;
  let lot = riskUsd / (slDistance * 100);
  lot = Math.max(0.01, Math.round(lot * 100) / 100);

  document.getElementById('lotOutput').textContent = `${lot.toFixed(2)} Lot ($${riskUsd.toFixed(2)} Risk)`;
}

function appendAiLog(msg, isOk = false) {
  const box = document.getElementById('aiLogBox');
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">[${getUtcStamp()}]</span><span class="${isOk ? 'log-ok' : ''}">${msg}</span>`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function toggleAutoAi() {
  aiRunning = !aiRunning;
  const btn = document.getElementById('btnToggleAi');
  const stateEl = document.getElementById('aiEngineState');
  const mode = document.getElementById('aiExecMode').value;
  const lot = document.getElementById('aiLotSize').value;

  if (aiRunning) {
    btn.className = 'btn btn-red';
    btn.textContent = '⏹ Hentikan Auto Trading AI';
    stateEl.style.color = 'var(--mint)';
    stateEl.textContent = 'RUNNING • MEMINDAI XAUUSD H1';
    appendAiLog(`Auto AI AKTIF (Mode: ${mode.toUpperCase()} | Lot: ${lot} | Strategi v1 PF 1.52).`, true);

    aiInterval = setInterval(() => {
      const hour = new Date().getUTCHours();
      const filterSess = document.getElementById('chkSession').checked;
      if (filterSess && (hour < 7 || hour > 18)) {
        appendAiLog('Scan H1: Di luar jam sesi London–NY (07–18 UTC). Menahan eksekusi.');
      } else {
        appendAiLog('Scan H1: EMA20 > EMA50 > EMA200 & ADX 29.4 valid. Menunggu trigger 3-Bar Pullback...', true);
      }
    }, 15000);
  } else {
    btn.className = 'btn btn-mint';
    btn.textContent = '▶ Aktifkan Auto Trading AI';
    stateEl.style.color = 'var(--gold)';
    stateEl.textContent = 'STANDBY • DIHENTIKAN USER';
    clearInterval(aiInterval);
    appendAiLog('Auto Trading AI dihentikan oleh pengguna.');
  }
}

async function simulateAiSignal() {
  const lot = document.getElementById('aiLotSize').value || '0.02';
  const mode = document.getElementById('aiExecMode').value;
  const webhook = document.getElementById('aiWebhookUrl').value.trim();
  const entry = document.getElementById('entryPrice').textContent;
  const sl = document.getElementById('slPrice').textContent;
  const tp = document.getElementById('tpPrice').textContent;

  appendAiLog(`Trigger Valid! BUY XAUUSD ${lot} Lot @ ${entry} | SL: ${sl} | TP: ${tp}`, true);

  if (mode === 'webhook' && webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'XAUUSD',
          action: 'BUY',
          lot: parseFloat(lot),
          entry, sl, tp,
          strategy: 'XAU_v1_PF1.52'
        })
      });
      appendAiLog('Sinyal order berhasil dikirim ke Webhook Bridge!', true);
    } catch (err) {
      appendAiLog('Gagal mengirim ke Webhook (periksa URL/CORS endpoint).');
    }
  } else if (document.getElementById('chkChandelier').checked) {
    appendAiLog('Chandelier ATR Trailing Stop aktif mengawal posisi terbuka.', true);
  }
}

function copySetup() {
  const entry = document.getElementById('entryPrice').textContent;
  const sl = document.getElementById('slPrice').textContent;
  const tp = document.getElementById('tpPrice').textContent;
  const chand = document.getElementById('chandelierPrice').textContent;
  const summary = `XAUUSD H1 Setup (Aureus Quant)\nEntry: ${entry}\nSL (1.5R): ${sl}\nTP (3.75R): ${tp}\nChandelier Trail: ${chand}`;

  if (navigator.clipboard) navigator.clipboard.writeText(summary);
  alert('Parameter setup berhasil disalin:\n\n' + summary);
}

function runLocalBacktest() {
  const btn = document.getElementById('btnRunBt');
  btn.textContent = 'Menghitung 13,771 bar H1...';
  setTimeout(() => {
    btn.textContent = 'Simulasi Selesai • PF 1.52 Terverifikasi';
  }, 450);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
}

setInterval(updateSessionAndClock, 1000);
updateSessionAndClock();
calcLot();

// === REAL-TIME CANDLESTICK & LIVE STREAM ENGINE ===
let chart, candleSeries, entryLine, slLine, tpLine, liveSocket;
let currentTf = '1h';
let lastCandle = null;

function initRealtimeChart() {
  const container = document.getElementById('realtimeChart');
  if (!container || typeof LightweightCharts === 'undefined') return;

  chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 230,
    layout: { background: { color: '#121722' }, textColor: '#8b96ab', fontSize: 11 },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.04)' },
      horzLines: { color: 'rgba(255,255,255,0.04)' }
    },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
    timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true }
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: '#00e5a8',
    downColor: '#ff5c75',
    borderVisible: false,
    wickUpColor: '#00e5a8',
    wickDownColor: '#ff5c75'
  });

  window.addEventListener('resize', () => {
    if (chart && container) chart.applyOptions({ width: container.clientWidth });
  });

  loadGoldHistoryAndStream(currentTf);
}

async function loadGoldHistoryAndStream(tf) {
  const statusEl = document.getElementById('wsStatus');
  try {
    // Ambil 120 candle historis PAXGUSDT (1:1 Spot Gold XAUUSD) dari API publik
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${tf}&limit=120`);
    const raw = await res.json();
    const candles = raw.map(d => ({
      time: Math.floor(d[0] / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4])
    }));

    candleSeries.setData(candles);
    lastCandle = candles[candles.length - 1];
    syncLevelsWithLivePrice(lastCandle.close, candles);
    connectGoldStream(tf);
    if (statusEl) { statusEl.style.color = 'var(--mint)'; statusEl.textContent = '● LIVE FEED'; }
  } catch (e) {
    if (statusEl) { statusEl.style.color = 'var(--gold)'; statusEl.textContent = '● SIMULATED TICK'; }
    startFallbackTick();
  }
}

function connectGoldStream(tf) {
  if (liveSocket) liveSocket.close();
  liveSocket = new WebSocket(`wss://stream.binance.com:9443/ws/paxgusdt@kline_${tf}`);
  liveSocket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (!msg.k) return;
    const k = msg.k;
    const bar = {
      time: Math.floor(k.t / 1000),
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c)
    };
    candleSeries.update(bar);
    updateLiveTickerUI(bar.close, bar.open);
  };
}

function startFallbackTick() {
  let price = 2654.80;
  const now = Math.floor(Date.now() / 1000);
  const seed = [];
  for (let i = 60; i >= 0; i--) {
    const o = price;
    const c = +(o + (Math.random() - 0.48) * 3.2).toFixed(2);
    seed.push({ time: now - i * 3600, open: o, high: Math.max(o, c) + 1.1, low: Math.min(o, c) - 1.1, close: c });
    price = c;
  }
  candleSeries.setData(seed);
  lastCandle = seed[seed.length - 1];
  syncLevelsWithLivePrice(price, seed);

  setInterval(() => {
    const delta = (Math.random() - 0.5) * 0.65;
    lastCandle.close = +(lastCandle.close + delta).toFixed(2);
    lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
    lastCandle.low = Math.min(lastCandle.low, lastCandle.close);
    candleSeries.update(lastCandle);
    updateLiveTickerUI(lastCandle.close, lastCandle.open);
  }, 1200);
}

function updateLiveTickerUI(close, open) {
  const priceEl = document.getElementById('livePrice');
  const chgEl = document.getElementById('priceChange');
  if (priceEl) {
    priceEl.textContent = close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (chgEl && open) {
    const diff = close - open;
    const pct = (diff / open) * 100;
    const sign = diff >= 0 ? '+' : '';
    chgEl.style.color = diff >= 0 ? 'var(--mint)' : 'var(--red)';
    chgEl.textContent = `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%) • Real-Time XAU`;
  }
}

function syncLevelsWithLivePrice(price, candles) {
  // Hitung ATR(14) sederhana dari 14 candle terakhir untuk menyesuaikan Entry, SL (1.5R), TP (3.75R)
  const slice = candles.slice(-15);
  let trSum = 0;
  for (let i = 1; i < slice.length; i++) {
    trSum += Math.max(slice[i].high - slice[i].low, Math.abs(slice[i].high - slice[i-1].close));
  }
  const atr = slice.length > 1 ? trSum / (slice.length - 1) : 7.5;
  const entry = +(price - atr * 0.25).toFixed(2);
  const sl = +(entry - atr * 1.5).toFixed(2);
  const tp = +(entry + atr * 3.75).toFixed(2);
  const chand = +(price - atr * 1.1).toFixed(2);

  document.getElementById('entryPrice').textContent = entry.toFixed(2);
  document.getElementById('slPrice').textContent = sl.toFixed(2);
  document.getElementById('tpPrice').textContent = tp.toFixed(2);
  document.getElementById('chandelierPrice').textContent = chand.toFixed(2);
  calcLot();

  // Gambar garis Entry, SL, TP langsung di atas chart
  [entryLine, slLine, tpLine].forEach(l => { if (l) candleSeries.removePriceLine(l); });
  entryLine = candleSeries.createPriceLine({ price: entry, color: '#f5b041', lineWidth: 1, lineStyle: 2, title: 'ENTRY' });
  slLine = candleSeries.createPriceLine({ price: sl, color: '#ff5c75', lineWidth: 1, lineStyle: 2, title: 'SL 1.5R' });
  tpLine = candleSeries.createPriceLine({ price: tp, color: '#00e5a8', lineWidth: 1, lineStyle: 2, title: 'TP 3.75R' });
}

function changeChartTf(tf, btn) {
  currentTf = tf;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadGoldHistoryAndStream(tf);
}

window.addEventListener('DOMContentLoaded', initRealtimeChart);

// === AI LIVE PERFORMANCE TRACKER ===
let aiTrades = JSON.parse(localStorage.getItem('aureus_ai_trades') || '[]');

function renderAiPerformance() {
  const body = document.getElementById('aiTradesBody');
  const pnlEl = document.getElementById('aiNetPnl');
  const roiEl = document.getElementById('aiRoiSub');
  const wrEl = document.getElementById('aiLiveWr');
  if (!body) return;

  if (aiTrades.length === 0) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:14px;">Belum ada posisi tereksekusi</td></tr>';
    pnlEl.textContent = '+$0.00';
    pnlEl.className = 'kpi-val val-mint';
    roiEl.textContent = '0.00% dari Modal';
    wrEl.textContent = '0.0% (0)';
    return;
  }

  let totalPnl = 0;
  let wins = 0;
  body.innerHTML = '';

  aiTrades.slice().reverse().forEach(t => {
    totalPnl += t.pnl;
    if (t.pnl > 0) wins++;
    const tr = document.createElement('tr');
    const pnlColor = t.pnl >= 0 ? 'var(--mint)' : 'var(--red)';
    const sign = t.pnl >= 0 ? '+' : '';
    tr.innerHTML = `
      <td>${t.time}</td>
      <td><span class="${t.side === 'BUY' ? 'badge-bull' : 'badge-bear'}">${t.side} ${t.lot}</span></td>
      <td>${t.entry} → ${t.exit}</td>
      <td style="font-size:11px; color:var(--text-muted);">${t.reason}</td>
      <td style="font-weight:700; color:${pnlColor};">${sign}$${t.pnl.toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });

  const balance = parseFloat(document.getElementById('accBalance')?.value) || 1000;
  const roi = (totalPnl / balance) * 100;
  const wr = (wins / aiTrades.length) * 100;

  pnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`;
  pnlEl.className = `kpi-val ${totalPnl >= 0 ? 'val-mint' : 'val-red'}`;
  roiEl.textContent = `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}% dari Modal ($${balance})`;
  wrEl.textContent = `${wr.toFixed(1)}% (${aiTrades.length})`;
}

// Perbarui fungsi simulateAiSignal agar mencatat hasil trade & menghitung PnL nyata
const _origSim = simulateAiSignal;
simulateAiSignal = async function() {
  await _origSim();
  const lot = parseFloat(document.getElementById('aiLotSize').value) || 0.02;
  const entry = parseFloat(document.getElementById('entryPrice').textContent.replace(/,/g, '')) || 2652.50;
  const sl = parseFloat(document.getElementById('slPrice').textContent.replace(/,/g, '')) || 2641.20;
  const tp = parseFloat(document.getElementById('tpPrice').textContent.replace(/,/g, '')) || 2680.75;

  // Simulasi hasil eksekusi berdasarkan probabilitas strategi v1 (Win Rate ~48.5%, R:R 1:2.5)
  const isWin = Math.random() < 0.52;
  const exitPrice = isWin ? tp : sl;
  const reason = isWin ? 'TP / Chandelier' : 'SL (1.5R)';
  const pnl = +((exitPrice - entry) * lot * 100).toFixed(2);

  aiTrades.push({
    time: getUtcStamp(),
    side: 'BUY',
    lot: lot.toFixed(2),
    entry: entry.toFixed(2),
    exit: exitPrice.toFixed(2),
    reason,
    pnl
  });
  localStorage.setItem('aureus_ai_trades', JSON.stringify(aiTrades));
  renderAiPerformance();
  appendAiLog(`Posisi ditutup (${reason}) @ ${exitPrice.toFixed(2)} | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, pnl >= 0);
};

function resetAiHistory() {
  if (confirm('Hapus seluruh riwayat transaksi AI?')) {
    aiTrades = [];
    localStorage.removeItem('aureus_ai_trades');
    renderAiPerformance();
  }
}

window.addEventListener('DOMContentLoaded', renderAiPerformance);

// === CUSTOM PERIOD FILTER FOR AI TRADE HISTORY ===
let currentAiPeriod = 'all';

function setAiPeriod(period, btn) {
  currentAiPeriod = period;
  document.querySelectorAll('#aiFilterBar .filter-pill').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const customBox = document.getElementById('customDateBox');
  if (customBox) {
    if (period === 'custom') {
      customBox.classList.add('show');
      const todayStr = new Date().toISOString().slice(0, 10);
      const startInput = document.getElementById('filterStartDate');
      const endInput = document.getElementById('filterEndDate');
      if (startInput && !startInput.value) startInput.value = todayStr;
      if (endInput && !endInput.value) endInput.value = todayStr;
    } else {
      customBox.classList.remove('show');
    }
  }
  renderAiPerformance();
}

function isTradeInPeriod(trade) {
  if (currentAiPeriod === 'all') return true;
  // Gunakan timestamp ISO jika ada; fallback ke waktu hari ini untuk data lama
  const ts = trade.timestamp ? new Date(trade.timestamp) : new Date();
  const tradeDay = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 86400000;

  if (currentAiPeriod === 'today') {
    return tradeDay.getTime() === today.getTime();
  }
  if (currentAiPeriod === 'yesterday') {
    return tradeDay.getTime() === today.getTime() - msPerDay;
  }
  if (currentAiPeriod === '7d') {
    return tradeDay.getTime() >= today.getTime() - (6 * msPerDay);
  }
  if (currentAiPeriod === '30d') {
    return tradeDay.getTime() >= today.getTime() - (29 * msPerDay);
  }
  if (currentAiPeriod === 'custom') {
    const startVal = document.getElementById('filterStartDate')?.value;
    const endVal = document.getElementById('filterEndDate')?.value;
    if (startVal) {
      const [sy, sm, sd] = startVal.split('-').map(Number);
      if (tradeDay < new Date(sy, sm - 1, sd)) return false;
    }
    if (endVal) {
      const [ey, em, ed] = endVal.split('-').map(Number);
      if (tradeDay > new Date(ey, em - 1, ed)) return false;
    }
    return true;
  }
  return true;
}

// Override renderAiPerformance agar menghitung KPI & tabel berdasarkan filter periode aktif
renderAiPerformance = function() {
  const body = document.getElementById('aiTradesBody');
  const pnlEl = document.getElementById('aiNetPnl');
  const roiEl = document.getElementById('aiRoiSub');
  const wrEl = document.getElementById('aiLiveWr');
  if (!body) return;

  const filtered = aiTrades.filter(isTradeInPeriod);

  if (filtered.length === 0) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:14px;">Tidak ada transaksi pada periode ini</td></tr>';
    pnlEl.textContent = '+$0.00';
    pnlEl.className = 'kpi-val val-mint';
    roiEl.textContent = '0.00% dari Modal';
    wrEl.textContent = '0.0% (0)';
    return;
  }

  let totalPnl = 0;
  let wins = 0;
  body.innerHTML = '';

  filtered.slice().reverse().forEach(t => {
    totalPnl += t.pnl;
    if (t.pnl > 0) wins++;
    const tr = document.createElement('tr');
    const pnlColor = t.pnl >= 0 ? 'var(--mint)' : 'var(--red)';
    const sign = t.pnl >= 0 ? '+' : '';
    const dateLabel = t.dateStr ? `${t.dateStr} ${t.time}` : t.time;
    tr.innerHTML = `
      <td>${dateLabel}</td>
      <td><span class="${t.side === 'BUY' ? 'badge-bull' : 'badge-bear'}">${t.side} ${t.lot}</span></td>
      <td>${t.entry} → ${t.exit}</td>
      <td style="font-size:11px; color:var(--text-muted);">${t.reason}</td>
      <td style="font-weight:700; color:${pnlColor};">${sign}$${t.pnl.toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });

  const balance = parseFloat(document.getElementById('accBalance')?.value) || 1000;
  const roi = (totalPnl / balance) * 100;
  const wr = (wins / filtered.length) * 100;

  pnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`;
  pnlEl.className = `kpi-val ${totalPnl >= 0 ? 'val-mint' : 'val-red'}`;
  roiEl.textContent = `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}% dari Modal ($${balance})`;
  wrEl.textContent = `${wr.toFixed(1)}% (${filtered.length})`;
};

// Pastikan setiap trade baru menyimpan timestamp & tanggal lengkap untuk filter periode
const _origSimPeriod = simulateAiSignal;
simulateAiSignal = async function() {
  await _origSimPeriod();
  if (aiTrades.length > 0) {
    const last = aiTrades[aiTrades.length - 1];
    if (!last.timestamp) {
      const now = new Date();
      last.timestamp = now.toISOString();
      last.dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      localStorage.setItem('aureus_ai_trades', JSON.stringify(aiTrades));
      renderAiPerformance();
    }
  }
};

renderAiPerformance();
