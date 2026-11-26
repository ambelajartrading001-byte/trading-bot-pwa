(function () {
  const BRIDGE_BASE = localStorage.getItem('aq_bridge_url') || 'http://127.0.0.1:8787';
  const DEFAULT_CFG = {
    running: false,
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
  let bridgeConnected = false;
  let activePid = null;
  let pendingConfirmAction = null;
  let logs = [
    { t: nowTime(), msg: '[BRIDGE] Menghubungkan ke Termux bot_api.py (port 8787)...' }
  ];

  function nowTime() {
    return new Date().toTimeString().slice(0, 8);
  }

  function addLog(msg) {
    logs.unshift({ t: nowTime(), msg });
    if (logs.length > 25) logs.pop();
    renderBotAiOnly(true);
  }

  async function pollBridgeStatus() {
    try {
      const res = await fetch(`${BRIDGE_BASE}/api/bot/status?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      bridgeConnected = true;
      activePid = data.pid || null;
      if (data.config) {
        cfg = Object.assign({}, cfg, data.config);
        cfg.running = Boolean(data.running);
        localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      }
      if (Array.isArray(data.logs) && data.logs.length) {
        logs = data.logs.slice().reverse().map(line => ({ t: 'LIVE', msg: line }));
      }
      if (!pendingConfirmAction) renderBotAiOnly(true);
    } catch (_) {
      if (bridgeConnected) {
        bridgeConnected = false;
        addLog('[WARN] Koneksi ke bot_api.py (127.0.0.1:8787) terputus');
      }
    }
  }

  async function syncControlToBackend(action) {
    localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
    try {
      const res = await fetch(`${BRIDGE_BASE}/api/bot/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, config: cfg })
      });
      const data = await res.json();
      bridgeConnected = true;
      activePid = data.pid || null;
      cfg.running = Boolean(data.running);
      localStorage.setItem('aq_bot_v1_cfg', JSON.stringify(cfg));
      addLog(`[TERMUX] ${data.message || action}`);
    } catch (err) {
      bridgeConnected = false;
      addLog('[ERROR] Gagal menghubungi bot_api.py. Pastikan bot_api.py aktif di Termux!');
    }
  }

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

    const confirmModalHtml = pendingConfirmAction ? `
      <div class="aq-bt-modal-backdrop" id="aq-bt-confirm-backdrop">
        <div class="aq-bt-modal-box">
          <div class="aq-bt-modal-title">
            ${pendingConfirmAction === 'START' ? '⚠️ Konfirmasi Jalankan Bot' : '⚠️ Konfirmasi Hentikan Bot'}
          </div>
          <div class="aq-bt-modal-desc">
            ${pendingConfirmAction === 'START'
              ? `Perintah akan dikirim ke Termux untuk menyalakan <b>auto_trader.py</b> pada <b>${cfg.symbol} (${cfg.timeframe})</b> · Lot <b>${cfg.lotSize}</b> · Risk <b>${cfg.riskPct}%</b>. Lanjutkan?`
              : `Proses <b>auto_trader.py</b> ${activePid ? `(PID ${activePid})` : ''} di Termux akan dihentikan. Yakin ingin menghentikan bot?`
            }
          </div>
          <div class="aq-bt-modal-actions">
            <button type="button" class="aq-bt-btn secondary" id="aq-bt-cancel-confirm">Batal</button>
            <button type="button" class="aq-bt-btn ${pendingConfirmAction === 'START' ? 'start' : 'stop'}" id="aq-bt-accept-confirm">
              ${pendingConfirmAction === 'START' ? 'Ya, Jalankan' : 'Ya, Hentikan'}
            </button>
          </div>
        </div>
      </div>
    ` : '';

    ws.innerHTML = `
      <div id="aq-bot-trading-panel" style="padding:0">
        <div class="aq-bt-card">
          <div class="aq-bt-header">
            <div class="aq-bt-title">🤖 BOT TRADING OTONOM</div>
            <span class="aq-bt-status-pill ${cfg.running ? 'online' : 'offline'}">
              ${cfg.running ? `● AKTIF ${activePid ? '(PID ' + activePid + ')' : ''}` : '■ BERHENTI'}
            </span>
          </div>

          <div style="font-size:10.5px;margin-bottom:10px;padding:6px 9px;border-radius:8px;background:${bridgeConnected ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'};color:${bridgeConnected ? '#34d399' : '#fbbf24'};font-weight:700">
            ${bridgeConnected ? '🔗 Termux API Bridge Terhubung (127.0.0.1:8787)' : '⏳ Mode Offline · Menunggu bot_api.py di Termux'}
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

          <div class="aq-bt-single-action">
            <button type="button" class="aq-bt-btn ${cfg.running ? 'stop' : 'start'}" id="aq-bt-toggle-btn">
              ${cfg.running ? '⏹ HENTIKAN BOT' : '▶ JALANKAN BOT'}
            </button>
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
            💾 SIMPAN KE BOT_CONFIG.JSON
          </button>

          <div class="aq-bt-console" style="margin-top:10px">
            ${logs.map(l => `<div class="aq-bt-log-line"><span class="aq-bt-log-time">[${l.t}]</span> ${l.msg}</div>`).join('')}
          </div>
        </div>
      </div>
      ${confirmModalHtml}
    `;

    ws.querySelector('#aq-bt-toggle-btn').onclick = () => {
      pendingConfirmAction = cfg.running ? 'STOP' : 'START';
      renderBotAiOnly(true);
    };

    if (pendingConfirmAction) {
      ws.querySelector('#aq-bt-cancel-confirm').onclick = () => {
        pendingConfirmAction = null;
        renderBotAiOnly(true);
      };

      ws.querySelector('#aq-bt-accept-confirm').onclick = async () => {
        const execAction = pendingConfirmAction;
        pendingConfirmAction = null;
        renderBotAiOnly(true);
        await syncControlToBackend(execAction === 'START' ? 'START_BOT' : 'STOP_BOT');
      };
    }

    ws.querySelector('#aq-bt-save-btn').onclick = async () => {
      cfg.timeframe = ws.querySelector('#aq-cfg-tf').value;
      cfg.lotSize = ws.querySelector('#aq-cfg-lot').value;
      cfg.riskPct = ws.querySelector('#aq-cfg-risk').value;
      cfg.atrSlMult = ws.querySelector('#aq-cfg-sl').value;
      cfg.atrTpMult = ws.querySelector('#aq-cfg-tp').value;
      cfg.useFvg = ws.querySelector('#aq-cfg-fvg').checked;
      cfg.useEma200 = ws.querySelector('#aq-cfg-ema').checked;
      cfg.autoTrailing = ws.querySelector('#aq-cfg-trail').checked;
      await syncControlToBackend('UPDATE_CONFIG');
    };
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#aq-bt-confirm-backdrop')) return;
    setTimeout(() => renderBotAiOnly(false), 60);
  });

  setInterval(() => {
    if (!pendingConfirmAction) renderBotAiOnly(false);
  }, 500);

  // Polling status nyata dari Termux setiap 5 detik
  pollBridgeStatus();
  setInterval(pollBridgeStatus, 5000);
})();
