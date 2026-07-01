#!/usr/bin/env python3
"""
WiFi Security Audit — Detects real WiFi encryption of the current connection.
Uses nmcli (NetworkManager) on Linux. No guessing, no user input needed.
Returns JSON with encryption type, SSID, signal strength, and security assessment.
"""

import json
import subprocess
import sys
import re


def run_cmd(cmd: str) -> str:
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return result.stdout.strip()
    except Exception:
        return ""


def detect_wifi_security() -> dict:
    result = {
        "available": False,
        "ssid": "N/A",
        "encryption": "Desconocido",
        "key_mgmt": "N/A",
        "signal_dbm": 0,
        "signal_percent": 0,
        "frequency_ghz": "N/A",
        "gateway_ip": "N/A",
        "local_ip": "N/A",
        "security_rating": "unknown",
        "issues": [],
    }

    # Step 1: Get active WiFi connection name
    active_wifi = run_cmd("nmcli -t -f NAME,TYPE c show --active | grep wifi")
    if not active_wifi:
        # Try alternate: check if any wifi device is connected
        dev_status = run_cmd("nmcli -t -f DEVICE,TYPE,STATE dev | grep wifi | grep connected")
        if not dev_status:
            return result
        # Extract device name and find its connection
        device = dev_status.split(":")[0]
        conn_name = run_cmd(f"nmcli -t -f GENERAL.CONNECTION dev show {device} | head -1 | cut -d: -f2")
        if not conn_name:
            return result
    else:
        conn_name = active_wifi.split(":")[0]

    # Step 2: Get security settings from the connection profile
    key_mgmt = run_cmd(f"nmcli -t -f 802-11-wireless-security.key-mgmt c show '{conn_name}'")
    key_mgmt = key_mgmt.replace("802-11-wireless-security.key-mgmt:", "")

    # Step 3: Get current WiFi list to find our connected network's details
    wifi_list = run_cmd("nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY dev wifi list")
    current_ssid = ""
    current_security = ""
    current_signal = "0"

    for line in wifi_list.split("\n"):
        if line.startswith("*:"):
            parts = line.split(":")
            if len(parts) >= 4:
                current_ssid = parts[1]
                current_signal = parts[2]
                current_security = parts[3]
            break

    # Step 4: Get signal level, frequency and link speed from iwconfig
    iwconfig_out = run_cmd("iwconfig 2>/dev/null")
    signal_dbm = 0
    frequency_ghz = "N/A"
    link_speed_mbps = 0

    for line in iwconfig_out.split("\n"):
        essid_match = re.search(r'ESSID:"([^"]*)"', line)
        if essid_match:
            result["ssid"] = essid_match.group(1)
        freq_match = re.search(r'Frequency:([\d.]+)\s+GHz', line)
        if freq_match:
            frequency_ghz = freq_match.group(1)
        dbm_match = re.search(r'Signal level=(-?\d+)\s*dBm', line)
        if dbm_match:
            signal_dbm = int(dbm_match.group(1))
        speed_match = re.search(r'Bit Rate=([\d.]+)\s*Mb/s', line)
        if speed_match:
            link_speed_mbps = float(speed_match.group(1))

    # Step 4b: Get link speed from ethtool as fallback
    if link_speed_mbps == 0:
        wifi_device = run_cmd("nmcli -t -f DEVICE,TYPE dev | grep wifi | cut -d: -f1")
        if wifi_device:
            ethtool_out = run_cmd(f"ethtool {wifi_device} 2>/dev/null | grep 'Speed:'")
            speed_match = re.search(r'Speed:\s*([\d]+)\s*Mb/s', ethtool_out)
            if speed_match:
                link_speed_mbps = float(speed_match.group(1))

    # Step 4c: Get default gateway IP via ip route
    gateway = ""
    route_out = run_cmd("ip route show default")
    gw_match = re.search(r'default via (\S+)', route_out)
    if gw_match:
        gateway = gw_match.group(1)
        result["gateway_ip"] = gateway
    # Step 5: Measure latency (ping to gateway)
    latency_ms = 0
    if gateway:
        ping_out = run_cmd(f"ping -c 3 -W 1 {gateway} 2>/dev/null | grep 'rtt\\|round-trip'")
        if not ping_out:
            # Try alternate ping format
            ping_out = run_cmd(f"ping -c 3 {gateway} 2>&1 | tail -1")
        if ping_out:
            # Parse avg latency: rtt min/avg/max/mdev = X/Y/Z/W
            avg_match = re.search(r'= [\d.]+/([\d.]+)/', ping_out)
            if avg_match:
                latency_ms = float(avg_match.group(1))

    # Step 5: Get gateway IP
    gateway = run_cmd("ip route | grep default | awk '{print $3}'")
    if gateway:
        result["gateway_ip"] = gateway

    # Step 6: Get local IP
    local_ip = run_cmd("hostname -I | awk '{print $1}'")
    if local_ip:
        result["local_ip"] = local_ip

    # Step 7: Measure latency (ping to gateway)
    latency_ms = 0
    if gateway:
        ping_out = run_cmd(f"ping -c 3 -W 1 {gateway} 2>/dev/null | grep 'rtt\\|round-trip'")
        if not ping_out:
            ping_out = run_cmd(f"ping -c 3 {gateway} 2>&1 | tail -1")
        if ping_out:
            avg_match = re.search(r'= [\d.]+/([\d.]+)/', ping_out)
            if avg_match:
                latency_ms = float(avg_match.group(1))

    # Step 8: Determine encryption type
    encryption = "Desconocido"
    security_rating = "unknown"
    issues = []

    if current_security:
        encryption = current_security
    elif key_mgmt:
        if "wpa-psk" in key_mgmt.lower():
            encryption = "WPA2"
        elif "wpa-eap" in key_mgmt.lower():
            encryption = "WPA2-Enterprise"
        elif "wpa3" in key_mgmt.lower():
            encryption = "WPA3"
        elif "sae" in key_mgmt.lower():
            encryption = "WPA3-SAE"
        elif "owe" in key_mgmt.lower():
            encryption = "OWE (Enhanced Open)"
        elif "none" in key_mgmt.lower():
            encryption = "Abierta (Sin contraseña)"

    # Security assessment
    enc_lower = encryption.lower()
    if "wpa3" in enc_lower or "sae" in enc_lower:
        security_rating = "excellent"
    elif "wpa2" in enc_lower or "wpa-psk" in enc_lower:
        security_rating = "good"
    elif "wpa" in enc_lower:
        security_rating = "weak"
        issues.append("Cifrado WPA/WPA1 detectado. Es vulnerable a ataques de fuerza bruta. Actualiza a WPA2 o WPA3 en tu router.")
    elif "wep" in enc_lower:
        security_rating = "critical"
        issues.append("Cifrado WEP detectado. Es extremadamente inseguro y puede ser crackeado en minutos. Cámbialo inmediatamente a WPA2/WPA3.")
    elif "abierta" in enc_lower or "open" in enc_lower or encryption == "--":
        security_rating = "critical"
        issues.append("Red WiFi ABIERTA sin contraseña. Cualquier persona en el rango puede interceptar tu tráfico. Usa una VPN o conéctate a una red segura.")
    else:
        security_rating = "unknown"
        issues.append(f"No se pudo determinar el tipo de cifrado ({encryption}). Verifica la configuración de tu router.")

    # Signal assessment
    if signal_dbm < -80:
        issues.append(f"Señal WiFi muy débil ({signal_dbm} dBm). Alto riesgo de pérdida de paquetes y desconexiones.")
    elif signal_dbm < -65:
        issues.append(f"Señal WiFi moderada ({signal_dbm} dBm). Puede haber interferencias por paredes o distancia.")

    result["available"] = True
    result["ssid"] = current_ssid or result["ssid"]
    result["encryption"] = encryption
    result["key_mgmt"] = key_mgmt or "N/A"
    result["signal_dbm"] = signal_dbm
    result["signal_percent"] = int(current_signal) if current_signal.isdigit() else 0
    result["frequency_ghz"] = frequency_ghz
    result["link_speed_mbps"] = link_speed_mbps
    result["latency_ms"] = latency_ms
    result["security_rating"] = security_rating
    result["issues"] = issues

    return result


if __name__ == "__main__":
    data = detect_wifi_security()
    print(json.dumps(data, indent=2))
