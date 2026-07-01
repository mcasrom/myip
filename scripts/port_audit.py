#!/usr/bin/env python3
"""
port_audit.py — Herramienta de auditoría de puertos para MyIP
Uso: python3 port_audit.py <IP_OBJETIVO> [--profile quick|standard]

Devuelve JSON con:
  - Estado real de cada puerto (open/closed/filtered)
  - Servicio detectado + versión (banner grabbing via nmap)
  - Información del firewall local (solo informativa)
  - Validación de que la IP es pública (seguridad)
"""
import subprocess
import shutil
import json
import sys
import re
from pathlib import Path
from datetime import datetime

# Puertos críticos a auditar
CRITICAL_PORTS = {
    22: "SSH (Secure Shell)",
    80: "HTTP (Tráfico Web No Cifrado)",
    443: "HTTPS (Tráfico Web Cifrado SSL/TLS)",
    3306: "MySQL Database",
    8080: "HTTP Alternate / Panel Admin",
    3389: "RDP (Remote Desktop Protocol)",
    5432: "PostgreSQL Database",
    6379: "Redis Database",
    27017: "MongoDB Database",
    21: "FTP (File Transfer Protocol)",
    25: "SMTP (Email Server)",
    53: "DNS (Domain Name System)",
}

# Rangos de IP privada — NUNCA escanear
PRIVATE_RANGES = [
    r"^10\.", r"^172\.(1[6-9]|2\d|3[01])\.", r"^192\.168\.",
    r"^127\.", r"^0\.", r"^169\.254\.", r"^224\.",
    r"^240\.", r"^255\.", r"^100\.64\.",
]

def is_public_ip(ip: str) -> bool:
    """Valida que la IP sea pública. Bloquea IPs privadas/internas."""
    if not ip or not re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", ip):
        return False
    return not any(re.match(r, ip) for r in PRIVATE_RANGES)

def run(cmd, timeout=30):
    """Ejecuta un comando y devuelve stdout."""
    try:
        return subprocess.run(cmd, text=True, capture_output=True, timeout=timeout).stdout
    except subprocess.TimeoutExpired:
        return f"[TIMEOUT after {timeout}s]"
    except Exception as e:
        return f"[ERROR: {e}]"

def tool(name):
    """Verifica si una herramienta está instalada."""
    return shutil.which(name) is not None

def scan_with_nmap(ip: str, ports: list, profile: str = "quick") -> list:
    """Escaneo real con nmap. Devuelve lista de resultados por puerto."""
    if not tool("nmap"):
        return []

    port_list = ",".join(str(p) for p in ports)

    # NO usar --open: necesitamos ver TODOS los puertos (open/closed/filtered)
    args = ["-Pn", "-p", port_list]
    if profile == "standard":
        args.extend(["-sV", "--version-intensity", "3"])

    out = run(["nmap"] + args + [ip], timeout=120)

    results = []
    found_ports = set()

    for line in out.splitlines():
        # Parse: "22/tcp   open  ssh     OpenSSH 8.9p1"
        # Also: "80/tcp  closed  http"
        # Also: "443/tcp filtered  https"
        match = re.match(
            r"(\d+)/tcp\s+(open|closed|filtered)\s+(\S+)(?:\s+(.*))?", line
        )
        if match:
            port = int(match.group(1))
            state = match.group(2)
            service = match.group(3)
            version = match.group(4).strip() if match.group(4) else ""
            found_ports.add(port)
            results.append({
                "port": port,
                "state": state,
                "service": service,
                "version": version,
                "banner": version if version else None,
            })

    # Puertos no mencionados por nmap = filtered (no responde)
    for p in ports:
        if p not in found_ports:
            results.append({
                "port": p,
                "state": "filtered",
                "service": CRITICAL_PORTS.get(p, f"Port {p}"),
                "version": "",
                "banner": None,
            })

    return results

def check_local_firewall() -> dict:
    """Información del firewall local (solo informativa, no afecta escaneo remoto)."""
    fw = {}
    if tool("ufw"):
        status = run(["ufw", "status"], timeout=10)
        fw["ufw"] = status.strip() if status else "not available"
    if tool("iptables"):
        rules = run(["iptables", "-L", "-n", "--line-numbers"], timeout=10)
        fw["iptables"] = rules.strip() if rules else "not available"
    if tool("firewall-cmd"):
        rules = run(["firewall-cmd", "--list-all"], timeout=10)
        fw["firewalld"] = rules.strip() if rules else "not available"
    return fw

def check_local_listening_ports(ports: list) -> dict:
    """Qué puertos escucha LOCALMENTE este servidor (informativo)."""
    listening = {}
    if tool("ss"):
        out = run(["ss", "-tulpn"], timeout=10)
        for p in ports:
            for line in out.splitlines():
                if f":{p} " in line or line.rstrip().endswith(f":{p}"):
                    listening[p] = line.strip()
                    break
    return listening

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Uso: python3 port_audit.py <IP> [--profile quick|standard]"}))
        sys.exit(1)

    target = sys.argv[1]
    profile = "quick"
    if "--profile" in sys.argv:
        idx = sys.argv.index("--profile")
        if idx + 1 < len(sys.argv):
            profile = sys.argv[idx + 1]

    # Seguridad: rechazar IPs privadas
    if not is_public_ip(target):
        print(json.dumps({
            "error": f"IP no válida o privada: {target}. Solo se permiten IPs públicas.",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }))
        sys.exit(1)

    ports_to_scan = list(CRITICAL_PORTS.keys())

    # Escaneo real con nmap
    port_results = scan_with_nmap(target, ports_to_scan, profile)

    # Info local (solo informativa)
    firewall_info = check_local_firewall()
    local_listening = check_local_listening_ports(ports_to_scan)

    # Resumen
    open_ports = [p for p in port_results if p["state"] == "open"]
    closed_ports = [p for p in port_results if p["state"] == "closed"]
    filtered_ports = [p for p in port_results if p["state"] == "filtered"]
    unknown_ports = [p for p in port_results if p["state"] == "unknown"]

    report = {
        "target": target,
        "timestamp": datetime.now(tz=__import__('datetime').timezone.utc).isoformat(),
        "scan_profile": profile,
        "tool": "nmap" if tool("nmap") else "none",
        "summary": {
            "total_ports": len(port_results),
            "open": len(open_ports),
            "closed": len(closed_ports),
            "filtered": len(filtered_ports),
            "unknown": len(unknown_ports),
        },
        "ports": port_results,
        "local_firewall": firewall_info,
        "local_listening_ports": local_listening,
    }

    # Output JSON para el servidor
    print(json.dumps(report, indent=2))

    # Guardar reporte
    report_path = Path("/tmp/port_audit_report.json")
    report_path.write_text(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
