#!/usr/bin/env python3
"""
auditoria_myip.py — Panel de estadísticas de producción
Lanza consultas SQLite remotas vía SSH y muestra resultados.
No requiere acceso directo a la BD, solo SSH.
"""

import subprocess
import sys

# ── Configuración ─────────────────────────────────────────────────────────────
SSH_USER = "deploy"
SSH_HOST = "178.105.80.193"
DB_PATH = "/home/deploy/myip/data/myip.sqlite3"
# ──────────────────────────────────────────────────────────────────────────────


def ssh_run(cmd: str) -> str:
    """Ejecuta un comando remoto vía SSH y devuelve stdout."""
    # Escapar comillas simples para uso dentro de comillas simples SSH
    escaped = cmd.replace("'", "'\"'\"'")
    full = f"ssh {SSH_USER}@{SSH_HOST} 'sudo sqlite3 {DB_PATH} \"{escaped}\"'"
    result = subprocess.run(full, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr.strip()}")
        return ""
    return result.stdout.strip()


def separator(char="─", width=60):
    print(char * width)


def section(title: str):
    print()
    separator()
    print(f"  {title}")
    separator()


def main():
    print()
    print("  ╔══════════════════════════════════════╗")
    print("  ║   MYIP — Auditoría de Producción     ║")
    print("  ╚══════════════════════════════════════╝")

    # ── Usuarios ──────────────────────────────────────────────────────────
    section("USUARIOS REGISTRADOS")
    total = ssh_run("SELECT COUNT(*) FROM users;")
    print(f"  Total: {total}")
    print()
    rows = ssh_run("SELECT email, created_at FROM users ORDER BY created_at DESC;")
    if rows:
        print(f"  {'Email':<45} {'Fecha':<12}")
        print(f"  {'─'*45} {'─'*12}")
        for line in rows.split("\n"):
            parts = line.split("|")
            if len(parts) == 2:
                email, ts = parts[0], parts[1]
                # Convertir timestamp ms a fecha legible
                try:
                    from datetime import datetime
                    fecha = datetime.fromtimestamp(int(ts) / 1000).strftime("%d/%m/%Y")
                except Exception:
                    fecha = ts
                print(f"  {email:<45} {fecha:<12}")

    # ── Escaneos ──────────────────────────────────────────────────────────
    section("ESCANEOS")
    total_scans = ssh_run("SELECT COUNT(*) FROM scan_history;")
    ips_unicas = ssh_run("SELECT COUNT(DISTINCT target_ip) FROM scan_history;")
    print(f"  Total escaneos: {total_scans}")
    print(f"  IPs únicas:     {ips_unicas}")

    # ── Top IPs ───────────────────────────────────────────────────────────
    section("TOP 10 IPs MÁS ESCANEADAS")
    rows = ssh_run(
        "SELECT target_ip, COUNT(*) as veces FROM scan_history "
        "GROUP BY target_ip ORDER BY veces DESC LIMIT 10;"
    )
    if rows:
        print(f"  {'IP':<20} {'Veces':<8}")
        print(f"  {'─'*20} {'─'*8}")
        for line in rows.split("\n"):
            parts = line.split("|")
            if len(parts) == 2:
                print(f"  {parts[0]:<20} {parts[1]:<8}")

    # ── Scans por día ─────────────────────────────────────────────────────
    section("ESCANEOS POR DÍA (últimos 14 días)")
    rows = ssh_run(
        "SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') as dia, COUNT(*) as scans "
        "FROM scan_history GROUP BY dia ORDER BY dia DESC LIMIT 14;"
    )
    if rows:
        print(f"  {'Día':<14} {'Scans':<8}")
        print(f"  {'─'*14} {'─'*8}")
        for line in rows.split("\n"):
            parts = line.split("|")
            if len(parts) == 2:
                print(f"  {parts[0]:<14} {parts[1]:<8}")

    # ── Usuarios premium ──────────────────────────────────────────────────
    section("USUARIOS PREMIUM")
    premium = ssh_run("SELECT COUNT(*) FROM users WHERE is_premium = 1;")
    print(f"  Premium: {premium}")
    if premium and int(premium) > 0:
        rows = ssh_run("SELECT email, tier, premium_code, premium_expires_at FROM users WHERE is_premium = 1;")
        if rows:
            print(f"  {'Email':<35} {'Tipo':<15} {'Código':<25} {'Expira':<12}")
            print(f"  {'─'*35} {'─'*15} {'─'*25} {'─'*12}")
            for line in rows.split("\n"):
                parts = line.split("|")
                if len(parts) >= 4:
                    email, tier, code, exp_ts = parts[0], parts[1], parts[2], parts[3]
                    try:
                        from datetime import datetime
                        fecha = datetime.fromtimestamp(int(exp_ts) / 1000).strftime("%d/%m/%Y") if exp_ts else 'N/A'
                    except Exception:
                        fecha = exp_ts or 'N/A'
                    print(f"  {email:<35} {tier or 'N/A':<15} {code or 'N/A':<25} {fecha:<12}")

    # ── Códigos Premium ───────────────────────────────────────────────────
    section("CÓDIGOS PREMIUM GENERADOS")
    codes = ssh_run("SELECT code, label, max_uses, current_uses, expires_at FROM premium_codes ORDER BY created_at DESC;")
    if codes:
        print(f"  {'Código':<28} {'Label':<12} {'Usos':<10} {'Expira':<12} {'Estado':<10}")
        print(f"  {'─'*28} {'─'*12} {'─'*10} {'─'*12} {'─'*10}")
        for line in codes.split("\n"):
            parts = line.split("|")
            if len(parts) >= 5:
                code, label, max_u, cur_u, exp_ts = parts[0], parts[1], parts[2], parts[3], parts[4]
                try:
                    from datetime import datetime
                    fecha = datetime.fromtimestamp(int(exp_ts) / 1000).strftime("%d/%m/%Y")
                    estado = "Activo" if int(cur_u) < int(max_u) and int(exp_ts) > int(datetime.now().timestamp() * 1000) else "Agotado/Expirado"
                except Exception:
                    fecha = exp_ts
                    estado = "N/A"
                print(f"  {code:<28} {label:<12} {cur_u}/{max_u:<10} {fecha:<12} {estado:<10}")
    else:
        print("  No hay códigos generados.")

    # ── Emails enviados ───────────────────────────────────────────────────
    section("EMAILS ENVIADOS")
    total_emails = ssh_run("SELECT COALESCE(SUM(monthly_scan_count), 0) FROM users;")
    print(f"  Total scans mensuales activos: {total_emails or 0}")

    print()
    separator()
    print("  Fin del reporte.")
    separator()
    print()


if __name__ == "__main__":
    main()
