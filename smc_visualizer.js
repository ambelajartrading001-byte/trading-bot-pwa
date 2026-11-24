const SMCVisualizer = {
  lines: [],
  render(series, candles) {
    if (!series || typeof SMCEngine === 'undefined') return;
    this.lines.forEach(l => { try { series.removePriceLine(l); } catch (_) {} });
    this.lines = [];
    const { ob, fvg } = SMCEngine.scanZones(candles);
    if (ob) this.lines.push(series.createPriceLine({ price: ob.price, color: ob.color, lineWidth: 1, lineStyle: 3, title: ob.type }));
    if (fvg) this.lines.push(series.createPriceLine({ price: fvg.price, color: fvg.color, lineWidth: 1, lineStyle: 1, title: fvg.type }));
  }
};
if (typeof window !== 'undefined') window.SMCVisualizer = SMCVisualizer;
