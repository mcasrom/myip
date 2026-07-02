import shutil
from datetime import datetime

FILE = "server.ts"
OLD = "res.json({ message: sent ? `Reporte enviado a ${email}.` : `Reporte generado. Configura SMTP.`, sentAt: new Date().toISOString() });"
NEW = "res.json({ message: sent ? `Reporte enviado a ${email}.` : `Reporte generado, pero no se pudo enviar el email. Inténtalo de nuevo más tarde.`, sentAt: new Date().toISOString() });"

backup = f"{FILE}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy(FILE, backup)
print(f"Backup: {backup}")

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()
count = content.count(OLD)
if count != 1:
    print(f"ERROR: {count} ocurrencias, se esperaba 1. Abortando.")
    exit(1)
content = content.replace(OLD, NEW)
with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)
print("OK: mensaje SMTP corregido")
