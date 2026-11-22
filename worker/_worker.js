// _worker.js — Cloudflare Worker proxy untuk trading REAL Binance.
// Mengapa: api.binance.com memblokir CORS dari browser PWA murni.
// Worker ini berjalan di server Cloudflare sehingga signature & order
// bisa dipanggil dari browser, tanpa mengekspos API secret ke publik.
//
// DEPLOY:
//  1. npm i -g wrangler  (atau pakai npx wrangler)
//  2. Edit nama worker di bawah, lalu:
//       npx wrangler deploy _worker.js --name trading-bot-proxy
//  3. Set secret (sekali saja):
//       npx wrangler secret put BINANCE_SECRET   # isi API Secret kamu
//  4. Worker URL jadi: https://trading-bot-proxy.<your-sub>.workers.dev
//  5. Di Pengaturan app PWA, isi "Proxy URL Real" dengan URL itu.
//     API Key dikirim dari browser per request; Secret disimpan aman di worker.
//
// Endpoints:
//  POST /order   body: { apiKey, symbol, side, type, price, quantity }
//  GET  /account body param: apiKey  (opsional, untuk validasi)

const BINANCE_API = 'https://api.binance.com/api/v3';

// CORS headers biar bisa dipanggil dari PWA di GitHub Pages
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-MBX-APIKEY',
  'Access-Control-Max-Age': '86400',
};

async function sha256Hmac(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const method = request.method;
    const url = new URL(request.url);

    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const secret = env.BINANCE_SECRET;
    if (!secret) {
      return json({ error: 'BINANCE_SECRET belum diset di worker. Jalankan: npx wrangler secret put BINANCE_SECRET' }, 500);
    }

    // ---- GET /account ----
    if (pathMatches(url.pathname, '/account') && method === 'GET') {
      const apiKey = url.searchParams.get('apiKey') || '';
      if (!apiKey) return json({ error: 'apiKey dibutuhkan' }, 400);
      const qs = new URLSearchParams({ timestamp: Date.now(), recvWindow: 20000 });
      const sig = await sha256Hmac(qs.toString(), secret);
      try {
        const r = await fetch(`${BINANCE_API}/account?${qs}&signature=${sig}`, {
          headers: { 'X-MBX-APIKEY': apiKey },
        });
        const d = await r.json();
        // jangan bocorkan balance penuh ke client kalau mau; return totalEquity
        if (r.ok && d.balances) {
          const total = d.balances.reduce((sum, b) => {
            const v = parseFloat(b.free) + parseFloat(b.locked);
            return sum + v;
          }, 0);
          return json({ ok: true, totalEquity: total, balances: d.balances.slice(0, 20) });
        }
        return json({ ok: false, ...d }, r.status);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ---- POST /order ----
    if (pathMatches(url.pathname, '/order') && method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'invalid JSON body' }, 400); }
      const { apiKey, symbol, side, type = 'LIMIT', price, quantity, timeInForce = 'GTC' } = body || {};
      if (!apiKey || !symbol || !side || !quantity) {
        return json({ error: 'Butuh: apiKey, symbol, side, quantity (price untuk limit)' }, 400);
      }
      const params = { symbol, side, type, timeInForce, quantity: String(quantity) };
      if (type === 'LIMIT' && !price) return json({ error: 'Harga dibutuhkan untuk order LIMIT' }, 400);
      if (type === 'LIMIT') params.price = String(price);
      params.timestamp = Date.now();
      params.recvWindow = 20000;
      const qs = new URLSearchParams(params);
      const sig = await sha256Hmac(qs.toString(), secret);
      try {
        const r = await fetch(`${BINANCE_API}/order?${qs}&signature=${sig}`, {
          method: 'POST',
          headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const d = await r.json();
        if (r.ok) return json({ ok: true, ...d });
        return json({ ok: false, ...d }, r.status);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return json({ error: 'Unknown route. Gunakan /order atau /account' }, 404);
  },
};

function pathMatches(p, expected) {
  return p.endsWith(expected) || p === expected;
}