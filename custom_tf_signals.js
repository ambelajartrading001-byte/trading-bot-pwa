(function () {
  const TF_MAP = {
    'M1': '1',
    'M5': '5',
    'M15': '15',
    'M30': '30',
    'H1': '60',
    'H4': '240',
    'D1': 'D',
    'W1': 'W'
  };
  const TIMEFRAMES = Object.keys(TF_MAP);
  let activeTF = localStorage.getItem('aq_selected_tf') || 'H1';
  if (!TF_MAP[activeTF]) activeTF = 'H1';

  function injectTvStyles() {
    if (document.getElementById('aq-tv-chart-style')) return;
    const style = document.createElement('style');
    style.id = 'aq-tv-chart-style';
    style.textContent = `
      /* Sembunyikan panel sinyal & canvas lama agar tab GRAFIK murni TradingView */
      #aq-chart-workspace .aq-signals-panel,
      #aq-chart-workspace .signal-list,
      #aq-chart-workspace .smc-signals-box,
      #aq-chart-workspace #aq-signals-hub,
      #aq-chart-workspace > canvas {
        display: none !important;
      }

      #aq-chart-workspace {
        display: flex;
        flex-direction: column;
        padding: 8px 8px 86px 8px;
        background: #080b12;
        min-height: calc(100vh - 64px);
        box-sizing: border-box;
      }

      /* Bar Timeframe M1 - W1 */
      #aq-tf-bar {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 4px;
        background: #0f1522;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 4px;
        margin-bottom: 8px;
        width: 100%;
        box-sizing: border-box;
      }

      .aq-tf-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
        padding: 7px 2px;
        border-radius: 7px;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s ease;
      }

      .aq-tf-btn:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.06);
      }

      .aq-tf-btn.active {
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
      }

      /* Kontainer TradingView Advanced Chart */
      #aq-tv-widget-shell {
        width: 100%;
        height: 74vh;
        min-height: 460px;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.09);
        background: #0b0f19;
      }

      #aq-tv-widget-container,
      #aq-tv-widget-container > div,
      #aq-tv-widget-container iframe {
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
  }

  function renderTradingViewWidget(tfLabel) {
    const shell = document.getElementById('aq-tv-widget-shell');
    if (!shell) return;

    const interval = TF_MAP[tfLabel] || '60';
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar';

    shell.innerHTML = `<div id="aq-tv-widget-container"></div>`;
    const container = document.getElementById('aq-tv-widget-container');

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval: interval,
      timezone: userTz,
      theme: 'dark',
      style: '1',
      locale: 'id',
      backgroundColor: '#0b0f19',
      gridColor: 'rgba(255, 255, 255, 0.05)',
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      details: false,
      hotlist: false,
      calendar: false,
      studies: [
        'STD;EMA'
      ],
      support_host: 'https://www.tradingview.com'
    });

    container.appendChild(script);
  }

  function setTimeframe(tf) {
    if (!TF_MAP[tf]) return;
    activeTF = tf;
    localStorage.setItem('aq_selected_tf', tf);

    document.querySelectorAll('.aq-tf-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tf === tf);
    });

    renderTradingViewWidget(tf);
    window.dispatchEvent(new CustomEvent('aq:timeframe-changed', { detail: { timeframe: tf } }));
  }

  function mountTradingViewWorkspace() {
    const workspace = document.getElementById('aq-chart-workspace');
    if (!workspace) return;

    injectTvStyles();

    // Bersihkan elemen lama di dalam workspace kecuali bar & shell TradingView
    Array.from(workspace.children).forEach(child => {
      if (child.id !== 'aq-tf-bar' && child.id !== 'aq-tv-widget-shell') {
        child.style.display = 'none';
      }
    });

    let bar = document.getElementById('aq-tf-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aq-tf-bar';
      workspace.insertBefore(bar, workspace.firstChild);
    }

    bar.innerHTML = TIMEFRAMES.map(tf => `
      <button type="button" class="aq-tf-btn ${tf === activeTF ? 'active' : ''}" data-tf="${tf}">
        ${tf}
      </button>
    `).join('');

    bar.querySelectorAll('.aq-tf-btn').forEach(btn => {
      btn.onclick = () => setTimeframe(btn.dataset.tf);
    });

    let shell = document.getElementById('aq-tv-widget-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'aq-tv-widget-shell';
      workspace.appendChild(shell);
      renderTradingViewWidget(activeTF);
    }
  }

  document.addEventListener('DOMContentLoaded', mountTradingViewWorkspace);
  if (document.readyState !== 'loading') mountTradingViewWorkspace();

  const observer = new MutationObserver(() => {
    const ws = document.getElementById('aq-chart-workspace');
    if (ws && (!document.getElementById('aq-tf-bar') || !document.getElementById('aq-tv-widget-shell'))) {
      mountTradingViewWorkspace();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
