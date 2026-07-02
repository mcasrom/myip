import shutil
from datetime import datetime

FILE = "alerts.ts"
OLD = "cron.schedule('*/2 * * * *', async () => {"
NEW = "cron.schedule('0 8 * * *', async () => {"

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
print("OK: cron -> '0 8 * * *'")
