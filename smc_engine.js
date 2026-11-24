const SMCEngine = {
  scanZones(candles) {
    if (!Array.isArray(candles) || candles.length < 15) return { ob: null, fvg: null };
    let ob = null, fvg = null;
    for (let i = 10; i < candles.length - 1; i++) {
      const slice = candles.slice(i - 10, i);
      const avgBody = slice.reduce((a, c) => a + Math.abs(c.close - c.open), 0) / 10;
      const cur = candles[i], prev = candles[i - 1];
      if (Math.abs(cur.close - cur.open) > 1.8 * avgBody) {
        const bull = cur.close > cur.open;
        ob = { type: bull ? 'BULLISH OB' : 'BEARISH OB', price: bull ? prev.low : prev.high, color: bull ? '#00e5a8' : '#ff5c75' };
      }
      if (i >= 2) {
        const c1 = candles[i - 2], c3 = candles[i];
        if (c3.low > c1.high) fvg = { type: 'BULL FVG', price: +((c3.low + c1.high) / 2).toFixed(2), color: '#38bdf8' };
        else if (c3.high < c1.low) fvg = { type: 'BEAR FVG', price: +((c3.high + c1.low) / 2).toFixed(2), color: '#fb923c' };
      }
    }
    return { ob, fvg };
  }
};
if (typeof window !== 'undefined') window.SMCEngine = SMCEngine;
if (typeof module !== 'undefined') module.exports = SMCEngine;
