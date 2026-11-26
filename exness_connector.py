import json
import urllib.request

BRIDGE_URL = "http://127.0.0.1:8787"

def send_order_to_exness(side: str, symbol: str = "XAUUSD", lot: float = 0.05, sl: float = 0.0, tp: float = 0.0, comment: str = "AureusSMC"):
    payload = {
        "side": side.upper(),  # "BUY" atau "SELL"
        "symbol": symbol,
        "lot": float(lot),
        "sl": float(sl),
        "tp": float(tp),
        "comment": comment
    }
    req = urllib.request.Request(
        f"{BRIDGE_URL}/api/exness/push_signal",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))
