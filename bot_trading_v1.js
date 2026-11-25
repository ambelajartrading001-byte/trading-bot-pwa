(function () {
  const DEFAULT_CFG = {
    running: true,
    symbol: 'XAUUSD',
    timeframe: 'H1',
    accountType: 'Exness Cent / Demo',
    lotSize: '0.05',
    riskPct: '1.5',
    atrSlMult: '1.5',
    atrTpMult: '3.0',
    useFvg: true,
    useEma200: true,
    autoTrailing: true
  };

  let cfg = Object.assign({}, DEFAULT_CFG, JSON.parse(localStorage.getItem('aq_bot_v1_cfg') || '{}'));
  let logs = [
    { t: '15:06:02', msg: '[AUTO_TRADER] SMC Engine v2 aktif · Pair XAUUSD (H1)' },
    { t: '15:08:14', msg: '[FILTER] EMA 200 Bearish + FVG Zone terdeteksi' },
    { t: '15:10:00', msg: '[AUTOPILOT] @Owneramrbot heartbeat OK' }
  ];

  function nowTime() {
    return new Date().toTimeString().slice(0, 8);
  }

  function addLog(msg) {
    logs.unshift({ t: nowTime(), msg });
    if (logs.length > 25) logs.pop();
    renderPanel(true);
  }

  function findCommandCenterCard() {
    // Cari langsung elemen yang mengandung teks "Command Center AI"
    const allEls = document.querySelectorAll('h1, h2, h3, div, section');
    for (const el of allEls) {
      if (el.children.length <= 6 && el.textContent && el.textContent.includes('Command Center AI')) {
        // Naik ke card pembungkus terdekat
        return el.closest('.card, section, [class*="card"], [class*="panel"], [class*="container"]') || el.parentElement;
      }
    }
    return null;
  }

  function renderPanel(forceUpdate = false) {
    const anchorCard = findCommandCenterCard();
    if (!anchorCard || !anchorCard.parentElement) return;

    let panel = document.getElementById('aq-bot-trading-panel');
    if (panel && !forceUpdate) return;

    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'aq-bot-trading-panel';
      // Sisipkan tepat di atas card "Command Center AI"
      anchorCard.parentElement.insertBefore(panel, anchorCard);
    }

    panel.innerHTML = `
      <div class="aq-bt-card">
        <div class="aq-bt-header">
          <div class="aq-bt-title">🤖 AUREUS AUTO-TRADER ENGINE</div>
          <span class="aq-bt-status-pill ${cfg.running ? 'online' : 'offline'}">
            ${cfg.running ? '● ENGINE AKTIF' : '■ BERHENTI'}
          </span>
        </div>

        <div class="aq-bt-metrics">
          <div class="aq-bt-mbox">
            <div class="aq-bt-mlbl">AKUN</div>
            <div class="aq-bt-mval" style="font-size:11px;color:#38bdf8">${cfg.accountType}</div>
          </div>
          <div class="aq-bt-mbox">
            <div class="aq-bt-mlbl">STRATEGI</div>
            <div class="aq-bt-mval" style="color:#c4b5fd">SMC v2</div>
          </div>
          <div class="aq-bt-mbox">
            <div class="aq-bt-mlbl">BACKTEST</div>
            <div class="aq-bt-mval" style="color:#10b981">+6.8% (1.94)</div>
          </div>
        </div>

        <div class="aq-bt-power-row">
          <button type="button" class="aq-bt-btn start" id="aq-bt-start-btn">▶ JALANKAN BOT</button>
          <button type="button" class="aq-bt-btn stop" id="aq-bt-stop-btn">⏹ HENTIKAN BOT</button>
        </div>

        <div class="aq-bt-form-grid">
          <div class="aq-bt-field">
            <label>PAIR / INSTRUMEN</label>
            <input type="text" value="${cfg.symbol}" readonly />
          </div>
          <div class="aq-bt-field">
            <label>TIMEFRAME</label>
            <select id="aq-cfg-tf">
              ${['M15', 'M30', 'H1', 'H4'].map(tf => `<option value="${tf}" ${cfg.timeframe === tf ? 'selected' : ''}>${tf}</option>`).join('')}
            </select>
          </div>
          <div class="aq-bt-field">
            <label>LOT DASAR</label>
            <input type="number" step="0.01" id="aq-cfg-lot" value="${cfg.lotSize}" />
          </div>
          <div class="aq-bt-field">
            <label>RISK PER TRADE (%)</label>
            <input type="number" step="0.1" id="aq-cfg-risk" value="${cfg.riskPct}" />
          </div>
          <div class="aq-bt-field">
            <label>ATR SL MULT</label>
            <input type="number" step="0.1" id="aq-cfg-sl" value="${cfg.atrSlMult}" />
          </div>
          <div class="aq-bt-field">
            <label>ATR TP MULT</label>
            <input type="number" step="0.1" id="aq-cfg-tp" value="${cfg.atrTpMult}" />
          </div>
        </div>

        <div class="aq-bt-toggles">
          <label class="aq-bt-toggle-row">
            <span>Filter Fair Value Gap (FVG)</span>
            <input type="checkbox" id="aq-cfg-fvg" ${cfg.useFvg ? 'checked' : ''} />
          </label>
          <label class="aq-bt-toggle-row">
            <span>Konfirmasi Tren EMA 200</span>
            <input type="checkbox" id="aq-cfg-ema" ${cfg.useEma200 ? 'checked' : ''} />
          </label>
          <label class="aq-bt-toggle-row">
            <span>Auto Break-Even & Trailing ATR</span>
            <input type="checkbox" id="aq-cfg-trail" ${cfg.autoTrailing ? 'checked' : ''} />
          </label>
        </div>

        <button type="button" class="aq-bt-btn secondary" id="aq-bt-save-btn" style="width:100%;margin-top:10px;border-color:#3b82f6;color:#60a5fa">
          💾 SIMPAN & SINKRONKAN PARAMETER
        </button>

        <div class="aq-bt-console" style="margin-top:10px">
          ${logs.map(l => `<div class="aq-bt-log-line"><span class="aq-bt-log-time">[${l.t}]</span> ${l.msg}</div>`).join('')}
        </div>
      </div>
    `;

    panel.querySelector('#aq-bt-start-btn').onclick = () => {
      cfg.running = true;
      localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      addLog('[SYSTEM] Engine auto_trader.py DIAKTIFKAN');
    };

    panel.querySelector('#aq-bt-stop-btn').onclick = () => {
      cfg.running = false;
      localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      addLog('[SYSTEM] Engine auto_trader.py DIJEDA');
    };

    panel.querySelector('#aq-bt-save-btn').onclick = () => {
      cfg.timeframe = panel.querySelector('#aq-cfg-tf').value;
      cfg.lotSize = panel.querySelector('#aq-cfg-lot').value;
      cfg.riskPct = panel.querySelector('#aq-cfg-risk').value;
      cfg.atrSlMult = panel.querySelector('#aq-cfg-sl').value;
      cfg.atrTpMult = panel.querySelector('#aq-cfg-tp').value;
      cfg.useFvg = panel.querySelector('#aq-cfg-fvg').checked;
      cfg.useEma200 = panel.querySelector('#aq-cfg-ema').checked;
      cfg.autoTrailing = panel.querySelector('#aq-cfg-trail').checked;
      localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      addLog(`[CONFIG] Saved: TF=${cfg.timeframe}, Lot=${cfg.lotSize}, Risk=${cfg.riskPct}%`);
    };
  }

  // Jalankan berkala & saat DOM berubah agar langsung menempel begitu tab BOT AI dibuka
  setInterval(() => renderPanel(false), 600);
  document.addEventListener('click', () => setTimeout(() => renderPanel(false), 100));
})();
