// Simple SMA-based trading signal bot for Binance crypto.
// Uses Binance public REST API (no API key needed for market data).
// Order placement supports Binance testnet endpoints (no funds needed).

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const TESTNET_BASE = 'https://testnet.binance.vision/api/v3';

// Mapping user-friendly symbol -> Binance API symbol
const SYMBOL_MAP = {
  XAUUSD: 'XAUTUSDT',
  BTCUSD: 'BTCUSDT',
};

const DISPLAY_SYMBOLS = ['XAUUSD', 'BTCUSD'];
let currentSymbol = 'XAUUSD'; // display name
let prices = []; // rolling list of recent prices (max ~30)

function getBinanceSymbol(displayName) {
  return SYMBOL_MAP[displayName] || displayName;
}

async function fetchPrice(displayName) {
  const symbol = getBinanceSymbol(displayName);
  const url = `${BINANCE_BASE}/ticker/price?symbol=${symbol}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  const data = await res.json();
  return parseFloat(data.price);
}

function calculateSMA(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

function addPrice(price) {
  prices.push(price);
  if (prices.length > 30) prices.shift();
}

function getIndicators() {
  if (prices.length < 10) return null;
  const last10 = prices.slice(-10);
  const last30 = prices.slice(-30);
  const sma10 = calculateSMA(last10);
  const sma30 = calculateSMA(last30);
  const lastPrice = prices[prices.length - 1];
  const signal = lastPrice > sma10 ? 'BUY' : (lastPrice < sma10 ? 'SELL' : 'HOLD');
  return { lastPrice, sma10, sma30, signal };
}

function renderSignals() {
  const signalsDiv = document.getElementById('signals');
  const ind = getIndicators();
  if (!ind) {
    signalsDiv.innerHTML = '<p class="pending">Menunggu data cukup lama (butuh 10 price) untuk kalkulasi sinyal...</p>';
    return;
  }
  const status = document.getElementById('status');
  status.textContent = `Last price: $${ind.lastPrice.toFixed(2)} | SMA10: $${ind.sma10.toFixed(2)} | SMA30: $${ind.sma30.toFixed(2)}`;
  signalsDiv.innerHTML = `<p class="pending">Signal: <strong>${ind.signal}</strong> (SMA10 crossover strategy)</p>`;
}

async function update() {
  try {
    const price = await fetchPrice(currentSymbol);
    document.getElementById('price').textContent = '$' + price.toFixed(2);
    addPrice(price);
    renderSignals();
  } catch (e) {
    document.getElementById('status').textContent = 'Error fetching price: ' + e.message;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Warmup: fetch a few prices so SMA is ready
  for (let i = 0; i < 10; i++) {
    try { addPrice(await fetchPrice(currentSymbol)); } catch (e) {}
  }
  renderSignals();
  update();
  setInterval(update, 60000); // poll every 60s

  document.getElementById('buyBtn').addEventListener('click', () => executeTrade('BUY'));
  document.getElementById('sellBtn').addEventListener('click', () => executeTrade('SELL'));
});

window.executeTrade = async function (side) {
  const status = document.getElementById('status');
  status.textContent = 'Sedang memproses order via Testnet (tidak ada uang nyata)...';
  try {
    const binanceSymbol = getBinanceSymbol(currentSymbol);
    const res = await fetch(`${TESTNET_BASE}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: binanceSymbol,
        side: side,
        type: 'LIMIT',
        timeInForce: 'GTC',
        price: '1',
        quantity: '0.001',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      status.textContent = `Order ${side} berhasil via Testnet (paper trading): ${JSON.stringify(data)}`;
    } else {
      status.textContent = `Order ${side} gagal: ${JSON.stringify(data)}`;
    }
  } catch (e) {
    status.textContent = 'Error saat execute order: ' + e.message;
  }
};

// Switch symbol (callable from UI)
window.setSymbol = function (sym) {
  currentSymbol = sym;
  prices = [];
  document.getElementById('currentSymbol').textContent = sym;
};
