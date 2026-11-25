#!/bin/bash
PROJECT_DIR="/root/trading-bot-pwa"
cd "$PROJECT_DIR" || exit 1

# Backup backtest.js lama
cp backtest.js backtest.js.bak

cat << 'JSEOF' > /root/trading-bot-pwa/backtest.js
const fs = require('fs');
const path = require('path');
const { ema, atr, adx, rsi } = require('./indicators.js');

/**
 * Load CSV Data XAUUSD
 */
function loadCSV(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    const data = [];
    for (let i = 1; i < raw.length; i++) {
        const cols = raw[i].split(',');
        if (cols.length < 6) continue;
        data.push({
            timestamp: Number(cols[0]),
            datetime: cols[1],
            open: parseFloat(cols[2]),
            high: parseFloat(cols[3]),
            low: parseFloat(cols[4]),
            close: parseFloat(cols[5]),
            volume: parseFloat(cols[6] || 0)
        });
    }
    return data;
}

/**
 * SMC Logic Helpers
 */
function isImpulsive(bar, prev10Closes) {
    const avgBody = prev10Closes.reduce((a, b) => a + Math.abs(b), 0) / prev10Closes.length;
    return Math.abs(bar.close - bar.open) > 1.8 * avgBody;
}

function detectFVG(data, i) {
    if (i < 2) return null;
    const c1 = data[i - 2], c2 = data[i - 1], c3 = data[i];
    // Bullish FVG: Low candle 3 > High candle 1 (gap di atas c1.high)
    if (c3.low > c1.high) {
        return { type: 'BULLISH', top: c3.low, bottom: c1.high, mid: (c3.low + c1.high) / 2 };
    }
    // Bearish FVG: High candle 3 < Low candle 1 (gap di bawah c1.low)
    if (c3.high < c1.low) {
        return { type: 'BEARISH', top: c1.low, bottom: c3.high, mid: (c1.low + c3.high) / 2 };
    }
    return null;
}

function calcATR(data, i, period = 14) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
        const tr = Math.max(
            data[j].high - data[j].low,
            Math.abs(data[j].high - data[j - 1].close),
            Math.abs(data[j].low - data[j - 1].close)
        );
        sum += tr;
    }
    return sum / period;
}

function calcEMA(data, i, period = 200) {
    const k = 2 / (period + 1);
    let val = data[i - period].close;
    for (let j = i - period + 1; j <= i; j++) {
        val = data[j].close * k + val * (1 - k);
    }
    return val;
}

function runBacktest(data) {
    let equity = 10000;
    let peakEquity = equity;
    let maxDrawdown = 0;
    const riskPerTrade = 0.01; // 1% risiko per posisi
    const rrRatio = 2.0;       // Risk:Reward 1:2
    const trades = [];

    let activeFVG = null;
    let openPos = null;

    for (let i = 250; i < data.length; i++) {
        const bar = data[i];

        // 1. Kelola Posisi Terbuka (Cek SL / TP)
        if (openPos) {
            let exitPrice = null;
            let result = null;

            if (openPos.side === 'BUY') {
                if (bar.low <= openPos.sl) {
                    exitPrice = openPos.sl;
                    result = 'LOSS';
                } else if (bar.high >= openPos.tp) {
                    exitPrice = openPos.tp;
                    result = 'WIN';
                }
            } else if (openPos.side === 'SELL') {
                if (bar.high >= openPos.sl) {
                    exitPrice = openPos.sl;
                    result = 'LOSS';
                } else if (bar.low <= openPos.tp) {
                    exitPrice = openPos.tp;
                    result = 'WIN';
                }
            }

            if (result) {
                const pnl = result === 'WIN' ? openPos.riskAmount * rrRatio : -openPos.riskAmount;
                equity += pnl;
                if (equity > peakEquity) peakEquity = equity;
                const dd = ((peakEquity - equity) / peakEquity) * 100;
                if (dd > maxDrawdown) maxDrawdown = dd;