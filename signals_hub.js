(function () {
  const STATE = {
    activeSubTab: 'setup',
    perfPeriod: 'TODAY',
    price: 3547.12,
    dir: 'down',
    dayLow: 3545.79,
    dayHigh: 3569.09,
    support: { price: 3515, tf: 'H1', pips: 308 },
    resistance: { price: 3547, tf: 'M5', pips: 12 },
    spark: [3568, 3565, 3566, 3561, 3558, 3559, 3554, 3551, 3549, 3547.12],
    signals: [
      { id: 1, tf: 'M15', conf: '+M5', side: 'SELL', zone: '3544 - 3549', statusType: 'run', statusText: '● Berjalan · TP1 · +30 pip', ago: '13 mnt lalu', time: '08:24 · Nov 25' },
      { id: 2, tf: 'H1', conf: '+M15', side: 'SELL', zone: '3556 - 3561', statusType: 'tp', statusText: '⭐ Semua TP Tercapai · +94 pip', ago: '2 jam lalu', time: '06:30 · Nov 25' },
      { id: 3, tf: 'M15', conf: '', side: 'BUY', zone: '3548 - 3551', statusType: 'be', statusText: '● Impas · ran +27 pips', ago: '4 jam lalu', time: '04:15 · Nov 25' },
      { id: 4, tf: 'H1', conf: '+M15', side: 'SELL', zone: '3564 - 3568', statusType: 'tp', statusText: '⭐ TP2 Tercapai · +57 pip', ago: '6 jam lalu', time: '02:10 · Nov 25' }
    ],
    perf: {
      TODAY: { label: 'HARI INI', pips: '+154', winRate: 100, total: 4, tp: 3, sl: 0, be: 1 },
      YESTERDAY: { label: 'KEMARIN', pips: '+112', winRate: 80, total: 5, tp: 4, sl: 1, be: 0 },
      D7: { label: '7 HARI', pips: '+486', winRate: 84, total: 19, tp: 15, sl: 3, be: 1 },
      D30: { label: '30 HARI', pips: '+1,420', winRate: 81, total: 68, tp: 52, sl: 12, be: 4 }
    },
    tfMatrix: [
      { tf: 'M5', bias: 'TURUN', pct: '57% JUAL', vol: 'Tinggi', sup: '3544', res: '3549', bear: true },
      { tf: 'M15', bias: 'TURUN', pct: '63% JUAL', vol: 'Tinggi', sup: '3542', res: '3549', bear: true },
      { tf: 'M30', bias: 'TURUN', pct: '61% JUAL', vol: 'Sedang', sup: '3538', res: '3554', bear: true },
      { tf: 'M45', bias: 'TURUN', pct: '59% JUAL', vol: 'Sedang', sup: '3535', res: '3556', bear: true },
      { tf: 'H1', bias: 'TURUN', pct: '68% JUAL', vol: 'Tinggi', sup: '3515', res: '3561', bear: true },
      { tf: 'H4', bias: 'TURUN', pct: '64% JUAL', vol: 'Sedang', sup: '3508', res: '3572', bear: true },
      { tf: 'D1', bias: 'TURUN', pct: '55% JUAL', vol: 'Normal', sup: '3490', res: '3595', bear: true }
    ]
  };

  async function syncFromEngine() {
    const endpoints = ['/api/signals', '/signals_state.json', '/data/signals.json'];
    for (const url of endpoints) {
      try {
        const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.price) STATE.price = Number(data.price);
          if (Array.isArray(data.signals) && data.signals.length) STATE.signals = data.signals;
          if (data.support) STATE.support = data.support;
          if (data.resistance) STATE.resistance = data.resistance;
          render();
          break;
        }
      } catch (_) {}
    }
  }

  function renderSparkline(points, isDown) {
    const w = 96, h = 34;
    const min = Math.min(...points), max = Math.max(...points);
    const span = (max - min) || 1;
    const coords = points.map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const stroke = isDown ? '#ef4444' : '#10b981';
    const fill = isDown ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)';
    return `
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <polygon points="0,${h} ${coords.join(' ')} ${w},${h}" fill="${fill}" />
        <polyline fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" points="${coords.join(' ')}" />
      </svg>`;
  }

  function renderHeaderCard() {
    const isDown = STATE.dir === 'down';
    const rangeTotal = Math.max(STATE.dayHigh - STATE.dayLow, 0.1);
    const pctPos = Math.min(100, Math.max(0, ((STATE.price - STATE.dayLow) / rangeTotal) * 100));
    const pipRange = Math.round(rangeTotal * 10);

    return `
      <div class="aq-sh-card">
        <div class="aq-sh-top-row">
          <div class="aq-sh-asset">
            <span class="aq-sh-badge-xau">XAU</span>
            <span class="aq-sh-asset-name">EMAS · XAUUSD</span>
          </div>
          <span class="aq-sh-live"><span class="aq-sh-live-dot"></span>LANGSUNG</span>
        </div>

        <div class="aq-sh-price-row">
          <div class="aq-sh-price">
            ${STATE.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span class="aq-sh-price-dir ${isDown ? 'down' : 'up'}">${isDown ? '▼' : '▲'}</span>
          </div>
          <div>${renderSparkline(STATE.spark, isDown)}</div>
        </div>

        <div class="aq-sh-trend-meta">
          <span class="aq-sh-pill-trend ${isDown ? 'down' : 'up'}">${isDown ? 'Tren Turun' : 'Tren Naik'}</span>
          <span class="aq-sh-pip-range">${pipRange} PIP</span>
        </div>

        <div class="aq-sh-range-wrap">
          <div class="aq-sh-range-track">
            <div class="aq-sh-range-fill" style="width:${pctPos.toFixed(0)}%"></div>
            <div class="aq-sh-range-dot" style="left:${pctPos.toFixed(1)}%"></div>
          </div>
          <div class="aq-sh-range-labels">
            <span>L ${STATE.dayLow.toFixed(2)}</span>
            <span>Rentang Harian</span>
            <span>H ${STATE.dayHigh.toFixed(2)}</span>
          </div>
        </div>

        <div class="aq-sh-levels">
          <div class="aq-sh-lvl-box">
            <div class="aq-sh-lvl-title">NEAREST SUPPORT</div>
            <div class="aq-sh-lvl-val-row">
              <span class="aq-sh-lvl-val sup">${STATE.support.price}</span>
              <span class="aq-sh-tf-tag">${STATE.support.tf}</span>
            </div>
            <div class="aq-sh-lvl-sub">${STATE.support.pips} pips below</div>
          </div>
          <div class="aq-sh-lvl-box">
            <div class="aq-sh-lvl-title">NEAREST RESISTANCE</div>
            <div class="aq-sh-lvl-val-row">
              <span class="aq-sh-lvl-val res">${STATE.resistance.price}</span>
              <span class="aq-sh-tf-tag">${STATE.resistance.tf}</span>
            </div>
            <div class="aq-sh-lvl-sub">${STATE.resistance.pips} pips above</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSubTabs() {
    const tabs = [
      { id: 'setup', label: 'Setup' },
      { id: 'performa', label: 'Performa' },
      { id: 'analisis', label: 'Analisis' }
    ];
    return `
      <div class="aq-sh-tabs">
        ${tabs.map(t => `
          <button class="aq-sh-tab-btn ${STATE.activeSubTab === t.id ? 'active' : ''}" data-aq-subtab="${t.id}">
            ${t.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderSetupTab() {
    const tpCount = STATE.signals.filter(s => s.statusType === 'tp').length;
    return `
      <div class="aq-sh-sec-head">
        <div class="aq-sh-sec-title">
          SINYAL HARI INI <span class="aq-sh-count-pill">${STATE.signals.length}</span>
        </div>
        <div class="aq-sh-sec-sub">${tpCount} tercapai TP</div>
      </div>
      <div>
        ${STATE.signals.map(s => {
          const isSell = s.side === 'SELL';
          return `
            <div class="aq-sig-item">
              <div class="aq-sig-left">
                <div class="aq-sig-dir-box ${isSell ? 'sell' : 'buy'}">
                  <span class="aq-sig-tf">${s.tf}</span>
                  <span class="aq-sig-act">${isSell ? 'JUAL' : 'BELI'}</span>
                </div>
                <div class="aq-sig-mid">
                  <div class="aq-sig-zone">
                    ${s.zone}
                    ${s.conf ? `<span class="aq-sig-conf">${s.conf}</span>` : ''}
                  </div>
                  <div class="aq-sig-status ${s.statusType}">${s.statusText}</div>
                </div>
              </div>
              <div class="aq-sig-right">
                <span class="aq-sig-ago">${s.ago}</span>
                <span>${s.time}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderPerformaTab() {
    const p = STATE.perf[STATE.perfPeriod];
    const r = 32;
    const c = 2 * Math.PI * r;
    const offset = c - (p.winRate / 100) * c;

    return `
      <div class="aq-perf-filters">
        ${Object.keys(STATE.perf).map(k => `
          <button class="aq-perf-fbtn ${STATE.perfPeriod === k ? 'active' : ''}" data-aq-period="${k}">
            ${STATE.perf[k].label}
          </button>
        `).join('')}
      </div>

      <div class="aq-perf-hero">
        <div>
          <div class="aq-perf-pips-lbl">PIP DIDAPAT · ${p.label}</div>
          <div class="aq-perf-pips-val">${p.pips}</div>
        </div>
        <div class="aq-perf-ring-wrap">
          <svg width="78" height="78">
            <circle cx="39" cy="39" r="${r}" stroke="#1e293b" stroke-width="6" fill="none" />
            <circle cx="39" cy="39" r="${r}" stroke="#10b981" stroke-width="6" fill="none"
              stroke-dasharray="${c}" stroke-dashoffset="${offset}"
              stroke-linecap="round" transform="rotate(-90 39 39)" />
          </svg>
          <div class="aq-perf-ring-text">
            <span class="aq-perf-ring-pct">${p.winRate}%</span>
            <span class="aq-perf-ring-sub">RASIO MENANG</span>
          </div>
        </div>
      </div>

      <div class="aq-perf-grid">
        <div class="aq-perf-stat">
          <div class="aq-perf-stat-num" style="color:#60a5fa">${p.total}</div>
          <div class="aq-perf-stat-lbl">SINYAL</div>
        </div>
        <div class="aq-perf-stat">
          <div class="aq-perf-stat-num" style="color:#10b981">${p.tp}</div>
          <div class="aq-perf-stat-lbl">TP TERCAPAI</div>
        </div>
        <div class="aq-perf-stat">
          <div class="aq-perf-stat-num" style="color:#ef4444">${p.sl}</div>
          <div class="aq-perf-stat-lbl">SL KENA</div>
        </div>
        <div class="aq-perf-stat">
          <div class="aq-perf-stat-num" style="color:#fbbf24">${p.be}</div>
          <div class="aq-perf-stat-lbl">IMPAS</div>
        </div>
      </div>

      <button class="aq-btn-share" id="aq-share-perf-btn">BAGIKAN PERFORMA</button>
    `;
  }

  function renderAnalisisTab() {
    const bearCount = STATE.tfMatrix.filter(x => x.bear).length;
    return `
      <div class="aq-an-banner">
        <div class="aq-an-top">
          <div>
            <div class="aq-an-sub">EMAS · XAUUSD</div>
            <div class="aq-an-dir">TURUN</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:15px;font-weight:800;color:#fff">${STATE.price.toFixed(2)}</div>
            <div class="aq-an-sub">${bearCount} OF ${STATE.tfMatrix.length} TIMEFRAMES BEARISH</div>
          </div>
        </div>
        <div class="aq-an-meter">
          ${Array.from({ length: 9 }).map((_, i) => `<div class="aq-an-seg ${i < 6 ? 'bear' : ''}"></div>`).join('')}
        </div>
        <div class="aq-an-ratio">
          <span style="color:#10b981">Pembeli 39%</span>
          <span style="color:#64748b">-9 / 9</span>
          <span style="color:#ef4444">61% Sellers</span>
        </div>
      </div>

      <div class="aq-tf-grid">
        ${STATE.tfMatrix.map(item => `
          <div class="aq-tf-card">
            <div class="aq-tf-name">${item.tf}</div>
            <div class="aq-tf-bias" style="color:${item.bear ? '#ef4444' : '#10b981'}">${item.bias}</div>
            <div class="aq-tf-pct">${item.pct}</div>
          </div>
        `).join('')}
      </div>

      <table class="aq-tech-table">
        <thead>
          <tr>
            <th>TF</th>
            <th>TREN</th>
            <th>VOLUME</th>
            <th>SUPPORT</th>
            <th>RESIST.</th>
          </tr>
        </thead>
        <tbody>
          ${STATE.tfMatrix.map(item => `
            <tr>
              <td style="font-weight:800;color:#fff">${item.tf}</td>
              <td style="color:${item.bear ? '#f87171' : '#34d399'}">${item.bias}</td>
              <td>${item.vol}</td>
              <td style="color:#34d399">${item.sup}</td>
              <td style="color:#f87171">${item.res}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="aq-keyzone-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:10px;font-weight:800;color:#f87171">DI LEVEL KUNCI · M15 RESISTANCE</span>
          <span style="font-size:10px;font-weight:700;color:#fbbf24">ZONA JUAL</span>
        </div>
        <div style="font-size:16px;font-weight:900;color:#fff;margin-bottom:6px">3544 - 3549</div>
        <div class="aq-sh-range-track">
          <div class="aq-sh-range-fill" style="width:68%"></div>
          <div class="aq-sh-range-dot" style="left:68%"></div>
        </div>
        <div class="aq-sh-range-labels">
          <span>Price 68% into the zone</span>
          <span>SMC FVG + EMA 200</span>
        </div>
      </div>
    `;
  }

  function findSignalsContainer() {
    const selectors = [
      '#aq-signals-workspace',
      '#tab-sinyal',
      '#signals-view',
      '[data-tab-content="sinyal"]',
      '[data-page="signals"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    let hub = document.getElementById('aq-signals-hub');
    if (!hub) {
      hub = document.createElement('div');
      hub.id = 'aq-signals-hub';
      const main = document.querySelector('main') || document.body;
      main.appendChild(hub);
    }
    return hub;
  }

  function render() {
    const host = findSignalsContainer();
    let hub = host.id === 'aq-signals-hub' ? host : host.querySelector('#aq-signals-hub');
    if (!hub) {
      host.innerHTML = '<div id="aq-signals-hub"></div>';
      hub = host.querySelector('#aq-signals-hub');
    }

    let bodyHtml = '';
    if (STATE.activeSubTab === 'setup') bodyHtml = renderSetupTab();
    else if (STATE.activeSubTab === 'performa') bodyHtml = renderPerformaTab();
    else bodyHtml = renderAnalisisTab();

    hub.innerHTML = renderHeaderCard() + renderSubTabs() + bodyHtml;

    hub.querySelectorAll('[data-aq-subtab]').forEach(btn => {
      btn.onclick = () => {
        STATE.activeSubTab = btn.getAttribute('data-aq-subtab');
        render();
      };
    });

    hub.querySelectorAll('[data-aq-period]').forEach(btn => {
      btn.onclick = () => {
        STATE.perfPeriod = btn.getAttribute('data-aq-period');
        render();
      };
    });

    const shareBtn = hub.querySelector('#aq-share-perf-btn');
    if (shareBtn) {
      shareBtn.onclick = () => {
        const p = STATE.perf[STATE.perfPeriod];
        const txt = `Aureus Quant XAUUSD (${p.label}): ${p.pips} Pips | Win Rate ${p.winRate}% (${p.tp} TP / ${p.total} Sinyal)`;
        if (navigator.share) navigator.share({ title: 'Aureus Quant Performa', text: txt }).catch(() => {});
        else if (navigator.clipboard) {
          navigator.clipboard.writeText(txt);
          shareBtn.textContent = 'DISALIN KE CLIPBOARD ✓';
          setTimeout(() => (shareBtn.textContent = 'BAGIKAN PERFORMA'), 2000);
        }
      };
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    syncFromEngine();
    setInterval(syncFromEngine, 15000);
  });
  if (document.readyState !== 'loading') {
    render();
    syncFromEngine();
  }
})();
