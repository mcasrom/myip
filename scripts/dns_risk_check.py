#!/usr/bin/env python3
import subprocess
import socket
import json
import re
import requests


# ----------------------------
# UTIL
# ----------------------------

def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True).strip()
    except:
        return ""


# ----------------------------
# DNS DEL SISTEMA
# ----------------------------

def get_dns_servers():
    out = run("cat /etc/resolv.conf | grep nameserver | awk '{print $2}'")
    return [x for x in out.split("\n") if x]


# ----------------------------
# CHECK RESOLUCIÓN
# ----------------------------

def test_resolution(domain="google.com"):
    try:
        ip = socket.gethostbyname(domain)
        return True, ip
    except:
        return False, None


# ----------------------------
# CHECK DNS LEAK BÁSICO
# ----------------------------

def detect_private_dns(dns_list):
    private_ranges = [
        "10.", "172.", "192.168.", "127.", "0."
    ]

    return any(any(d.startswith(r) for r in private_ranges) for d in dns_list)


# ----------------------------
# CHECK DNS RIESGOS BÁSICOS
# ----------------------------

def dns_risk_score(dns_list):
    score = 100
    risks = []

    if not dns_list:
        return 0, ["NO_DNS_CONFIGURED"]

    # DNS privados (router local)
    if detect_private_dns(dns_list):
        risks.append("USING_LOCAL_DNS_RESOLVER")
        score -= 10

    # DNS sospechoso conocido (ejemplo básico)
    suspicious = {
        "1.1.1.1": 0,   # Cloudflare OK
        "8.8.8.8": 0,   # Google OK
        "9.9.9.9": 0,   # Quad9 OK
    }

    for d in dns_list:
        if d not in suspicious:
            risks.append("NON_STANDARD_DNS")
            score -= 5
            break

    # múltiples DNS = posible failover
    if len(dns_list) > 2:
        risks.append("MULTIPLE_DNS_SERVERS")
        score -= 5

    score = max(0, min(100, score))

    if score > 85:
        status = "LOW_RISK"
    elif score > 60:
        status = "MEDIUM_RISK"
    else:
        status = "HIGH_RISK"

    return score, risks, status


# ----------------------------
# DNS REPUTATION CHECK (BÁSICO EXTERNO OPCIONAL)
# ----------------------------

def check_public_dns(dns_list):
    public_known = {
        "1.1.1.1": "Cloudflare",
        "8.8.8.8": "Google",
        "9.9.9.9": "Quad9",
        "208.67.222.222": "OpenDNS"
    }

    result = []

    for d in dns_list:
        result.append({
            "dns": d,
            "provider": public_known.get(d, "UNKNOWN"),
            "trusted": d in public_known
        })

    return result


# ----------------------------
# MAIN ANALYSIS
# ----------------------------

def analyze():
    dns = get_dns_servers()
    ok, ip = test_resolution()

    score, risks, status = dns_risk_score(dns)

    return {
        "dns_servers": dns,
        "resolution_test": {
            "success": ok,
            "example_ip": ip
        },
        "dns_reputation": check_public_dns(dns),
        "risk_score": score,
        "status": status,
        "risks_detected": risks
    }


# ----------------------------
# ENTRY
# ----------------------------

if __name__ == "__main__":
    print(json.dumps(analyze(), indent=2))
