#!/bin/bash
PROJECT_DIR="/root/trading-bot-pwa"
cd "$PROJECT_DIR" || exit 1

cat << 'JSEOF' > "$PROJECT_DIR/session_dial_fab.js"
(function () {
  // Definisi Sesi Pasar dalam UTC (jam desimal)
  const SESSIONS = [
    { id: 'ASIA', name: 'ASIA / TOKYO', city: 'TOKYO', utcStart: 0, utcEnd: 9, color: '#22c55e' },
    { id: 'LONDON', name: 'LONDON SESSION', city: 'LONDON', utcStart: 7, utcEnd: 16, color: '#38bdf8' },
    { id: 'NY', name: 'NEW YORK SESSION', city: 'NEW YORK', utcStart: 12, utcEnd: 21, color: '#f43f5e' }
  ];

  let selectedSessionId = 'AUTO';

  // Konversi jam UTC ke jam lokal perangkat (0 - 24)
  function utcToLocalHour(utcH) {
    const offsetHours = -new Date().getTimezoneOffset() / 60;
    return (utcH + offsetHours + 24) % 24;
  }

  function formatHour12(hFloat) {
    const totalMins = Math.round((hFloat % 24) * 60) % 1440;
    let hh = Math.floor(totalMins / 60);
    const mm = String(totalMins % 60).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${hh}:${mm} ${ampm}`;
  }

  function polarToCartesian(cx, cy, r, hour24) {
    // 00:00 di atas (-90 deg), searah jarum jam
    const angleDeg = (hour24 / 24) * 360 - 90;
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx, cy, r, startHour, endHour) {
    let sweep = (endHour - startHour + 24) % 24;
    if (sweep === 0) sweep = 24;
    const start = polarToCartesian(cx, cy, r, startHour);
    const end = polarToCartesian(cx, cy, r, endHour);
    const largeArc = sweep > 12 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function injectStyles() {
    if (document.getElementById('traxa-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'traxa-ui-style';
    style.textContent = `
      .aq-session-card {
        background: radial-gradient(circle at 50% 45%, rgba(234,179,8,0.08), rgba(10,12,16,0.96) 72%);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 22px;
        padding: 18px 14px;
        margin: 12px auto 16px;
        max-width: 440px;
        text-align: center;
        color: #f8fafc;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 14px 34px rgba(0,0,0,0.55);
      }
      .aq-greet { font-size: 11px; letter-spacing: 2px; color: #eab308; text-transform: uppercase; font-weight: 700; }
      .aq-brand { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 2px 0 4px; text-shadow: 0 0 18px rgba(255,255,255,0.22); }
      .aq-clock-now { font-size: 13px; color: #cbd5e1; font-weight: 600; margin-bottom: 8px; }
      .aq-dial-wrap { position: relative; width: 270px; height: 270px; margin: 0 auto; }
      .aq-session-pills { display: flex; justify-content: center; gap: 6px; margin: 8px 0 10px; flex-wrap: wrap; }
      .aq-pill {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        color: #94a3b8; font-size: 11px; font-weight: 700; padding: 5px 10px;
        border-radius: 999px; cursor: pointer; transition: all 0.2s;
      }
      .aq-pill.active { color: #fff; border-color: currentColor; background: rgba(255,255,255,0.12); }
      .aq-status-title { font-size: 13px; font-weight: 800; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .aq-status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .aq-status-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }

      /* Floating Radial Menu & Bottom Bar */
      body { padding-bottom: 86px !important; }
      .aq-backdrop {
        position: fixed; inset: 0; background: rgba(5, 7, 11, 0.78);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        opacity: 0; pointer-events: none; transition: opacity 0.25s ease; z-index: 9990;
      }
      .aq-backdrop.open { opacity: 1; pointer-events: auto; }
      .aq-bottom-nav {
        position: fixed; left: 0; right: 0; bottom: 0; height: 68px;
        background: rgba(13, 16, 23, 0.96); border-top: 1px solid rgba(255,255,255,0.08);
        display: flex; align-items: center; justify-content: space-around;
        z-index: 9995; padding: 0 8px; backdrop-filter: blur(12px);
      }
      .aq-nav-item {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        color: #64748b; font-size: 10px; font-weight: 700; background: none; border: none; cursor: pointer; width: 64px;
      }
      .aq-nav-item.active { color: #eab308; }
      .aq-fab-holder { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin-top: -26px; }
      .aq-fab-btn {
        width: 58px; height: 58px; border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, #1e293b, #090d16);
        border: 2px solid #eab308; color: #eab308; font-size: 22px; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 6px 22px rgba(234,179,8,0.35); cursor: pointer; transition: all 0.25s cubic-bezier(.34,1.56,.64,1); z-index: 9999;
      }
      .aq-fab-btn.open {
        background: linear-gradient(135deg, #fde047, #eab308); color: #090d16; transform: rotate(90deg);
      }
      .aq-fab-badge {
        position: absolute; top: -2px; right: 2px; background: #ef4444; color: #fff;
        font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 999px; z-index: 10000;
      }
      .aq-radial-item {
        position: fixed; left: 50%; bottom: 42px;
        transform: translate(-50%, 0) scale(0.3); opacity: 0; pointer-events: none;
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        transition: all 0.28s cubic-bezier(.34,1.56,.64,1); z-index: 9998; cursor: pointer;
      }
      .aq-radial-item.open {
        opacity: 1; pointer-events: auto;
        transform: translate(calc(-50% + var(--tx)), var(--ty)) scale(1);
      }
      .aq-radial-icon {
        width: 48px; height: 48px; border-radius: 15px;
        background: rgba(24, 28, 38, 0.95); border: 1px solid rgba(234,179,8,0.45);
        color: #facc15; display: flex; align-items: center; justify-content: center;
        font-size: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.5);
      }
      .aq-radial-label { font-size: 11px; font-weight: 700; color: #f8fafc; text-shadow: 0 2px 6px #000; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }

  function buildSessionCard() {
    if (document.getElementById('aq-session-card')) return;
    const card = document.createElement('div');
    card.id = 'aq-session-card';
    card.className = 'aq-session-card';
    card.innerHTML = `
      <div class="aq-greet" id="aq-greet-text">☀ GOOD MORNING</div>
      <div class="aq-brand">Aureus Quant</div>
      <div class="aq-clock-now" id="aq-clock-now">--:--</div>
      <div class="aq-dial-wrap">
        <svg id="aq-session-svg" viewBox="0 0 280 280" width="270" height="270"></svg>
      </div>
      <div class="aq-session-pills" id="aq-session-pills"></div>
      <div class="aq-status-title" id="aq-status-title"></div>
      <div class="aq-status-sub" id="aq-status-sub"></div>
    `;
    const target = document.querySelector('main, .container, #app') || document.body;
    target.insertBefore(card, target.firstChild);

    const pillsWrap = document.getElementById('aq-session-pills');
    [{ id: 'AUTO', name: 'LIVE', color: '#eab308' }, ...SESSIONS].forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'aq-pill' + (s.id === selectedSessionId ? ' active' : '');
      btn.style.color = s.color;
      btn.textContent = s.name.split(' ')[0];
      btn.onclick = () => {
        selectedSessionId = s.id;
        document.querySelectorAll('.aq-pill').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        updateSessionDial();
      };
      pillsWrap.appendChild(btn);
    });
  }

  function updateSessionDial() {
    const svg = document.getElementById('aq-session-svg');
    if (!svg) return;
    const now = new Date();
    const h = now.getHours();
    const greet = h < 12 ? '☀ GOOD MORNING' : h < 18 ? '🌤 GOOD AFTERNOON' : '🌙 GOOD EVENING';
    document.getElementById('aq-greet-text').textContent = greet;
    document.getElementById('aq-clock-now').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const nowHourLocal = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const cx = 140, cy = 140, rOuter = 114;

    let html = `
      <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="82" fill="none" stroke="rgba(234,179,8,0.14)" stroke-width="1" stroke-dasharray="3 5"/>
    `;

    // Titik tick 24 jam & label 00, 06, 12, 18
    for (let i = 0; i < 24; i++) {
      const p1 = polarToCartesian(cx, cy, rOuter - 4, i);
      const p2 = polarToCartesian(cx, cy, rOuter + 4, i);
      html += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="rgba(255,255,255,0.2)" stroke-width="${i % 6 === 0 ? 2 : 1}"/>`;
      if (i % 6 === 0) {
        const lbl = polarToCartesian(cx, cy, rOuter - 16, i);
        html += `<text x="${lbl.x.toFixed(1)}" y="${(lbl.y + 4).toFixed(1)}" fill="#94a3b8" font-size="10" font-weight="700" text-anchor="middle">${String(i).padStart(2, '0')}</text>`;
      }
    }

    // Jaringan konstelasi di bagian dalam
    const pts = [0, 3, 6, 9, 12, 15, 18, 21].map((hr, idx) => polarToCartesian(cx, cy, idx % 2 === 0 ? 64 : 46, hr));
    pts.forEach((p, idx) => {
      const next = pts[(idx + 1) % pts.length];
      const opp = pts[(idx + 3) % pts.length];
      html += `<line x1="${p.x}" y1="${p.y}" x2="${next.x}" y2="${next.y}" stroke="rgba(234,179,8,0.18)" stroke-width="0.8"/>`;
      html += `<line x1="${p.x}" y1="${p.y}" x2="${opp.x}" y2="${opp.y}" stroke="rgba(234,179,8,0.10)" stroke-width="0.7"/>`;
      html += `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#eab308" opacity="0.65"/>`;
    });

    // Gambar busur sesi (Asia, London, NY) pada radius bertingkat agar overlap terlihat jelas
    let activeList = [];
    SESSIONS.forEach((s, idx) => {
      const startL = utcToLocalHour(s.utcStart);
      const endL = utcToLocalHour(s.utcEnd);
      const rArc = rOuter - idx * 6;
      const isOpen = startL < endL
        ? (nowHourLocal >= startL && nowHourLocal < endL)
        : (nowHourLocal >= startL || nowHourLocal < endL);
      if (isOpen) activeList.push({ ...s, startL, endL, isOpen });

      const isFocus = selectedSessionId === 'AUTO' ? isOpen : selectedSessionId === s.id;
      const arcPath = describeArc(cx, cy, rArc, startL, endL);
      html += `<path d="${arcPath}" fill="none" stroke="${s.color}" stroke-width="${isFocus ? 5 : 2.5}" stroke-linecap="round" opacity="${isFocus ? 0.95 : 0.32}"/>`;

      const midHour = (startL + ((endL - startL + 24) % 24) / 2) % 24;
      const cityPos = polarToCartesian(cx, cy, rArc - 14, midHour);
      if (isFocus) {
        html += `<text x="${cityPos.x.toFixed(1)}" y="${cityPos.y.toFixed(1)}" fill="${s.color}" font-size="8.5" font-weight="800" text-anchor="middle">${s.city}</text>`;
      }
    });

    // Penanda posisi waktu user saat ini ("YOU")
    const youPos = polarToCartesian(cx, cy, rOuter, nowHourLocal);
    const youLbl = polarToCartesian(cx, cy, rOuter - 24, nowHourLocal);
    html += `
      <circle cx="${youPos.x.toFixed(1)}" cy="${youPos.y.toFixed(1)}" r="6" fill="#22c55e" stroke="#090d16" stroke-width="2"/>
      <text x="${youLbl.x.toFixed(1)}" y="${(youLbl.y + 3).toFixed(1)}" fill="#4ade80" font-size="9" font-weight="800" text-anchor="middle">YOU</text>
      <circle cx="${cx}" cy="${cy}" r="24" fill="rgba(15,23,42,0.9)" stroke="#eab308" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + 5}" fill="#eab308" font-size="15" font-weight="900" text-anchor="middle">AQ</text>
    `;
    svg.innerHTML = html;

    // Update teks info sesi di bawah dial
    const targetSession = selectedSessionId === 'AUTO'
      ? (activeList[0] || { ...SESSIONS[0], startL: utcToLocalHour(SESSIONS[0].utcStart), endL: utcToLocalHour(SESSIONS[0].utcEnd), isOpen: false })
      : (() => {
          const found = SESSIONS.find((x) => x.id === selectedSessionId);
          const sL = utcToLocalHour(found.utcStart), eL = utcToLocalHour(found.utcEnd);
          const open = sL < eL ? (nowHourLocal >= sL && nowHourLocal < eL) : (nowHourLocal >= sL || nowHourLocal < eL);
          return { ...found, startL: sL, endL: eL, isOpen: open };
        })();

    const diffHrs = targetSession.isOpen
      ? (targetSession.endL - nowHourLocal + 24) % 24
      : (targetSession.startL - nowHourLocal + 24) % 24;
    const remH = Math.floor(diffHrs);
    const remM = Math.floor((diffHrs - remH) * 60);

    document.getElementById('aq-status-title').innerHTML = `
      <span class="aq-status-dot" style="background:${targetSession.color}"></span>
      <span style="color:${targetSession.color}">${targetSession.name}</span>
    `;
    document.getElementById('aq-status-sub').textContent = targetSession.isOpen
      ? `Session open • ${remH}h ${remM}m left • ${formatHour12(targetSession.startL)}–${formatHour12(targetSession.endL)} your time`
      : `Opens in ${remH}h ${remM}m • ${formatHour12(targetSession.startL)}–${formatHour12(targetSession.endL)} your time`;
  }

  function buildFloatingNav() {
    if (document.getElementById('aq-bottom-nav')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'aq-backdrop';
    backdrop.className = 'aq-backdrop';

    const radialActions = [
      { icon: '📊', label: 'P&L & Backtest', tx: '-98px', ty: '-88px', action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) },
      { icon: '📢', label: 'Sinyal SMC', tx: '0px', ty: '-128px', action: () => document.getElementById('aq-session-card')?.scrollIntoView({ behavior: 'smooth' }) },
      { icon: '📰', label: 'Kalender News', tx: '98px', ty: '-88px', action: () => alert('High-Impact News Filter: Aktif (FOMC / NFP / CPI)') },
      { icon: '🤖', label: 'Bot Autopilot', tx: '-118px', ty: '-22px', action: () => alert('Status Agen: @Owneramrbot, @geminiamrbot & @Hermesagentambot Terhubung') },
      { icon: '⚡', label: 'Refresh Data', tx: '118px', ty: '-22px', action: () => window.location.reload() }
    ];

    const radialEls = radialActions.map((item) => {
      const el = document.createElement('div');
      el.className = 'aq-radial-item';
      el.style.setProperty('--tx', item.tx);
      el.style.setProperty('--ty', item.ty);
      el.innerHTML = `<div class="aq-radial-icon">${item.icon}</div><div class="aq-radial-label">${item.label}</div>`;
      el.onclick = () => {
        toggleMenu(false);
        item.action();
      };
      document.body.appendChild(el);
      return el;
    });

    const nav = document.createElement('nav');
    nav.id = 'aq-bottom-nav';
    nav.className = 'aq-bottom-nav';
    nav.innerHTML = `
      <button class="aq-nav-item active" onclick="window.scrollTo({top:0,behavior:'smooth'})"><span>🏠</span><span>BERANDA</span></button>
      <button class="aq-nav-item" onclick="document.querySelector('canvas')?.scrollIntoView({behavior:'smooth'})"><span>⚡</span><span>SINYAL</span></button>
      <div class="aq-fab-holder">
        <span class="aq-fab-badge">+3</span>
        <button id="aq-fab-btn" class="aq-fab-btn">✦</button>
      </div>
      <button class="aq-nav-item" onclick="document.querySelector('canvas')?.scrollIntoView({behavior:'smooth'})"><span>📈</span><span>GRAFIK</span></button>
      <button class="aq-nav-item" onclick="window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})"><span>📋</span><span>RIWAYAT</span></button>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(nav);

    let isOpen = false;
    const fabBtn = document.getElementById('aq-fab-btn');
    function toggleMenu(force) {
      isOpen = typeof force === 'boolean' ? force : !isOpen;
      fabBtn.classList.toggle('open', isOpen);
      fabBtn.textContent = isOpen ? '✕' : '✦';
      backdrop.classList.toggle('open', isOpen);
      radialEls.forEach((el) => el.classList.toggle('open', isOpen));
    }

    fabBtn.onclick = () => toggleMenu();
    backdrop.onclick = () => toggleMenu(false);
  }

  function init() {
    injectStyles();
    buildSessionCard();
    buildFloatingNav();
    updateSessionDial();
    setInterval(updateSessionDial, 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
JSEOF

# 1. Suntikkan script ke index.html jika belum ada
if ! grep -q "session_dial_fab.js" "$PROJECT_DIR/index.html"; then
  sed -i 's|</body>|  <script src="./session_dial_fab.js"></script>\n</body>|' "$PROJECT_DIR/index.html"
fi

# 2. Tambahkan ke daftar cache sw.js & naikkan versi build agar PWA Android auto-update
if [ -f "$PROJECT_DIR/sw.js" ]; then
  if ! grep -q "session_dial_fab.js" "$PROJECT_DIR/sw.js"; then
    sed -i "s|'./smc_visualizer.js',|'./smc_visualizer.js',\n  './session_dial_fab.js',|" "$PROJECT_DIR/sw.js"
  fi
  sed -i "s/aureus-quant-[0-9]*/aureus-quant-$(date +%Y%m%d%H%M%S)/" "$PROJECT_DIR/sw.js"
fi

# 3. Commit & push ke GitHub
git add index.html sw.js session_dial_fab.js
git commit -m "feat(ui): add 24h interactive market session dial and floating radial menu"
git push origin main

echo "=== SELESAI! Jam Sesi 24-Jam & Menu Melayang Radial sudah terpasang & ter-push ke GitHub ==="
