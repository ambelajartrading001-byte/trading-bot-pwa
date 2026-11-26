#!/usr/bin/env python3
import json
import os
import signal
import subprocess
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

BASE_DIR = "/root/trading-bot-pwa"
CONFIG_FILE = os.path.join(BASE_DIR, "bot_config.json")
EXNESS_FILE = os.path.join(BASE_DIR, "exness_account.json")
SIGNAL_QUEUE_FILE = os.path.join(BASE_DIR, "exness_pending_signal.json")
PID_FILE = os.path.join(BASE_DIR, "auto_trader.pid")
LOG_FILE = os.path.join(BASE_DIR, "auto_trader.log")
TRADER_SCRIPT = os.path.join(BASE_DIR, "auto_trader.py")

DEFAULT_CONFIG = {
    "running": False,
    "symbol": "XAUUSD",
    "timeframe": "H1",
    "accountType": "Exness Cent / Demo",
    "lotSize": "0.05",
    "riskPct": "1.5",
    "atrSlMult": "1.5",
    "atrTpMult": "3.0",
    "useFvg": True,
    "useEma200": True,
    "autoTrailing": True
}

DEFAULT_EXNESS = {
    "connected": False,
    "login": "",
    "server": "Exness-MT5Trial8",
    "mode": "DEMO",
    "symbolSuffix": "m",
    "balance": 0.0,
    "equity": 0.0,
    "freeMargin": 0.0,
    "floatingPnl": 0.0,
    "openPositions": 0,
    "lastHeartbeat": 0
}

def read_json(path, fallback):
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return {**fallback, **json.load(f)}
        except Exception:
            pass
    return fallback.copy()

def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def is_trader_running():
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r") as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)
            return True, pid
        except Exception:
            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)
    try:
        out = subprocess.check_output(["pgrep", "-f", "auto_trader.py"]).decode().strip()
        if out:
            pid = int(out.splitlines()[0])
            with open(PID_FILE, "w") as f:
                f.write(str(pid))
            return True, pid
    except Exception:
        pass
    return False, None

def start_trader():
    running, pid = is_trader_running()
    if running:
        return True, f"auto_trader.py sudah berjalan (PID {pid})"
    if not os.path.exists(TRADER_SCRIPT):
        return False, "File auto_trader.py tidak ditemukan di /root/trading-bot-pwa"
    log_fp = open(LOG_FILE, "a")
    proc = subprocess.Popen(
        ["python3", TRADER_SCRIPT],
        cwd=BASE_DIR,
        stdout=log_fp,
        stderr=subprocess.STDOUT,
        start_new_session=True
    )
    with open(PID_FILE, "w") as f:
        f.write(str(proc.pid))
    cfg = read_json(CONFIG_FILE, DEFAULT_CONFIG)
    cfg["running"] = True
    write_json(CONFIG_FILE, cfg)
    return True, f"auto_trader.py dijalankan (PID {proc.pid})"

def stop_trader():
    running, pid = is_trader_running()
    if running and pid:
        try:
            os.kill(pid, signal.SIGTERM)
            time.sleep(0.5)
        except Exception:
            pass
    subprocess.run(["pkill", "-f", "auto_trader.py"], stderr=subprocess.DEVNULL)
    if os.path.exists(PID_FILE):
        os.remove(PID_FILE)
    cfg = read_json(CONFIG_FILE, DEFAULT_CONFIG)
    cfg["running"] = False
    write_json(CONFIG_FILE, cfg)
    return True, "auto_trader.py dihentikan dengan aman"

def tail_logs(lines=15):
    if not os.path.exists(LOG_FILE):
        return ["[BRIDGE] Menunggu log dari auto_trader.py..."]
    try:
        with open(LOG_FILE, "r") as f:
            data = f.read().splitlines()
        return data[-lines:] if data else ["[BRIDGE] Log kosong"]
    except Exception as e:
        return [f"[ERROR] Gagal membaca log: {e}"]

