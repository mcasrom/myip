#!/usr/bin/env python3
"""
Extrae el bloque de alertas recurrentes (compareScans + cron.schedule) de
server.ts hacia alerts.ts. sendEmail() original se deja intacta en server.ts
(se usa tambien en la ruta de reporte, linea ~1084).

Version 2: anchors ASCII-safe (evita el em-dash del comentario original,
que se corrompia al copiar/pegar entre encodings).
"""
import shutil
import sys
from datetime import datetime
from pathlib import Path

TARGET = Path.home() / "myip" / "server.ts"

START_ANCHOR = "// ============================================================================\n// ALERTAS RECURRENTES"
END_ANCHOR = "console.error(`[CRON] Error procesando ${u.email}:`, e);\n    }\n  }\n});"

REMOVAL_COMMENT = "// [Extraido a alerts.ts: compareScans() + cron de alertas recurrentes -> startAlertsCron()]"

IMPORT_ANCHOR = "import * as authDb from './db';\n"
IMPORT_INSERT = "import * as authDb from './db';\nimport { startAlertsCron } from './alerts';\n"

CRON_IMPORT_LINE = "import cron from 'node-cron';\n"

LISTEN_ANCHOR = "  app.listen(PORT, '0.0.0.0', () => {\n    console.log(`MyIP server running on http://0.0.0.0:${PORT}`);\n  });"
LISTEN_INSERT = "  app.listen(PORT, '0.0.0.0', () => {\n    console.log(`MyIP server running on http://0.0.0.0:${PORT}`);\n    startAlertsCron(PORT);\n  });"


def check_unique(content, needle, label):
    n = content.count(needle)
    if n == 0:
        print(f"ERROR: anchor '{label}' no encontrado.")
        sys.exit(1)
    if n > 1:
        print(f"ERROR: anchor '{label}' aparece {n} veces, no es unico.")
        sys.exit(1)


def main():
    if not TARGET.exists():
        print(f"ERROR: no existe {TARGET}")
        sys.exit(1)

    content = TARGET.read_text(encoding="utf-8")

    if "[Extraido a alerts.ts" in content:
        print("El patch ya parece estar aplicado. No se hace nada.")
        sys.exit(0)

    check_unique(content, START_ANCHOR, "inicio bloque ALERTAS RECURRENTES")
    check_unique(content, END_ANCHOR, "fin bloque cron (catch + cierre)")
    check_unique(content, IMPORT_ANCHOR, "import authDb")
    check_unique(content, CRON_IMPORT_LINE, "import node-cron")
    check_unique(content, LISTEN_ANCHOR, "app.listen callback")

    start_idx = content.find(START_ANCHOR)
    end_idx = content.find(END_ANCHOR) + len(END_ANCHOR)

    if end_idx <= start_idx:
        print("ERROR: el anchor de fin aparece antes que el de inicio. Abortando.")
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = TARGET.with_name(f"server.ts.bak.{timestamp}")
    shutil.copy2(TARGET, backup_path)
    print(f"Backup creado: {backup_path}")

    new_content = content[:start_idx] + REMOVAL_COMMENT + content[end_idx:]
    new_content = new_content.replace(CRON_IMPORT_LINE, "", 1)
    new_content = new_content.replace(IMPORT_ANCHOR, IMPORT_INSERT, 1)
    new_content = new_content.replace(LISTEN_ANCHOR, LISTEN_INSERT, 1)

    TARGET.write_text(new_content, encoding="utf-8")
    print(f"Patch aplicado en {TARGET}")
    print("Siguiente paso: npx tsc --noEmit")


if __name__ == "__main__":
    main()
