import shutil
from datetime import datetime

FILE = "server.ts"
OLD = """  // Pre-create developer accounts in authDb real (SQLite+bcrypt), premium, no rate limits
  if (process.env.NODE_ENV !== 'production') {
    const DEV_PASSWORD = 'DevPass2026!';
    const devAccounts = ['miguel@dev.com', 'test_dev@example.com'];
    for (const devEmail of devAccounts) {"""

NEW = """  // Pre-create developer accounts in authDb real (SQLite+bcrypt), premium, no rate limits
  const devAccounts = ['miguel@dev.com', 'test_dev@example.com'];
  if (process.env.NODE_ENV !== 'production') {
    const DEV_PASSWORD = 'DevPass2026!';
    for (const devEmail of devAccounts) {"""

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
print("OK: devAccounts movido fuera del if, scope correcto")
