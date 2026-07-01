#!/usr/bin/env python3
import shutil
import sys
from datetime import datetime
from pathlib import Path

TARGET = Path.home() / "myip" / "server.ts"

ANCHOR = """        if (hasChanges) {
          await sendEmail({
            to: u.email,
            subject: 'MyIP: Cambios detectados en tu red',
            text: changes.join('\\n'),
            html: `<h2>Cambios detectados en tu IP ${curr.targetIp}</h2><ul>${changes.map(c => `<li>${c}</li>`).join('')}</ul>`,
          });
          console.log(`[CRON] Alerta enviada a ${u.email}: ${changes.length} cambio(s)`);
        } else {"""

REPLACEMENT = """        if (hasChanges) {
          const emailSent = await sendEmail({
            to: u.email,
            subject: 'MyIP: Cambios detectados en tu red',
            text: changes.join('\\n'),
            html: `<h2>Cambios detectados en tu IP ${curr.targetIp}</h2><ul>${changes.map(c => `<li>${c}</li>`).join('')}</ul>`,
          });
          if (emailSent) {
            console.log(`[CRON] Alerta enviada a ${u.email}: ${changes.length} cambio(s)`);
          } else {
            console.error(`[CRON] FALLO al enviar alerta a ${u.email} (${changes.length} cambio(s) detectados pero el email no se entrego)`);
          }
        } else {"""


def main():
    if not TARGET.exists():
        print(f"ERROR: no existe {TARGET}")
        sys.exit(1)
    content = TARGET.read_text(encoding="utf-8")
    occurrences = content.count(ANCHOR)
    if occurrences == 0:
        print("ERROR: anchor no encontrado.")
        sys.exit(1)
    if occurrences > 1:
        print(f"ERROR: anchor aparece {occurrences} veces, no es unico.")
        sys.exit(1)
    if "FALLO al enviar alerta" in content:
        print("El patch ya parece estar aplicado.")
        sys.exit(0)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = TARGET.with_name(f"server.ts.bak.{timestamp}")
    shutil.copy2(TARGET, backup_path)
    print(f"Backup creado: {backup_path}")
    new_content = content.replace(ANCHOR, REPLACEMENT, 1)
    TARGET.write_text(new_content, encoding="utf-8")
    print(f"Patch aplicado en {TARGET}")


if __name__ == "__main__":
    main()
