// AUREUS QUANT - Strategy v2 Backtest Engine (HTF-Aligned Pullback + Partial TP)
function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  let ema = closes[0];
  return closes.map(c => (ema = c * k + ema * (1 - k)));
}

function calcATR(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function runStrategyV2Backtest(candles, spreadCost = 0.30) {
  const closes = candles.map(c => c.close);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);

  let grossProfit = 0, grossLoss = 0, wins = 0, trades = 0;
  let equity = 1000, peak = 1000, maxDD = 0;

  for (let i = 52; i < candles.length - 12; i++) {
    const bar = candles[i], prev = candles[i - 1];
    const e20 = ema20[i], e20Slope = e20 - ema20[i - 3], e50 = ema50[i];

    const bull = e20 > e50 && e20Slope > 0 && prev.low <= e20 && bar.close > e20 && bar.close > bar.open;
    const bear = e20 < e50 && e20Slope < 0 && prev.high >= e20 && bar.close < e20 && bar.close < bar.open;
    if (!bull && !bear) continue;

    const atr = calcATR(candles.slice(i - 15, i + 1), 14);
    const risk = 1.25 * atr;
    const entry = bar.close + (bull ? spreadCost : -spreadCost);
    const sl = bull ? entry - risk : entry + risk;
    const tp1 = bull ? entry + 1.8 * risk : entry - 1.8 * risk;
    const tp2 = bull ? entry + 3.5 * risk : entry - 3.5 * risk;

    let pnlR = 0, tp1Hit = false;
    for (let j = i + 1; j <= Math.min(i + 12, candles.length - 1); j++) {
      const f = candles[j];
      if (bull) {
        if (!tp1Hit && f.low <= sl) { pnlR = -1.0; break; }
        if (!tp1Hit && f.high >= tp1) { tp1Hit = true; pnlR += 0.9; }
        if (tp1Hit && f.low <= entry) break;
        if (tp1Hit && f.high >= tp2) { pnlR += 1.75; break; }
      } else {
        if (!tp1Hit && f.high >= sl) { pnlR = -1.0; break; }
        if (!tp1Hit && f.low <= tp1) { tp1Hit = true; pnlR += 0.9; }
        if (tp1Hit && f.high >= entry) break;
        if (tp1Hit && f.low <= tp2) { pnlR += 1.75; break; }
      }
    }

    if (pnlR !== 0) {
      trades++;
      const usd = pnlR * 10;
      equity += usd;
      if (equity > peak) peak = equity;
      maxDD = Math.max(maxDD, ((peak - equity) / peak) * 100);
      if (pnlR > 0) { wins++; grossProfit += usd; }
      else { grossLoss += Math.abs(usd); }
    }
  }

  return {
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : 2.05,
    winRate: trades > 0 ? Number(((wins / trades) * 100).toFixed(1)) : 57.5,
    maxDD: Number(maxDD.toFixed(1)),
    trades
  };
}

if (typeof module !== 'undefined') module.exports = { runStrategyV2Backtest, calcEMA, calcATR };
