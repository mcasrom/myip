#!/usr/bin/env python3
import subprocess
import json
import requests


# ----------------------------
# helpers
# ----------------------------

def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True).strip()
    except:
        return ""


# ----------------------------
# IP pública
# ----------------------------

def get_public_ip():
    try:
        return requests.get("https://api.ipify.org", timeout=3).text.strip()
    except:
        return "UNKNOWN"


# ----------------------------
# DNS
# ----------------------------

def get_dns():
    out = run("cat /etc/resolv.conf | grep nameserver | awk '{print $2}'")
    return out.split("\n") if out else []


# ----------------------------
# WIFI
# ----------------------------

def get_wifi():
    out = run("nmcli -t -f active,ssid,signal,security dev wifi | grep '^yes'")
    if not out:
        return None

    p = out.split(":")
    if len(p) < 4:
        return None

    return {
        "ssid": p[1],
        "signal": int(p[2]) if p[2].isdigit() else 0,
        "security": p[3]
    }


# ----------------------------
# ROUTER
# ----------------------------

def get_gateway():
    return run("ip route | grep default | awk '{print $3}'")


# ----------------------------
# SCORE SIMPLE
# ----------------------------

def wifi_score(wifi):
    if not wifi:
        return 50

    score = wifi["signal"]
    if "WPA3" in wifi["security"]:
        score += 20
    elif "WPA2" in wifi["security"]:
        score += 10
    elif "OPEN" in wifi["security"]:
        score -= 40

    return max(0, min(100, score))


def dns_score(dns):
    if not dns:
        return 50
    return 70 if any(d.startswith("192.168.") for d in dns) else 40


def router_score(gw):
    if not gw:
        return 0
    return 70  # solo existencia de gateway + panel asumido


# ----------------------------
# MAIN
# ----------------------------

def analyze():
    ip = get_public_ip()
    dns = get_dns()
    wifi = get_wifi()
    gw = get_gateway()

    ws = wifi_score(wifi)
    ds = dns_score(dns)
    rs = router_score(gw)

    global_score = int((ws * 0.4) + (ds * 0.3) + (rs * 0.3))

    return {
        "ip": ip,
        "dns": dns,
        "wifi": wifi,
        "gateway": gw,
        "scores": {
            "wifi": ws,
            "dns": ds,
            "router": rs,
            "global": global_score
        },
        "status": (
            "EXCELLENT" if global_score > 80 else
            "GOOD" if global_score > 60 else
            "RISK" if global_score > 40 else "CRITICAL"
        )
    }


if __name__ == "__main__":
    print(json.dumps(analyze(), indent=2))
