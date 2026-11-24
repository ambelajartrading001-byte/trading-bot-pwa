const fs = require('fs');
const path = require('path');

function loadCSV(filePath) {
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    return lines.slice(1).map(l => {
        const [timestamp, datetime, open, high, low, close, volume] = l.split(',');
        return {
            timestamp: Number(timestamp),
            datetime,
            open: +open,
            high: +high,
            low: +low,
            close: +close,
            volume: +(volume || 0)
        };
    }).filter(d => !isNaN(d.close));
}

function calcEMA(data, i, period = 200) {
    const k = 2 / (period + 1);
    let val = data[i - period].close;
    for (let j = i - period + 1; j <= i; j++) val = data[j].close * k + val * (1 - k);
    return val;
}

function calcATR(data, i, period = 14) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
        sum += Math.max(
            data[j].high - data[j].low,
            Math.abs(data[j].high - data[j - 1].close),
            Math.abs(data[j].low - data[j - 1].close)
        );
    }
    return sum / period;
}

function runBacktest(data) {
    let equity = 10000, peak = 10000, maxDD = 0;
    const riskPct = 0.01, rr = 2.0;
    const trades = [];
    let fvg = null, pos = null;

    for (let i = 250; i < data.length; i++) {
        const b = data[i];

        if (pos) {
            let res = null, exitPrice = null;
            if (pos.side === 'BUY') {
                if (b.low <= pos.sl) { res = 'LOSS'; exitPrice = pos.sl; }
                else if (b.high >= pos.tp) { res = 'WIN'; exitPrice = pos.tp; }
            } else {
                if (b.high >= pos.sl) { res = 'LOSS'; exitPrice = pos.sl; }
                else if (b.low <= pos.tp) { res = 'WIN'; exitPrice = pos.tp; }
            }
            if (res) {
                const pnl = res === 'WIN' ? pos.risk * rr : -pos.risk;
                equity += pnl;
                if (equity > peak) peak = equity;
                maxDD = Math.max(maxDD, ((peak - equity) / peak) * 100);
                trades.push({ ...pos, exitTime: b.datetime, exitPrice, res, pnl: +pnl.toFixed(2) });
                pos = null;
            }
            continue;
        }

        const ema200 = calcEMA(data, i, 200);
        let avgBody = 0;
        for (let j = i - 10; j < i; j++) avgBody += Math.abs(data[j].close - data[j].open);
        avgBody /= 10;

        const c1 = data[i - 2], c2 = data[i - 1], c3 = b;
        const impulsive = Math.abs(c2.close - c2.open) > 1.8 * avgBody;

        if (impulsive && c3.low > c1.high && b.close > ema200) {
            fvg = { side: 'BUY', top: c3.low, bot: c1.high, exp: i + 12 };
        } else if (impulsive && c3.high < c1.low && b.close < ema200) {
            fvg = { side: 'SELL', top: c1.low, bot: c3.high, exp: i + 12 };
        }

        if (fvg) {
            if (i > fvg.exp) { fvg = null; continue; }
            const atr = calcATR(data, i, 14);
            const risk = equity * riskPct;

            if (fvg.side === 'BUY' && b.low <= fvg.top && b.close > fvg.bot) {
                const sl = +(fvg.bot - 0.5 * atr).toFixed(2);
                const dist = b.close - sl;
                if (dist > 0) {
                    pos = { side: 'BUY', entryTime: b.datetime, entry: b.close, sl, tp: +(b.close + dist * rr).toFixed(2), risk };
                    fvg = null;
                }
            } else if (fvg.side === 'SELL' && b.high >= fvg.bot && b.close < fvg.top) {
                const sl = +(fvg.top + 0.5 * atr).toFixed(2);
                const dist = sl - b.close;
                if (dist > 0) {
                    pos = { side: 'SELL', entryTime: b.datetime, entry: b.close, sl, tp: +(b.close - dist * rr).toFixed(2), risk };
                    fvg = null;
                }
            }
        }
    }