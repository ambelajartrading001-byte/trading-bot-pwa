#!/bin/bash
PROJECT_DIR="/root/trading-bot-pwa"
DATA_DIR="$PROJECT_DIR/data"
mkdir -p "$DATA_DIR"
cd "$PROJECT_DIR" || exit 1

echo "=== 1. CEK FILE CSV EXISTING DI PROJECT ==="
find "$PROJECT_DIR" -maxdepth 3 -iname "*xau*.csv" -o -iname "*gold*.csv" -o -iname "*.csv"

echo -e "\n=== 2. CEK FORMAT DATA YANG DIBACA BACKTEST.JS ==="
grep -n -C 5 -iE "csv|ohlc|open|high|low|close|timestamp|fetch|readFile" "$PROJECT_DIR/backtest.js" 2>/dev/null | head -n 30

echo -e "\n=== 3. DOWNLOAD DATA HISTORIS XAUUSD (OHLCV) ==="
CSV_FILE="$DATA_DIR/XAUUSD_1H.csv"

python3 - << 'PYEOF'
import urllib.request, json, csv, datetime

# Ambil data historis Gold Futures (GC=F / XAUUSD proxy) timeframe 1H (730 hari terakhir) via Yahoo Finance API
url = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1h&range=730d"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        result = data["chart"]["result"][0]
        timestamps = result["timestamp"]
        quote = result["indicators"]["quote"][0]
        
        out_path = "/root/trading-bot-pwa/data/XAUUSD_1H.csv"
        rows_written = 0
        with open(out_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "datetime", "open", "high", "low", "close", "volume"])
            for i, ts in enumerate(timestamps):
                o, h, l, c, v = quote["open"][i], quote["high"][i], quote["low"][i], quote["close"][i], quote["volume"][i]
                if None not in (o, h, l, c):
                    dt_str = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                    writer.writerow([ts, dt_str, round(o, 2), round(h, 2), round(l, 2), round(c, 2), v or 0])
                    rows_written += 1
        print(f"[SUKSES] Tersimpan {rows_written} baris candle XAUUSD (1H) ke {out_path}")
except Exception as e:
    print(f"[ERROR DOWNLOAD] {e}")
PYEOF

echo -e "\n=== 4. VERIFIKASI ISI FILE CSV ==="
if [ -f "$CSV_FILE" ]; then
    echo "Total baris: $(wc -l < "$CSV_FILE")"
    echo "--- 5 Baris Pertama ---"
    head -n 5 "$CSV_FILE"
    echo "--- 5 Baris Terakhir ---"
    tail -n 5 "$CSV_FILE"
fi
