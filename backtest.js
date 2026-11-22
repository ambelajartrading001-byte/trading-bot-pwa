// backtest.js — Vectorized strategy backtester for TradeBot
'use strict';

// Compute strategy signals across full price series (O(n)),
// returning a signal per bar index (>= warmup).
function computeSignals(prices) {
  const n = prices.length;
  const signals = new Array(n).fill('HOLD');
  const scores = new Array(n).fill(0);
  const reasons = new Array(n).fill('');

  // Fast running SMAs
  function runSMA(period) {
    const out = new Array(n).fill(null);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += prices[i];
      if (i >= period) sum -= prices[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }
  const sma20 = runSMA(20);
  const sma50 = runSMA(50);

  // Fast running RSI (Wilder)
  function runRSI(period = 14) {
    const out = new Array(n).fill(null);
    let gainSum = 0, lossSum = 0;
    for (let i = 1; i < n; i++) {
      const diff = prices[i] - prices[i - 1];
      const g = diff > 0 ? diff : 0;
      const l = diff < 0 ? -diff : 0;
      if (i <= period) { gainSum += g; lossSum += l; }
      if (i === period) { gainSum /= period; lossSum /= period; out[i] = lossSum === 0 ? 100 : 100 - 100 / (1 + gainSum / lossSum); continue; }
      if (i > period) {
        gainSum = (gainSum * (period - 1) + g) / period;
        lossSum = (lossSum * (period - 1) + l) / period;
        out[i] = lossSum === 0 ? 100 : 100 - 100 / (1 + gainSum / lossSum);
      }
    }
    return out;
  }
  const rsi = runRSI(14);

  // Fast running MACD line (only track the iteratively)
  const kf = 2 / 13, ks = 2 / 27, ksig = 2 / 10;
  let ef = 0, es = 0, ecount = 0;
  // We need MACD hist per bar. Recompute using simple EMA approximator per bar:
  const macdHist = new Array(n).fill(null);
  {
    let f = null, s = null;
    for (let i = 0; i < n; i++) {
      const v = prices[i];
      f = f === null ? v : v * kf + f * (1 - kf);
      s = s === null ? v : v * ks + s * (1 - ks);
      if (i >= 25) macdHist[i] = (f - s) - (f * (1 - ksig) ); // placeholder, replaced below
    }
    // recompute properly with signal ema
    const macdArr = [];
    for (let i = 0; i < n; i++) {
      const v = prices[i];
      f = f === null ? v : v * kf + f * (1 - kf);
      s = s === null ? v : v * ks + s * (1 - ks);
      if (i >= 25) macdArr.push({ macd: f - s, idx: i });
    }
    let sig = null;
    for (const e of macdArr) {
      sig = sig === null ? e.macd : e.macd * ksig + sig * (1 - ksig);
      macdHist[e.idx] = e.macd - sig;
    }
  }

  // Fast running Bollinger
  function runBB(period = 20, mult = 2) {
    const upper = new Array(n).fill(null), lower = new Array(n).fill(null);
    for (let i = period - 1; i < n; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const var_ = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
      const sd = Math.sqrt(var_);
      upper[i] = mean + mult * sd;
      lower[i] = mean - mult * sd;
    }
    return { upper, lower };
  }
  const bb = runBB(20);

  for (let i = 49; i < n; i++) { // warmup 50
    const p = prices[i];
    let score = 0;
    const rs = [];

    if (sma20[i] !== null && sma50[i] !== null) {
      if (sma20[i] > sma50[i]) { score += 2; rs.push('SMA20>SMA50'); } else { score -= 2; rs.push('SMA20<SMA50'); }
      if (p > sma20[i]) { score += 1; } else { score -= 1; }
    }
    if (rsi[i] !== null) {
      if (rsi[i] < 30) { score += 2; rs.push('RSI oversold'); }
      else if (rsi[i] > 70) { score -= 2; rs.push('RSI overbought'); }
      else if (rsi[i] > 50) { score += 1; } else { score -= 1; }
    }
    if (macdHist[i] !== null && macdHist[i] !== undefined) {
      if (macdHist[i] > 0) { score += 1; } else { score -= 1; }
    }
    if (bb.upper[i] !== null) {
      if (p <= bb.lower[i]) { score += 2; rs.push('Bawah Bollinger'); }
      else if (p >= bb.upper[i]) { score -= 2; rs.push('Atas Bollinger'); }
    }

    scores[i] = score;
    signals[i] = score >= 3 ? 'BUY' : (score <= -3 ? 'SELL' : 'HOLD');
    reasons[i] = rs.join('; ');
  }

  return { signals, scores, reasons };
}

// Simulate a long/short position scheduler on the bar series.
// Mode: 'long' (only BUY opens long, SELL/HOLD closes), or 'both' (BUY long, SELL short).
function simulate(prices, signals, mode, feePct = 0.001) {
  const n = prices.length;
  const trades = [];
  let equity = 1000;        // start capital
  let position = null;      // {type:'long'|'short', entry, qty}
  let equityCurve = [equity];

  for (let i = 49; i < n; i++) {
    const price = prices[i];
    const sig = signals[i];

    // Close existing ONLY on an explicit opposite signal (mimics a holding EA,
    // avoids fee bleed from closing on every HOLD).
    if (position) {
      // In 'both' mode: close a long when SELL, close a short when BUY.
      const shouldClose = mode === 'both'
        ? ((position.type === 'long' && sig === 'SELL') || (position.type === 'short' && sig === 'BUY'))
        : (mode === 'long' && sig === 'SELL');
      if (shouldClose) {
        const exit = price;
        let pnl;
        if (position.type === 'long') pnl = (exit - position.entry) * position.qty;
        else pnl = (position.entry - exit) * position.qty;
        pnl -= position.qty * Math.abs(exit) * feePct * 2; // entry+exit fee
        equity += pnl;
        trades.push({ side: position.type, entry: position.entry, exit, qty: position.qty, pnl, entryBar: position.bar, exitBar: i });
        position = null;
      }
    }

    // Open new on explicit signal when flat
    if (!position && (sig === 'BUY' || sig === 'SELL')) {
      const type = sig === 'BUY' ? 'long' : 'short';
      const qty = equity / price; // full position sized on current equity
      position = { type, entry: price, qty, bar: i };
    }
    equityCurve.push(equity);
  }
  // Close open position at last price (mark-to-market optional) — keep unrealized out but note it
  if (position) {
    const exit = prices[n - 1];
    let pnl;
    if (position.type === 'long') pnl = (exit - position.entry) * position.qty;
    else pnl = (position.entry - exit) * position.qty;
    pnl -= position.qty * Math.abs(exit) * feePct * 2;
    trades.push({ side: position.type, entry: position.entry, exit, qty: position.qty, pnl, entryBar: position.bar, exitBar: n - 1, open: true });
    equity += pnl;
    equityCurve[equityCurve.length - 1] = equity;
  }

  // Metrics
  const closed = trades.filter((t) => !t.open);
  const wins = closed.filter((t) => t.pnl > 0);
  let peak = equityCurve[0], maxDD = 0;
  for (const e of equityCurve) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  const prof = equity - 1000;
  const totalReturn = prof / 1000;

  return {
    trades: trades.map((t, idx) => ({ ...t, n: idx + 1 })),
    metrics: {
      totalReturnPct: totalReturn * 100,
      netProfit: prof,
      winRatePct: closed.length ? (wins.length / closed.length) * 100 : 0,
      tradesCount: closed.length,
      wins, losses: closed.length - wins.length,
      maxDrawdownPct: maxDD * 100,
      profitFactor: closed.length ? (closed.filter(t=>t.pnl>0).reduce((a,b)=>a+b.pnl,0) || 0) /
                                   (Math.abs(closed.filter(t=>t.pnl<0).reduce((a,b)=>a+b.pnl,0)) || 0.0001) : 0,
      finalEquity: equity,
    },
    equityCurve,
  };
}

async function runBacktest(apiSymbol, interval, limit, mode = 'both') {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${apiSymbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Backtest fetch: ' + res.status);
  const data = await res.json();
  const prices = data.map((k) => parseFloat(k[4]));
  const { signals, scores } = computeSignals(prices);
  const result = simulate(prices, signals, mode);
  return { ...result, prices };
}

// Attach
if (typeof window !== 'undefined') {
  window.backtest = { computeSignals, simulate, runBacktest };
}