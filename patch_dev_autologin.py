import shutil
from datetime import datetime

FILE = "src/App.tsx"
OLD = """    if (import.meta.env.DEV) {
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'miguel@dev.com' })
      })
      .then(r => r.json())
      .then(data => {
        if (data.user?.isPremium) {
          setUser(data.user);
          localStorage.setItem('myip_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {});
    }"""

NEW = """    if (import.meta.env.DEV) {
      const DEV_EMAIL = 'miguel@dev.com';
      const DEV_PASSWORD = 'DevPass2026!';
      const applyUser = (data: any) => {
        if (data.user?.isPremium) {
          setUser(data.user);
          localStorage.setItem('myip_user', JSON.stringify(data.user));
        }
      };
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD })
      })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(applyUser)
      .catch(() => {
        fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD })
        })
        .then(r => r.json())
        .then(applyUser)
        .catch(() => {});
      });
    }"""

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
print("OK: auto-login dev arreglado")
