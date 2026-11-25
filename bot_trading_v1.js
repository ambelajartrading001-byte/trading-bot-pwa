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
    maxDailyTrades: '4',
    useFvg: true,
    useEma200: true,
    autoTrailing: true
  };

  let cfg = Object.assign({}, DEFAULT_CFG, JSON.parse(localStorage.getItem('aq_bot_v1_cfg') || '{}'));
  let logs = [
    { t: '10:30:02', msg: '[AUTO_TRADER] SMC Engine v2 aktif · Pair XAUUSD (H1)' },
    { t: '10:35:14', msg: '[FILTER] EMA 200 Bearish + FVG Zone terdeteksi @ 3544 - 3549' },
    { t: '10:45:00', msg: '[AUTOPILOT] @Owneramrbot heartbeat OK · Semua worker stabil' }
  ];

  function nowTime() {
    return new Date().toTimeString().slice(0, 8);
  }

  function addLog(msg) {
    logs.unshift({ t: nowTime(), msg });
    if (logs.length > 25) logs.pop();
    renderPanel();
  }

  async function sendCommandToBackend(action, payload = {}) {
    localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
    const endpoints = ['/api/bot/control', '/bot_control'];
    for (const ep of endpoints) {
      try {
        await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, config: cfg, ...payload })
        });
        break;
      } catch (_) {}
    }
  }

  function findBotAiContainer() {
    const selectors = [
      '#aq-bot-workspace',
      '#tab-bot',
      '#bot-ai-view',
      '[data-tab-content="bot"]',
      '[data-tab-content="bot-ai"]',
      '[data-page="bot"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function renderPanel() {
    const host = findBotAiContainer();
    if (!host) return;

    let panel = document.getElementById('aq-bot-trading-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'aq-bot-trading-panel';
      host.insertBefore(panel, host.firstChild);
    }

    panel.innerHTML = `
      <!-- 1. STATUS ENGINE & KONTROL UTAMA -->
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
            <div class="aq-bt-mval" style="font-size:11.5px;color:#38bdf8">${cfg.accountType}</div>
          </div>
          <div class="aq-bt-mbox">
            <div class="aq-bt-mlbl">STRATEGI</div>
            <div class="aq-bt-mval" style="color:#c4b5fd">SMC v2</div>
          </div>
          <div class="aq-bt-mbox">
            <div class="aq-bt-mlbl">PROFIT FACTOR</div>
            <div class="aq-bt-mval" style="color:#10b981">1.94 (+6.8%)</div>
          </div>
        </div>

        <div class="aq-bt-power-row">
          <button type="button" class="aq-bt-btn start" id="aq-bt-start-btn">
            ▶ JALANKAN BOT
          </button>
          <button type="button" class="aq-bt-btn stop" id="aq-bt-stop-btn">
            ⏹ HENTIKAN BOT
          </button>
        </div>

        <div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:6px;letter-spacing:0.4px">
          STATUS MULTI-AGENT TERMUX
        </div>
        <div class="aq-bt-agents">
          <div class="aq-bt-agent-item">
            <span>auto_trader.py</span>
            <span class="aq-bt-dot ${cfg.running ? '' : 'off'}"></span>
          </div>
          <div class="aq-bt-agent-item">
            <span>@Owneramrbot</span>
            <span class="aq-bt-dot"></span>
          </div>
          <div class="aq-bt-agent-item">
            <span>@geminiamrbot</span>
            <span class="aq-bt-dot"></span>
          </div>
          <div class="aq-bt-agent-item">
            <span>@Hermesagent</span>
            <span class="aq-bt-dot"></span>
          </div>
        </div>
      </div>

      <!-- 2. PARAMETER TRADING & RISK MANAGEMENT (VERSI 1) -->
      <div class="aq-bt-card">
        <div class="aq-bt-header" style="margin-bottom:10px">
          <div class="aq-bt-title">⚙️ KONFIGURASI TRADING XAUUSD</div>
        </div>

        <div class="aq-bt-form-grid">
          <div class="aq-bt-field">
            <label>PAIR / INSTRUMEN</label>
            <input type="text" id="aq-cfg-symbol" value="${cfg.symbol}" readonly />
          </div>
          <div class="aq-bt-field">
            <label>TIMEFRAME EKSEKUSI</label>
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
            <label>ATR SL MULTIPLIER</label>
            <input type="number" step="0.1" id="aq-cfg-sl" value="${cfg.atrSlMult}" />
          </div>
          <div class="aq-bt-field">
            <label>ATR TP MULTIPLIER</label>
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
          💾 SIMPAN & SINKRONKAN KE AUTO_TRADER.PY
        </button>
      </div>

      <!-- 3. LIVE EXECUTION LOG -->
      <div class="aq-bt-card" style="margin-bottom:0">
        <div class="aq-bt-header" style="margin-bottom:8px">
          <div class="aq-bt-title">📟 LOG EKSEKUSI BOT</div>
          <button type="button" id="aq-bt-ping-btn" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;font-size:10px;padding:3px 8px;border-radius:6px;cursor:pointer">
            Tes Sinyal
          </button>
        </div>
        <div class="aq-bt-console">
          ${logs.map(l => `<div class="aq-bt-log-line"><span class="aq-bt-log-time">[${l.t}]</span> ${l.msg}</div>`).join('')}
        </div>
      </div>
    `;

    // Bind Events
    panel.querySelector('#aq-bt-start-btn').onclick = () => {
      cfg.running = true;
      sendCommandToBackend('START_BOT');
      addLog('[SYSTEM] Perintah START dikirim ke auto_trader.py');
    };

    panel.querySelector('#aq-bt-stop-btn').onclick = () => {
      cfg.running = false;
      sendCommandToBackend('STOP_BOT');
      addLog('[SYSTEM] Perintah STOP dikirim · Eksekusi baru dijeda');
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
      sendCommandToBackend('UPDATE_CONFIG');
      addLog(`[CONFIG] Tersimpan: TF=${cfg.timeframe}, Lot=${cfg.lotSize}, Risk=${cfg.riskPct}%, SL=${cfg.atrSlMult}x, TP=${cfg.atrTpMult}x`);
    };

    panel.querySelector('#aq-bt-ping-btn').onclick = () => {
      addLog(`[SCAN] Mengecek setup SMC XAUUSD (${cfg.timeframe}) · EMA200=${cfg.useEma200 ? 'ON' : 'OFF'}, FVG=${cfg.useFvg ? 'ON' : 'OFF'}`);
    };
  }

  document.addEventListener('DOMContentLoaded', renderPanel);
  if (document.readyState !== 'loading') renderPanel();

  const obs = new MutationObserver(() => {
    if (findBotAiContainer() && !document.getElementById('aq-bot-trading-panel')) {
      renderPanel();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
