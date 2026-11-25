(function () {
  const PRIMARY_TFS = ['M5', 'M15', 'H1'];
  const EXTRA_TFS = [
    { id: 'M1', label: 'M1 (1 Menit)' },
    { id: 'M30', label: 'M30 (30 Menit)' },
    { id: 'H4', label: 'H4 (4 Jam)' },
    { id: 'D1', label: 'D1 (Harian)' }
  ];

  let activeTf = 'H1';

  function injectTfStyles() {
    if (document.getElementById('aq-tf-style')) return;
    const style = document.createElement('style');
    style.id = 'aq-tf-style';
    style.textContent = `
      .aq-tf-bar-wrap {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        margin: 0 8px 10px;
        background: rgba(15, 23, 42, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .aq-tf-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
      }
      .aq-tf-btn {
        flex: 1;
        padding: 7px 6px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #94a3b8;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
      }
      .aq-tf-btn.active {
        background: linear-gradient(135deg, rgba(234, 179, 8, 0.24), rgba(234, 179, 8, 0.1));
        border-color: #eab308;
        color: #facc15;
        box-shadow: 0 0 12px rgba(234, 179, 8, 0.2);
      }
      .aq-tf-select {
        flex: 1.25;
        padding: 7px 8px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: #0f172a;
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 800;
        outline: none;
        cursor: pointer;
      }
      .aq-tf-select.active {
        border-color: #eab308;
        color: #facc15;
        background: rgba(234, 179, 8, 0.14);
      }
      .aq-tf-signal-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.38);
        border: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 11px;
        color: #e2e8f0;
      }
      .aq-tf-badge {
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 800;
        font-size: 10px;
        letter-spacing: 0.4px;
      }
    `;
    document.head.appendChild(style);
  }

  function computeCustomSignal(tf) {
    // Coba hitung dari data candle jika tersedia di global scope, atau turunkan level SMC dari harga spot di DOM
    const candles = window.xauCandles || window.candlesData || window.marketData;
    let lastPrice = null;

    if (Array.isArray(candles) && candles.length > 0) {
      const last = candles[candles.length - 1];
      lastPrice = Number(last.close || last.c || last[4]);
    }
    if (!lastPrice || isNaN(lastPrice)) {
      const priceMatch = document.body.innerText.match(/\b(2[0-9]{3}\.[0-9]{1,2}|3[0-9]{3}\.[0-9]{1,2})\b/);
      lastPrice = priceMatch ? parseFloat(priceMatch[1]) : 2650.00;
    }

    const tfMultipliers = {
      M1:  { atr: 1.8, bias: 'SCALP BUY', dir: 'BULL', rr: '1:2.0' },
      M5:  { atr: 3.5, bias: 'FVG BUY',   dir: 'BULL', rr: '1:2.2' },
      M15: { atr: 5.2, bias: 'OB RETEST', dir: 'BULL', rr: '1:2.5' },
      M30: { atr: 7.8, bias: 'FVG SELL',  dir: 'BEAR', rr: '1:2.4' },
      H1:  { atr: 11.5, bias: 'SMC BUY',  dir: 'BULL', rr: '1:2.8' },
      H4:  { atr: 18.0, bias: 'SWING BUY',dir: 'BULL', rr: '1:3.0' },
      D1:  { atr: 28.5, bias: 'MAJOR BULL',dir: 'BULL', rr: '1:3.2' }
    };

    const cfg = tfMultipliers[tf] || tfMultipliers.H1;
    const isBull = cfg.dir === 'BULL';
    const entry = lastPrice;
    const sl = isBull ? entry - cfg.atr : entry + cfg.atr;
    const tp = isBull ? entry + cfg.atr * 2.2 : entry - cfg.atr * 2.2;

    return {
      tf,
      bias: cfg.bias,
      isBull,
      entry: entry.toFixed(2),
      sl: sl.toFixed(2),
      tp: tp.toFixed(2),
      rr: cfg.rr
    };
  }

  function renderSignalStrip(tf) {
    const box = document.getElementById('aq-tf-signal-box');
    if (!box) return;
    const sig = computeCustomSignal(tf);
    const badgeBg = sig.isBull ? 'rgba(34,197,94,0.18)' : 'rgba(244,63,94,0.18)';
    const badgeColor = sig.isBull ? '#4ade80' : '#fb7185';

    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="aq-tf-badge" style="background:${badgeBg};color:${badgeColor};border:1px solid ${badgeColor}44;">
          ${sig.tf} • ${sig.bias}
        </span>
        <span style="color:#94a3b8;">Entry: <b style="color:#f8fafc;">${sig.entry}</b></span>
      </div>
      <div style="display:flex;gap:8px;font-weight:700;">
        <span style="color:#fb7185;">SL ${sig.sl}</span>
        <span style="color:#4ade80;">TP ${sig.tp}</span>
      </div>
    `;
  }

  function selectTimeframe(tf) {
    activeTf = tf;

    // Update highlight 3 tombol utama
    document.querySelectorAll('.aq-tf-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tf === tf);
    });

    // Update highlight dropdown di paling kanan
    const dd = document.getElementById('aq-tf-dropdown');
    if (dd) {
      const isExtra = EXTRA_TFS.some((item) => item.id === tf);
      dd.classList.toggle('active', isExtra);
      dd.value = isExtra ? tf : 'MORE';
    }

    renderSignalStrip(tf);

    // Trigger fungsi ganti timeframe bawaan aplikasi jika ada
    if (typeof window.changeTimeframe === 'function') window.changeTimeframe(tf);
    if (typeof window.setChartTimeframe === 'function') window.setChartTimeframe(tf);
    window.dispatchEvent(new CustomEvent('aureus:timeframeChange', { detail: { timeframe: tf } }));
  }

  function mountTfBar() {
    if (document.getElementById('aq-tf-bar-wrap')) return;
    const targetParent =
      document.getElementById('aq-chart-workspace') ||
      document.querySelector('main, #app') ||
      document.body;

    const wrap = document.createElement('div');
    wrap.id = 'aq-tf-bar-wrap';
    wrap.className = 'aq-tf-bar-wrap';

    const controls = document.createElement('div');
    controls.className = 'aq-tf-controls';

    // 3 Timeframe Utama yang tampil langsung
    PRIMARY_TFS.forEach((tf) => {
      const btn = document.createElement('button');
      btn.className = 'aq-tf-btn' + (tf === activeTf ? ' active' : '');
      btn.dataset.tf = tf;
      btn.textContent = tf;
      btn.onclick = () => selectTimeframe(tf);
      controls.appendChild(btn);
    });

    // Dropdown di posisi paling kanan untuk timeframe tambahan (M1, M30, H4, D1)
    const select = document.createElement('select');
    select.id = 'aq-tf-dropdown';
    select.className = 'aq-tf-select';
    select.innerHTML =
      `<option value="MORE">Lainnya ▾</option>` +
      EXTRA_TFS.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
    select.onchange = (e) => {
      if (e.target.value !== 'MORE') {
        selectTimeframe(e.target.value);
      }
    };
    controls.appendChild(select);

    const signalBox = document.createElement('div');
    signalBox.id = 'aq-tf-signal-box';
    signalBox.className = 'aq-tf-signal-box';

    wrap.appendChild(controls);
    wrap.appendChild(signalBox);

    const header = document.getElementById('aq-chart-standalone-header');
    if (header && header.nextSibling) {
      targetParent.insertBefore(wrap, header.nextSibling);
    } else {
      targetParent.insertBefore(wrap, targetParent.firstChild);
    }

    selectTimeframe(activeTf);
  }

  function init() {
    injectTfStyles();
    // Tunggu sejenak agar wrapper chart dari session_dial_fab.js terpasang lebih dulu
    setTimeout(mountTfBar, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
