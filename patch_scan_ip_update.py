#!/usr/bin/env python3
"""
Patch: sincroniza users.ip_address en cada /api/scan exitoso.
Bug: createUserWithPassword guarda 'pending' y nunca se actualiza -> el cron
de alertas recurrentes excluye siempre a los usuarios (filtro ipAddress !== 'pending').

Uso:
    python3 patch_scan_ip_update.py

Hace backup de server.ts antes de tocar nada.
"""
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

TARGET = Path.home() / "myip" / "server.ts"

ANCHOR = "  const isGuest = user?.isGuest ?? false;"

INSERT_BLOCK = """  const isGuest = user?.isGuest ?? false;

  // [PATCH ip_address sync] Actualiza la IP conocida del usuario en cada scan
  // exitoso, para que el cron de alertas recurrentes deje de excluirlo por
  // tener ip_address = 'pending'.
  if (user) {
    const resolvedEmailForIp = req.authUser || (email ? String(email).toLowerCase().trim() : undefined);
    if (resolvedEmailForIp) {
      try {
        authDb.updateUserFields(resolvedEmailForIp, { ipAddress: ip });
      } catch (e) {
        console.error('[SCAN] No se pudo actualizar ip_address:', e);
      }
    }
  }
"""


def main():
    if not TARGET.exists():
        print(f"ERROR: no existe {TARGET}")
        sys.exit(1)

    content = TARGET.read_text(encoding="utf-8")

    occurrences = content.count(ANCHOR)
    if occurrences == 0:
        print("ERROR: anchor no encontrado. El archivo pudo haber cambiado.")
        print(f"Anchor buscado: {ANCHOR!r}")
        sys.exit(1)
    if occurrences > 1:
        print(f"ERROR: anchor aparece {occurrences} veces, no es único. Abortando por seguridad.")
        sys.exit(1)

    # Ya aplicado?
    if "[PATCH ip_address sync]" in content:
        print("El patch ya parece estar aplicado (marcador encontrado). No se hace nada.")
        sys.exit(0)

    # Backup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = TARGET.with_name(f"server.ts.bak.{timestamp}")
    shutil.copy2(TARGET, backup_path)
    print(f"Backup creado: {backup_path}")

    new_content = content.replace(ANCHOR, INSERT_BLOCK.rstrip("\n"), 1)

    TARGET.write_text(new_content, encoding="utf-8")
    print(f"Patch aplicado en {TARGET}")
    print("Siguiente paso: tsc --noEmit para verificar tipos.")


if __name__ == "__main__":
    main()
