#!/usr/bin/env python3
"""CLI test: verifica que el servidor responde y detecta puertos correctamente."""

import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:3000"

def req(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
    except Exception as e:
        return 0, {"error": str(e)}

def test_scan(ip):
    print(f"\n{'='*60}")
    print(f"  TEST: Escaneo de {ip}")
    print(f"{'='*60}")

    # 1. Health check
    print("\n[1/3] Verificando servidor...")
    status, data = req("POST", "/api/scan", {"targetIp": ip, "email": "miguel@dev.com"})
    if status == 0:
        print(f"  ERROR: No se puede conectar a {BASE}")
        print(f"  Ejecuta: npm run dev")
        return False
    print(f"  Status HTTP: {status}")

    if status != 200:
        print(f"  ERROR: {data.get('error', data)}")
        return False

    # 2. Validate response structure
    print("\n[2/3] Validando respuesta...")
    required = ["ip", "score", "ports", "reputation", "analysisText", "scanSource"]
    missing = [k for k in required if k not in data]
    if missing:
        print(f"  ERROR: Faltan campos: {missing}")
        return False
    print(f"  IP: {data['ip']}")
    print(f"  Score: {data['score']}")
    print(f"  Fuente: {data['scanSource']}")
    print(f"  Reputacion: {len(data['reputation'])} checks")

    # 3. Port analysis
    print("\n[3/3] Puertos detectados:")
    ports = data["ports"]
    open_ports = [p for p in ports if p.get("status") == "open"]
    closed_ports = [p for p in ports if p.get("status") == "closed"]
    unknown_ports = [p for p in ports if p.get("status") == "unknown"]

    print(f"  Total: {len(ports)} | Abiertos: {len(open_ports)} | Cerrados: {len(closed_ports)} | Desconocidos: {len(unknown_ports)}")

    if open_ports:
        print("\n  PUERTOS ABIERTOS:")
        for p in open_ports:
            print(f"    - {p['port']}/{p.get('protocol','tcp')} ({p.get('service','?')})")

    if unknown_ports:
        print("\n  PUERTOS SIN ESCANEAR:")
        for p in unknown_ports:
            print(f"    - {p['port']} (status: unknown)")

    # 4. Analysis text
    analysis = data.get("analysisText", "")
    if analysis:
        print(f"\n  Analisis: {analysis[:120]}...")
    else:
        print("\n  WARNING: analysisText vacio!")

    print(f"\n{'='*60}")
    print(f"  RESULTADO: OK ({len(open_ports)} abiertos, {len(ports)} total)")
    print(f"{'='*60}")
    return True

if __name__ == "__main__":
    ip = sys.argv[1] if len(sys.argv) > 1 else "1.146.112.212"
    ok = test_scan(ip)
    sys.exit(0 if ok else 1)
