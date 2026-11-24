// backtest.js — LNY-TPE v1.0 Backtester
'use strict';

const { ema, atr, adx, rsi } = require('./indicators.js');

function runBacktest(data) {
    let equity = 10000;
    let position = null;
    const trades = [];
    let realizedLossToday = 0;
    let lastDate = null;

    for (let i = 250; i < data.length - 1; i++) {
        const t = data[i];
        const prev = data.slice(0, i + 1);
        const closes = prev.map(d => d.close);
        
        const date = new Date(t.timestamp * 1000);
        const day = date.getUTCDay();
        const hour = date.getUTCHours();
        const dateStr = date.toISOString().split('T')[0];

        if (dateStr !== lastDate) { realizedLossToday = 0; lastDate = dateStr; }

        // Indicators
        const e20 = ema(closes.slice(-50), 20); // Simplified
        const e50 = ema(closes.slice(-100), 50);
        const e200 = ema(closes.slice(-250), 200);
        const atrVal = atr(prev.slice(-30), 14);
        const adxVal = adx(prev.slice(-30), 14);
        const rsiVal = rsi(prev.slice(-30), 14);

        // Exit Logic
        if (position) {
            const entryPrice = position.entryPrice;
            const size = position.size;
            
            // Check SL/TP
            let exitPrice = null;
            let reason = "";

            // Simple SL/TP check
            if (position.type === 'LONG') {
                if (t.low <= position.sl) { exitPrice = position.sl; reason = 'SL'; }
                else if (t.high >= position.tp) { exitPrice = position.tp; reason = 'TP'; }
            } else {
                if (t.high >= position.sl) { exitPrice = position.sl; reason = 'SL'; }
                else if (t.low <= position.tp) { exitPrice = position.tp; reason = 'TP'; }
            }

            if (exitPrice) {
                const profit = (position.type === 'LONG' ? (exitPrice - entryPrice) : (entryPrice - exitPrice)) * size - 0.30 * size;
                equity += profit;
                if (profit < 0) realizedLossToday += Math.abs(profit);
                trades.push({ ...position, exitPrice, profit, reason });
                position = null;
            }
        }

        // Entry Logic
        if (!position && hour >= 7 && hour <= 18 && day !== 5 || (day === 5 && hour < 17)) {
            if (adxVal >= 22 && realizedLossToday < (equity * 0.02)) {
                // Bullish
                if (e20 > e50 && e50 > e200 && t.close > e200) {
                     // Long entry conditions...
                     const risk = equity * 0.01;
                     const slDist = 1.5 * atrVal;
                     position = { type: 'LONG', entryPrice: data[i+1].open, sl: data[i+1].open - slDist, tp: data[i+1].open + 3.75 * atrVal, size: risk / slDist };
                }
            }
        }
    }
    return { finalEquity: equity, trades };
}
