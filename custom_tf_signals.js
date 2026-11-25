(function () {
  const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
  let activeTF = localStorage.getItem('aq_selected_tf') || 'H1';

  function injectChartStyles() {
    if (document.getElementById('aq-clean-chart-style')) return;
    const style = document.createElement('style');
    style.id = 'aq-clean-chart-style';
    style.textContent = `
      /* Sembunyikan panel sinyal/ekstra di dalam tab Grafik agar fokus grafik saja */
      #aq-chart-workspace .aq-signals-panel,
      #aq-chart-workspace .signal-list,
      #aq-chart-workspace .smc-signals-box,
      #aq-chart-workspace #aq-signals-hub {
        display: none !important;
      }

      #aq-chart-workspace {
        display: flex;
        flex-direction: column;
        padding: 8px 8px 84px 8px;
        background: #080b12;
        min-height: calc(100vh - 64px);
        box-sizing: border-box;
      }

      /* Bar Timeframe Horizontal M1 - W1 di atas canvas */
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
        background: rgba(255, 255, 255, 0.05);
      }

      .aq-tf-btn.active {
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
      }

      /* Pastikan area chart mengisi penuh layar dengan nyaman */
      #aq-chart-workspace canvas,
      #aq-chart-workspace .tv-lightweight-charts,
      #aq-chart-workspace #chart-container {
        width: 100% !important;
        min-height: 70vh !important;
        border-radius: 12px;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  function triggerTimeframeChange(tf) {
    activeTF = tf;
    localStorage.setItem('aq_selected_tf', tf);

    // Update tampilan tombol aktif
    document.querySelectorAll('.aq-tf-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tf === tf);
    });

    // 1. Panggil fungsi global chart jika tersedia di app.js
    if (typeof window.setChartTimeframe === 'function') {
      window.setChartTimeframe(tf);
    } else if (typeof window.changeTimeframe === 'function') {
      window.changeTimeframe(tf);
    } else if (typeof window.loadChartData === 'function') {
      window.loadChartData(tf);
    }

    // 2. Sinkronkan dengan <select> bawaan jika ada
    const nativeSelect = document.querySelector('#aq-chart-workspace select, #timeframe-select');
    if (nativeSelect) {
      nativeSelect.value = tf;
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 3. Dispatch custom event agar listener lain ikut ter-update
    window.dispatchEvent(new CustomEvent('aq:timeframe-changed', { detail: { timeframe: tf } }));
  }

  function mountTimeframeBar() {
    const workspace = document.getElementById('aq-chart-workspace');
    if (!workspace) return;

    injectChartStyles();

    // Hapus bar lama/dropdown lama jika ada
    const oldDropdown = workspace.querySelector('.aq-tf-dropdown, #aq-tf-select-wrap');
    if (oldDropdown) oldDropdown.remove();

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
      btn.onclick = () => triggerTimeframeChange(btn.dataset.tf);
    });
  }

  document.addEventListener('DOMContentLoaded', mountTimeframeBar);
  if (document.readyState !== 'loading') mountTimeframeBar();

  // Pantau jika DOM tab grafik di-render ulang secara dinamis
  const observer = new MutationObserver(() => {
    if (document.getElementById('aq-chart-workspace') && !document.getElementById('aq-tf-bar')) {
      mountTimeframeBar();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
