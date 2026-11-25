(function () {
  const PRIMARY_TFS = ['M5', 'M15', 'H1'];
  const EXTRA_TFS = [
    { id: 'M1', label: 'M1' },
    { id: 'M30', label: 'M30' },
    { id: 'H4', label: 'H4' },
    { id: 'D1', label: 'D1' }
  ];

  let activeTf = 'H1';

  function injectTfStyles() {
    if (document.getElementById('aq-tf-style')) return;
    const style = document.createElement('style');
    style.id = 'aq-tf-style';
    style.textContent = `
      .aq-chart-inner-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 8px 10px;
        background: rgba(9, 13, 22, 0.92);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px 12px 0 0;
        font-family: system-ui, -apple-system, sans-serif;
        width: 100%;
        box-sizing: border-box;
        z-index: 20;
      }
      .aq-tf-group {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: 1;
      }
      .aq-tf-btn {
        flex: 1;
        padding: 5px 6px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #94a3b8;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.18s;
        text-align: center;
      }
      .aq-tf-btn.active {
        background: rgba(234, 179, 8, 0.2);
        border-color: #eab308;
        color: #facc15;
      }
      .aq-tf-select {
        flex: 1.05;
        padding: 5px 6px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: #0f172a;
        color: #cbd5e1;
        font-size: 11px;
        font-weight: 800;
        outline: none;
        cursor: pointer;
        text-align: center;
      }
      .aq-tf-select.active {
        border-color: #eab308;
        color: #facc15;
        background: rgba(234, 179, 8, 0.16);
      }
      .aq-tf-mini-tag {
        font-size: 10px;
        font-weight: 800;
        padding: 4px 7px;
        border-radius: 6px;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function getSignalBadge(tf) {
    const map = {
      M1:  { text: 'M1 • BUY',  bull: true },
      M5:  { text: 'M5 • FVG',  bull: true },
      M15: { text: 'M15 • OB',  bull: true },
      M30: { text: 'M30 • SELL',bull: false },
      H1:  { text: 'H1 • SMC',  bull: true },
      H4:  { text: 'H4 • SWING',bull: true },
      D1:  { text: 'D1 • BULL', bull: true }
    };
    return map[tf] || map.H1;
  }

  function selectTimeframe(tf) {
    activeTf = tf;

    document.querySelectorAll('.aq-tf-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tf === tf);
    });

    const dd = document.getElementById('aq-tf-dropdown');
    if (dd) {
      const isExtra = EXTRA_TFS.some((item) => item.id === tf);
      dd.classList.toggle('active', isExtra);
      dd.value = isExtra ? tf : 'MORE';
    }

    const badge = document.getElementById('aq-tf-mini-tag');
    if (badge) {
      const info = getSignalBadge(tf);
      badge.textContent = info.text;
      badge.style.background = info.bull ? 'rgba(34,197,94,0.16)' : 'rgba(244,63,94,0.16)';
      badge.style.color = info.bull ? '#4ade80' : '#fb7185';
      badge.style.border = `1px solid ${info.bull ? 'rgba(74,222,128,0.35)' : 'rgba(251,113,133,0.35)'}`;
    }

    if (typeof window.changeTimeframe === 'function') window.changeTimeframe(tf);
    if (typeof window.setChartTimeframe === 'function') window.setChartTimeframe(tf);
    window.dispatchEvent(new CustomEvent('aureus:timeframeChange', { detail: { timeframe: tf } }));
  }

  function mountInsideChartBox() {
    if (document.getElementById('aq-chart-inner-topbar')) return;

    // Cari elemen canvas grafik atau wrapper chart di dalam workspace
    const workspace = document.getElementById('aq-chart-workspace') || document.body;
    const canvas = workspace.querySelector('canvas');
    const chartBox = canvas ? canvas.parentElement : workspace.querySelector('.chart-container, #chart, [id*="chart"]');

    const bar = document.createElement('div');
    bar.id = 'aq-chart-inner-topbar';
    bar.className = 'aq-chart-inner-topbar';

    const tfGroup = document.createElement('div');
    tfGroup.className = 'aq-tf-group';

    // 3 Timeframe utama
    PRIMARY_TFS.forEach((tf) => {
      const btn = document.createElement('button');
      btn.className = 'aq-tf-btn' + (tf === activeTf ? ' active' : '');
      btn.dataset.tf = tf;
      btn.textContent = tf;
      btn.onclick = () => selectTimeframe(tf);
      tfGroup.appendChild(btn);
    });

    // Dropdown paling kanan untuk timeframe tambahan
    const select = document.createElement('select');
    select.id = 'aq-tf-dropdown';
    select.className = 'aq-tf-select';
    select.innerHTML =
      `<option value="MORE">TF ▾</option>` +
      EXTRA_TFS.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
    select.onchange = (e) => {
      if (e.target.value !== 'MORE') {
        selectTimeframe(e.target.value);
      }
    };
    tfGroup.appendChild(select);

    const miniTag = document.createElement('span');
    miniTag.id = 'aq-tf-mini-tag';
    miniTag.className = 'aq-tf-mini-tag';

    bar.appendChild(tfGroup);
    bar.appendChild(miniTag);

    // Sisipkan tepat di dalam box chart di atas canvas (bukan di luar box sinyal)
    if (chartBox && canvas) {
      chartBox.insertBefore(bar, canvas);
    } else if (chartBox) {
      chartBox.insertBefore(bar, chartBox.firstChild);
    } else {
      workspace.appendChild(bar);
    }

    selectTimeframe(activeTf);
  }

  function init() {
    injectTfStyles();
    setTimeout(mountInsideChartBox, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
