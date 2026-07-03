#!/usr/bin/env python3
import requests
import socket
import json

GATEWAYS = [
    "192.168.1.1",
    "192.168.0.1",
    "10.0.0.1"
]

def detect_gateway():
    for ip in GATEWAYS:
        try:
            r = requests.get(f"http://{ip}", timeout=1)
            if r.status_code < 500:
                return ip, r
        except:
            try:
                r = requests.get(f"https://{ip}", timeout=1, verify=False)
                if r.status_code < 500:
                    return ip, r
            except:
                pass
    return None, None


def analyze_router():
    ip, r = detect_gateway()

    if not ip:
        return {
            "gateway": None,
            "status": "NO ROUTER DETECTED",
            "risk_score": 0,
            "reasons": ["No gateway reachable"]
        }

    headers = dict(r.headers)

    reasons = []
    score = 100  # partimos de seguro

    # 1. Panel LAN accesible (HECHO REAL)
    reasons.append("Router admin panel accessible in LAN")
    score -= 20

    # 2. HTTPS en LAN
    if not r.url.startswith("https"):
        reasons.append("No HTTPS on router interface")
        score -= 10

    # 3. Auth detectada
    if "WWW-Authenticate" in headers:
        reasons.append(f"Auth detected: {headers['WWW-Authenticate']}")
    else:
        reasons.append("No auth header detected (could be form-based login)")
        score -= 5

    # 4. Cookies genéricas (solo señal, no juicio fuerte)
    if "Set-Cookie" in headers:
        reasons.append("Session cookies detected")

    # LIMITAR SCORE
    score = max(0, min(score, 100))

    # clasificación REALISTA
    if score >= 80:
        status = "LOW RISK"
    elif score >= 50:
        status = "MEDIUM RISK"
    else:
        status = "ELEVATED LOCAL EXPOSURE"

    return {
        "gateway": ip,
        "status": status,
        "risk_score": score,
        "reasons": reasons
    }


if __name__ == "__main__":
    print(json.dumps(analyze_router(), indent=2))
