// indicators.js — Technical indicators (EMA, ADX, ATR, RSI)
// All functions accept arrays of objects {open, high, low, close, volume, timestamp}
// Timestamps are in seconds.

'use strict';

function ema(values, period) {
  if (values.length === 0) return null;
  const k = 2 / (period + 1);
  let prev = values[0]; // Simplification for startup
  // Calculate first SMA for start
  if (values.length >= period) {
    let sum = 0;
    for(let i=0; i<period; i++) sum += values[i];
    prev = sum / period;
  }
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

// True Range & ATR
function atr(data, period = 14) {
  if (data.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low;
    const hpc = Math.abs(data[i].high - data[i - 1].close);
    const lpc = Math.abs(data[i].low - data[i - 1].close);
    trs.push(Math.max(hl, hpc, lpc));
  }
  // Wilder's smoothing
  let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period;
  }
  return atrVal;
}

// ADX(14)
function adx(data, period = 14) {
    if (data.length < period * 2) return null;
    let trs = [], plusDMs = [], minusDMs = [];
    for(let i=1; i<data.length; i++) {
        const tr = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i-1].close), Math.abs(data[i].low - data[i-1].close));
        const pdm = (data[i].high - data[i-1].high > data[i-1].low - data[i].low) ? Math.max(data[i].high - data[i-1].high, 0) : 0;
        const mdm = (data[i-1].low - data[i].low > data[i].high - data[i-1].high) ? Math.max(data[i-1].low - data[i].low, 0) : 0;
        trs.push(tr); plusDMs.push(pdm); minusDMs.push(mdm);
    }
    // Smooth
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let pDI = plusDMs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let mDI = minusDMs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for(let i=period; i<trs.length; i++) {
        atr = (atr * (period - 1) + trs[i]) / period;
        pDI = (pDI * (period - 1) + plusDMs[i]) / period;
        mDI = (mDI * (period - 1) + minusDMs[i]) / period;
    }
    const dx = 100 * Math.abs(pDI - mDI) / (pDI + mDI);
    return dx;
}

// RSI
function rsi(data, period = 14) {
  if (data.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
}

if (typeof window !== 'undefined') {
  window.indicators = { ema, atr, adx, rsi };
}
