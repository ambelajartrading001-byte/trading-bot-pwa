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
    { t: '15:15:02', msg: '[AUTO_TRADER] SMC Engine v2 siap · XAUUSD (H1)' },
    { t: '15:15:10', msg: '[ISOLATION] Terkunci khusus di tab BOT AI' }
  ];

  function nowTime() {
    return new Date().toTimeString().slice(0, 8);
  }

  function addLog(msg) {
    logs.unshift({ t: nowTime(), msg });
    if (logs.length > 25) logs.pop();
    renderBotAiOnly(true);
  }

  // Bersihkan jika sempat menempel di Beranda atau di dalam Floating Radial Menu
  function cleanLeaks() {
    const forbidden = [
      '#beranda', '#home', '#tab-beranda', '#dashboard',
      '[data-tab="beranda"]', '[data-page="home"]',
      '#aq-radial-menu', '.radial-menu', '.fab-menu', '[class*="radial"]', '[class*="floating"]'
    ];
    forbidden.forEach(sel => {
      document.querySelectorAll(sel).forEach(container => {
        const leaked = container.querySelector('#aq-bot-trading-panel, #aq-bot-trading-workspace, [data-aq-bot-shortcut]');
        if (leaked) leaked.remove();
      });
    });
  }

  // Cek ketat: hanya true jika tab BOT AI di bottom nav aktif & kartu Command Center AI sedang tampil
  function isStrictlyBotAiTab() {
    const ccCard = Array.from(document.querySelectorAll('div, section')).find(
      el => el.offsetParent !== null && el.children.length <= 6 && el.textContent && el.textContent.includes('Command Center AI')
    );
    if (!ccCard) return false;

    const parentId = (ccCard.parentElement?.id || '').toLowerCase();
    if (parentId.includes('beranda') || parentId.includes('home')) return false;

    return true;
  }

  function renderBotAiOnly(forceUpdate = false) {
    cleanLeaks();

    const ccCard = Array.from(document.querySelectorAll('div, section')).find(
      el => el.offsetParent !== null && el.children.length <= 6 && el.textContent && el.textContent.includes('Command Center AI')
    );

    let ws = document.getElementById('aq-bot-trading-workspace');

    if (!isStrictlyBotAiTab() || !ccCard || !ccCard.parentElement) {
      if (ws) ws.style.display = 'none';
      return;
    }

    if (!ws) {
      ws = document.createElement('section');
      ws.id = 'aq-bot-trading-workspace';
      ws.style.cssText = 'width:100%; max-width:520px; margin:0 auto 12px auto; box-sizing:border-box;';
      ccCard.parentElement.insertBefore(ws, ccCard);
    } else if (ws.parentElement !== ccCard.parentElement) {
      ccCard.parentElement.insertBefore(ws, ccCard);
    }

    ws.style.display = 'block';

    if (ws.dataset.rendered === '1' && !forceUpdate) return;
    ws.dataset.rendered = '1';

    ws.innerHTML = `
      <div id="aq-bot-trading-panel" style="padding:0">
        <div class="aq-bt-card">
          <div class="aq-bt-header">
            <div class="aq-bt-title">🤖 BOT TRADING OTONOM (V1)</div>
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
      </div>
    `;

    ws.querySelector('#aq-bt-start-btn').onclick = () => {
      cfg.running = true;
      localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      addLog('[SYSTEM] Engine auto_trader.py DIAKTIFKAN');
    };

    ws.querySelector('#aq-bt-stop-btn').onclick = () => {
      cfg.running = false;
      localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      addLog('[SYSTEM] Engine auto_trader.py DIJEDA');
    };

    ws.querySelector('#aq-bt-save-btn').onclick = () => {
      cfg.timeframe = ws.querySelector('#aq-cfg-tf').value;
      cfg.lotSize = ws.querySelector('#aq-cfg-lot').value;
      cfg.riskPct = ws.querySelector('#aq-cfg-risk').value;
      cfg.atrSlMult = ws.querySelector('#aq-cfg-sl').value;
      cfg.atrTpMult = ws.querySelector('#aq-cfg-tp').value;
      cfg.useFvg = ws.querySelector('#aq-cfg-fvg').checked;
      cfg.useEma200 = ws.querySelector('#aq-cfg-ema').checked;
      cfg.autoTrailing = ws.querySelector('#aq-cfg-trail').checked;
      localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      addLog(`[CONFIG] Tersimpan: TF=${cfg.timeframe}, Lot=${cfg.lotSize}, Risk=${cfg.riskPct}%`);
    };
  }

  document.addEventListener('click', () => setTimeout(() => renderBotAiOnly(false), 60));
  setInterval(() => renderBotAiOnly(false), 400);
})();
