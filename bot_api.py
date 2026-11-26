#!/usr/bin/env python3
import json
import os
import signal
import subprocess
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

BASE_DIR = "/root/trading-bot-pwa"
CONFIG_FILE = os.path.join(BASE_DIR, "bot_config.json")
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

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                return {**DEFAULT_CONFIG, **data}
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()

def save_config(cfg):
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)

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
    # Cek via pgrep sebagai cadangan
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
    cfg = load_config()
    cfg["running"] = True
    save_config(cfg)
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
    cfg = load_config()
    cfg["running"] = False
    save_config(cfg)
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
            cfg = load_config()
            cfg["running"] = running
            self._send_json(200, {
                "ok": True,
                "running": running,
                "pid": pid,
                "config": cfg,
                "logs": tail_logs(15)
            })
        else:
            self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        if self.path.startswith("/api/bot/control"):
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            try:
                body = json.loads(raw)
            except Exception:
                body = {}

            action = body.get("action", "")
            incoming_cfg = body.get("config")
            if isinstance(incoming_cfg, dict):
                merged = {**load_config(), **incoming_cfg}
                save_config(merged)

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
                "config": load_config(),
                "logs": tail_logs(15)
            })
        else:
            self._send_json(404, {"ok": False, "error": "Not found"})

    def log_message(self, format, *args):
        return

if __name__ == "__main__":
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
    server = HTTPServer(("0.0.0.0", 8787), BridgeHandler)
    print("[Aureus Bridge] Listening on http://0.0.0.0:8787")
    server.serve_forever()
