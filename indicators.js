// indicators.js — Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands)
// All functions accept arrays of closing prices (numbers), oldest first.

'use strict';

function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values, period) {
  if (values.length === 0) return null;
  const k = 2 / (period + 1);
  let prev = sma(values.slice(0, period), period);
  if (prev === null) return null;
  const start = Math.min(period, values.length);
  for (let i = start; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

// RSI (Wilder smoothing). Returns single value for most recent close.
function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// MACD: returns {macd, signal, hist}
function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  // Approximate by computing EMA on full series progressively.
  const emaFastArr = []; const emaSlowArr = [];
  const kf = 2 / (fast + 1), ks = 2 / (slow + 1);
  let ef = null, es = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    ef = ef === null ? v : v * kf + ef * (1 - kf);
    es = es === null ? v : v * ks + es * (1 - ks);
    if (i >= slow - 1) emaFastArr.push(ef - es);
  }
  if (emaFastArr.length === 0) return null;
  const ksig = 2 / (signalPeriod + 1);
  let sig = null;
  const macdVals = [], sigVals = [];
  for (const m of emaFastArr) {
    sig = sig === null ? m : m * ksig + sig * (1 - ksig);
    macdVals.push(m); sigVals.push(sig);
  }
  const m = macdVals[macdVals.length - 1];
  const s = sigVals[sigVals.length - 1];
  return { macd: m, signal: s, hist: m - s };
}

// Bollinger Bands: returns {upper, middle, lower}
function bollinger(values, period = 20, mult = 2) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: middle + mult * sd, middle, lower: middle - mult * sd };
}

// Composite strategy signal from all indicators.
// Returns { signal: 'BUY'|'SELL'|'HOLD', score, reasons: [string] }
function strategySignal(prices) {
  if (prices.length < 50) return { signal: 'HOLD', score: 0, reasons: ['Data belum cukup'] };
  const reasons = [];
  let score = 0;
  const last = prices[prices.length - 1];

  // 1. Trend: price vs SMA20 & SMA50
  const sma20 = sma(prices, 20);
  const sma50 = sma(prices, 50);
  if (sma20 && sma50) {
    if (sma20 > sma50) { score += 2; reasons.push('SMA20 > SMA50 (trend naik)'); }
    else { score -= 2; reasons.push('SMA20 < SMA50 (trend turun)'); }
    if (last > sma20) { score += 1; reasons.push('Harga > SMA20'); } else { score -= 1; reasons.push('Harga < SMA20'); }
  }

  // 2. Momentum: RSI
  const r = rsi(prices, 14);
  if (r !== null) {
    if (r < 30) { score += 2; reasons.push(`RSI ${r.toFixed(1)} oversold`); }
    else if (r > 70) { score -= 2; reasons.push(`RSI ${r.toFixed(1)} overbought`); }
    else if (r > 50) { score += 1; reasons.push(`RSI ${r.toFixed(1)} bullish`); }
    else { score -= 1; reasons.push(`RSI ${r.toFixed(1)} bearish`); }
  }

  // 3. Momentum: MACD histogram
  const m = macd(prices);
  if (m) {
    if (m.hist > 0) { score += 1; reasons.push('MACD histogram positif'); } else { score -= 1; reasons.push('MACD histogram negatif'); }
    if (m.macd > m.signal) { score += 1; reasons.push('MACD > signal'); } else { score -= 1; reasons.push('MACD < signal'); }
  }

  // 4. Volatility: Bollinger — mean reversion
  const bb = bollinger(prices);
  if (bb) {
    if (last <= bb.lower) { score += 2; reasons.push('Harga di bawah Band bawah (oversold)'); }
    else if (last >= bb.upper) { score -= 2; reasons.push('Harga di atas Band atas (overbought)'); }
  }

  const signal = score >= 3 ? 'BUY' : (score <= -3 ? 'SELL' : 'HOLD');
  return { signal, score, reasons };
}

// Attach to window for app.js
if (typeof window !== 'undefined') {
  window.indicators = {
    sma, ema, rsi, macd, bollinger, strategySignal,
    fetchCloses: null, // set by app.js
  };
}