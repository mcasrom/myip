#!/usr/bin/env python3
import json
import os
import time
import subprocess

BASELINE_FILE = "dns_baseline.json"
SCHEMA_VERSION = 3


# ----------------------------
# SYSTEM
# ----------------------------

def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True).strip()
    except:
        return ""


def get_dns():
    out = run("cat /etc/resolv.conf | grep nameserver | awk '{print $2}'")
    return [x for x in out.split("\n") if x]


# ----------------------------
# SAFE LOAD
# ----------------------------

def load_baseline():
    if not os.path.exists(BASELINE_FILE):
        return None

    try:
        with open(BASELINE_FILE, "r") as f:
            return json.load(f)
    except:
        return None


# ----------------------------
# MIGRATION ENGINE
# ----------------------------

def migrate_baseline(raw):
    """
    Convierte cualquier formato antiguo a formato v3 estable
    """

    if not raw:
        return None

    # si ya es v3
    if isinstance(raw, dict) and raw.get("version") == SCHEMA_VERSION:
        return raw

    dns_data = raw.get("dns", []) if isinstance(raw, dict) else raw

    normalized = []

    for x in dns_data:
        if isinstance(x, dict):
            normalized.append({
                "dns": x.get("dns"),
                "type": x.get("type", "UNKNOWN")
            })
        else:
            normalized.append({
                "dns": x,
                "type": "LEGACY"
            })

    return {
        "version": SCHEMA_VERSION,
        "dns": normalized,
        "timestamp": time.time()
    }


# ----------------------------
# SAVE
# ----------------------------

def save_baseline(data):
    with open(BASELINE_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ----------------------------
# DNS CLASSIFICATION
# ----------------------------

def classify_dns(dns_list):
    result = []

    for d in dns_list:
        if d in ["1.1.1.1", "8.8.8.8", "9.9.9.9"]:
            t = "TRUSTED_PUBLIC"
        elif d.startswith("192.168.") or d == "127.0.0.1":
            t = "LOCAL_ROUTER"
        elif ":" in d:
            t = "ISP_IPV6"
        else:
            t = "ISP_DNS"

        result.append({"dns": d, "type": t})

    return result


# ----------------------------
# COMPARE SAFE
# ----------------------------

def compare(current, baseline):
    if not baseline:
        return {
            "first_run": True,
            "change_detected": False,
            "reason": "BASELINE_CREATED",
            "severity": "NONE"
        }

    old = {x["dns"]: x["type"] for x in baseline.get("dns", [])}
    new = {x["dns"]: x["type"] for x in current}

    added = set(new) - set(old)
    removed = set(old) - set(new)

    # ignorar ruido ISP IPv6
    real_changes = []

    for d in added | removed:
        if new.get(d) == "ISP_IPV6" or old.get(d) == "ISP_IPV6":
            continue
        real_changes.append(d)

    if not real_changes:
        return {
            "first_run": False,
            "change_detected": False,
            "reason": "ISP_NOISE_OR_IPV6_ROTATION",
            "severity": "NONE"
        }

    severity = "LOW"
    if len(real_changes) > 1:
        severity = "MEDIUM"
    if len(real_changes) > 2:
        severity = "HIGH"

    return {
        "first_run": False,
        "change_detected": True,
        "added": list(added),
        "removed": list(removed),
        "real_changes": real_changes,
        "severity": severity,
        "reason": "DNS_CHANGE"
    }


# ----------------------------
# MAIN
# ----------------------------

def analyze():
    dns = get_dns()
    classified = classify_dns(dns)

    raw = load_baseline()
    baseline = migrate_baseline(raw)

    comparison = compare(classified, baseline)

    # guardar baseline SIEMPRE en formato nuevo
    save_baseline({
        "version": SCHEMA_VERSION,
        "dns": classified,
        "timestamp": time.time()
    })

    return {
        "dns": dns,
        "classification": classified,
        "analysis": comparison,
        "status": (
            "OK" if not comparison["change_detected"]
            else comparison["severity"] + "_ALERT"
        )
    }


if __name__ == "__main__":
    print(json.dumps(analyze(), indent=2))
