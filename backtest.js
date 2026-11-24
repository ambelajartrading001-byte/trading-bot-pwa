// backtest.js — LNY-TPE v2.0 Backtester (HTF-Aligned Pullback + Partial TP)
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
        const prevBar = data[i - 1];
        const prev = data.slice(0, i + 1);
        const closes = prev.map(d => d.close);

        const date = new Date(t.timestamp * 1000);
        const day = date.getUTCDay();
        const hour = date.getUTCHours();
        const dateStr = date.toISOString().split('T')[0];

        if (dateStr !== lastDate) { realizedLossToday = 0; lastDate = dateStr; }

        const e20 = ema(closes.slice(-50), 20);
        const e20Prev = ema(closes.slice(-53, -3), 20);
        const e50 = ema(closes.slice(-100), 50);
        const e200 = ema(closes.slice(-250), 200);
        const atrVal = atr(prev.slice(-30), 14);
        const adxVal = adx(prev.slice(-30), 14);
        const rsiVal = rsi(prev.slice(-30), 14);

        // Exit Logic v2: Partial TP 50% at 1.8R + Breakeven + Runner 3.5R
        if (position) {
            const entryPrice = position.entryPrice;
            const size = position.size;
            let exitPrice = null;
            let reason = "";

            if (position.type === 'LONG') {
                if (!position.tp1Hit && t.high >= position.tp1) {
                    position.tp1Hit = true;
                    position.sl = entryPrice; // Geser SL ke Breakeven
                    const partialProfit = (position.tp1 - entryPrice) * (size * 0.5) - 0.15 * size;
                    equity += partialProfit;
                    position.partialPnl = partialProfit;
                }
                if (t.low <= position.sl) { exitPrice = position.sl; reason = position.tp1Hit ? 'BE' : 'SL'; }
                else if (t.high >= position.tp2) { exitPrice = position.tp2; reason = 'TP2'; }
            } else {
                if (!position.tp1Hit && t.low <= position.tp1) {
                    position.tp1Hit = true;
                    position.sl = entryPrice;
                    const partialProfit = (entryPrice - position.tp1) * (size * 0.5) - 0.15 * size;
                    equity += partialProfit;
                    position.partialPnl = partialProfit;
                }
                if (t.high >= position.sl) { exitPrice = position.sl; reason = position.tp1Hit ? 'BE' : 'SL'; }
                else if (t.low <= position.tp2) { exitPrice = position.tp2; reason = 'TP2'; }
            }

            if (exitPrice !== null) {
                const remSize = position.tp1Hit ? size * 0.5 : size;
                const remProfit = (position.type === 'LONG' ? (exitPrice - entryPrice) : (entryPrice - exitPrice)) * remSize - 0.15 * remSize;
                equity += remProfit;
                const totalProfit = (position.partialPnl || 0) + remProfit;
                if (totalProfit < 0) realizedLossToday += Math.abs(totalProfit);
                trades.push({ ...position, exitPrice, profit: totalProfit, reason });
                position = null;
            }
        }

        // Entry Logic v2: Trend Slope + RSI Pullback Filter + 1.25x ATR SL
        if (!position && ((hour >= 7 && hour <= 18 && day !== 5) || (day === 5 && hour < 17))) {
            if (adxVal >= 24 && realizedLossToday < (equity * 0.02)) {
                const risk = equity * 0.01;
                const slDist = 1.25 * atrVal;
                const nextOpen = data[i + 1].open;

                if (e20 > e50 && e50 > e200 && e20 > e20Prev && t.close > e200 && rsiVal >= 42 && rsiVal <= 56 && prevBar.low <= e20 && t.close > e20) {
                    position = {
                        type: 'LONG', entryPrice: nextOpen,
                        sl: nextOpen - slDist,
                        tp1: nextOpen + 1.8 * slDist,
                        tp2: nextOpen + 3.5 * slDist,
                        size: risk / slDist, tp1Hit: false, partialPnl: 0
                    };
                } else if (e20 < e50 && e50 < e200 && e20 < e20Prev && t.close < e200 && rsiVal >= 44 && rsiVal <= 58 && prevBar.high >= e20 && t.close < e20) {
                    position = {
                        type: 'SHORT', entryPrice: nextOpen,
                        sl: nextOpen + slDist,
                        tp1: nextOpen - 1.8 * slDist,
                        tp2: nextOpen - 3.5 * slDist,
                        size: risk / slDist, tp1Hit: false, partialPnl: 0
                    };
                }
            }
        }
    }
    return { finalEquity: equity, trades };
}

if (typeof module !== 'undefined') module.exports = { runBacktest };
