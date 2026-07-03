#!/usr/bin/env python3
import subprocess
import json
import re


def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True).strip()
    except:
        return ""


def get_active_wifi():
    # SSID, signal, security real desde NetworkManager
    out = run("nmcli -t -f active,ssid,signal,security dev wifi | grep '^yes'")
    if not out:
        return None

    parts = out.split(":")
    if len(parts) < 4:
        return None

    return {
        "ssid": parts[1],
        "signal": int(parts[2]) if parts[2].isdigit() else 0,
        "security_raw": parts[3]
    }


def get_wifi_interface():
    # intenta detectar interfaz WiFi activa
    iface = run("nmcli -t -f DEVICE,TYPE device | grep wifi | cut -d: -f1")
    return iface if iface else None


def get_nearby_network_count():
    # número de redes visibles (proxy real de congestión)
    out = run("nmcli -t -f SSID dev wifi list | wc -l")
    try:
        return int(out)
    except:
        return 0


def classify_signal(signal):
    if signal >= 80:
        return "EXCELENTE"
    if signal >= 60:
        return "BUENA"
    if signal >= 40:
        return "MEDIA"
    return "BAJA"


def parse_security(sec):
    sec = sec.upper()

    if "WPA3" in sec:
        return "WPA3", 100
    if "WPA2" in sec:
        return "WPA2", 70
    if "WPA" in sec:
        return "WPA", 60
    if "WEP" in sec:
        return "WEP", 10
    if sec == "" or "OPEN" in sec:
        return "OPEN", 0

    return "UNKNOWN", 40


def saturation_level(networks, signal):
    # SOLO aproximación basada en datos visibles
    if networks > 25:
        return "ALTA"
    if networks > 15:
        return "MEDIA"
    return "BAJA"


def generate_recommendations(security_type, signal, networks):
    rec = []

    if security_type == "OPEN":
        rec.append("Red sin cifrado: cambiar a WPA2/WPA3 inmediatamente")

    if security_type == "WPA2":
        rec.append("Actualizar a WPA3 si el router lo soporta")

    if signal < 50:
        rec.append("Señal débil: acercarse al router o mejorar ubicación")

    if networks > 20:
        rec.append("Alta densidad de redes: cambiar canal WiFi (1/6/11 en 2.4GHz)")

    if not rec:
        rec.append("Configuración WiFi correcta")

    return rec


def calculate_score(signal, sec_score, networks):
    score = (signal * 0.6) + (sec_score * 0.4)

    # penalización ligera por congestión visible
    if networks > 20:
        score -= 10

    return max(0, min(100, int(score)))


def analyze():
    wifi = get_active_wifi()
    iface = get_wifi_interface()

    if not wifi:
        return {"error": "No active WiFi connection detected"}

    networks = get_nearby_network_count()

    sec_type, sec_score = parse_security(wifi["security_raw"])
    signal_quality = classify_signal(wifi["signal"])
    saturation = saturation_level(networks, wifi["signal"])

    score = calculate_score(wifi["signal"], sec_score, networks)

    return {
        "interface": iface,
        "ssid": wifi["ssid"],
        "signal": wifi["signal"],
        "signal_quality": signal_quality,
        "security": sec_type,
        "networks_visible": networks,
        "channel_saturation": saturation,
        "score": score,
        "recommendations": generate_recommendations(sec_type, wifi["signal"], networks)
    }


if __name__ == "__main__":
    print(json.dumps(analyze(), indent=2))