class BridgeHandler(BaseHTTPRequestHandler):
    def _send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_GET(self):
        if self.path.startswith("/api/bot/status"):
            running, pid = is_trader_running()
            cfg = read_json(CONFIG_FILE, DEFAULT_CONFIG)
            cfg["running"] = running
            ex = read_json(EXNESS_FILE, DEFAULT_EXNESS)
            # Anggap MT5 aktif jika heartbeat < 45 detik terakhir
            ex["mt5Online"] = (time.time() - float(ex.get("lastHeartbeat", 0))) < 45
            self._send_json(200, {
                "ok": True,
                "running": running,
                "pid": pid,
                "config": cfg,
                "exness": ex,
                "logs": tail_logs(15)
            })
        elif self.path.startswith("/api/exness/signal"):
            # Dibaca oleh EA MT5 setiap detik untuk mengambil order baru
            if os.path.exists(SIGNAL_QUEUE_FILE):
                sig = read_json(SIGNAL_QUEUE_FILE, {})
                os.remove(SIGNAL_QUEUE_FILE)
                self._send_json(200, {"ok": True, "hasSignal": True, "signal": sig})
            else:
                self._send_json(200, {"ok": True, "hasSignal": False})
        else:
            self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            body = json.loads(raw)
        except Exception:
            body = {}

        if self.path.startswith("/api/bot/control"):
            action = body.get("action", "")
            incoming_cfg = body.get("config")
            if isinstance(incoming_cfg, dict):
                write_json(CONFIG_FILE, {**read_json(CONFIG_FILE, DEFAULT_CONFIG), **incoming_cfg})

            if action == "START_BOT":
                ok, msg = start_trader()
            elif action == "STOP_BOT":
                ok, msg = stop_trader()
            elif action == "UPDATE_CONFIG":
                ok, msg = True, "Parameter bot_config.json diperbarui"
            else:
                ok, msg = False, f"Aksi tidak dikenal: {action}"

            running, pid = is_trader_running()
            self._send_json(200, {
                "ok": ok,
                "message": msg,
                "running": running,
                "pid": pid,
                "config": read_json(CONFIG_FILE, DEFAULT_CONFIG),
                "exness": read_json(EXNESS_FILE, DEFAULT_EXNESS),
                "logs": tail_logs(15)
            })

        elif self.path.startswith("/api/exness/config"):
            ex = {**read_json(EXNESS_FILE, DEFAULT_EXNESS), **body, "connected": True}
            write_json(EXNESS_FILE, ex)
            with open(LOG_FILE, "a") as lf:
                lf.write(f"[EXNESS] Akun MT5 {ex.get('login')} ({ex.get('server')} · {ex.get('mode')}) terkonfigurasi\n")
            self._send_json(200, {"ok": True, "message": "Kredensial Exness tersimpan", "exness": ex})

        elif self.path.startswith("/api/exness/telemetry"):
            # Dikirim oleh EA MT5 untuk memperbarui saldo & floating PnL di PWA
            ex = read_json(EXNESS_FILE, DEFAULT_EXNESS)
            ex.update({
                "connected": True,
                "balance": float(body.get("balance", ex["balance"])),
                "equity": float(body.get("equity", ex["equity"])),
                "freeMargin": float(body.get("freeMargin", ex["freeMargin"])),
                "floatingPnl": float(body.get("floatingPnl", ex["floatingPnl"])),
                "openPositions": int(body.get("openPositions", ex["openPositions"])),
                "lastHeartbeat": time.time()
            })
            write_json(EXNESS_FILE, ex)
            self._send_json(200, {"ok": True})

        elif self.path.startswith("/api/exness/push_signal"):
            # Dipanggil oleh auto_trader.py saat setup SMC valid ditemukan
            write_json(SIGNAL_QUEUE_FILE, body)
            with open(LOG_FILE, "a") as lf:
                lf.write(f"[ORDER-QUEUE] Sinyal {body.get('side')} {body.get('symbol')} Lot={body.get('lot')} SL={body.get('sl')} TP={body.get('tp')}\n")
            self._send_json(200, {"ok": True, "queued": True})

        else:
            self._send_json(404, {"ok": False, "error": "Not found"})

    def log_message(self, format, *args):
        return

if __name__ == "__main__":
    if not os.path.exists(CONFIG_FILE):
        write_json(CONFIG_FILE, DEFAULT_CONFIG)
    if not os.path.exists(EXNESS_FILE):
        write_json(EXNESS_FILE, DEFAULT_EXNESS)
    server = HTTPServer(("0.0.0.0", 8787), BridgeHandler)
    print("[Aureus Bridge + Exness] Listening on http://0.0.0.0:8787")
    server.serve_forever()
