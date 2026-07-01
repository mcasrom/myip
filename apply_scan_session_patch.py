import shutil, datetime, sys

FILE = "server.ts"
backup = f"{FILE}.bak.{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy(FILE, backup)
print(f"Backup creado: {backup}")

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "app.post('/api/scan', async (req, res) => {"
end_marker = "  const isPremium = user?.isPremium ?? false;"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("ABORTADO: no se encontraron los marcadores del bloque /api/scan.")
    sys.exit(1)

old_block = content[start_idx:end_idx]
print("--- BLOQUE A REEMPLAZAR (repr) ---")
print(repr(old_block))

new_block = (
    "app.post('/api/scan', optionalAuth, async (req: any, res) => {\n"
    "  const { targetIp, email } = req.body;\n"
    "  if (!targetIp || typeof targetIp !== 'string' || !targetIp.trim()) {\n"
    "    return res.status(400).json({ error: 'Se requiere targetIp. El cliente debe detectar su IP pública y enviarla.' });\n"
    "  }\n"
    "  const ip = targetIp.trim();\n"
    "  if (!isPublicIp(ip)) {\n"
    "    return res.status(400).json({ error: `No se permite escanear IPs privadas o internas (${ip}). Solo IPs públicas.` });\n"
    "  }\n"
    "  let user: DbUser | undefined;\n"
    "  // Prioridad: sesion real (cookie verificada) sobre el email que mande el cliente en el body\n"
    "  if (req.authUser) {\n"
    "    const u = usersDb[req.authUser];\n"
    "    if (u) user = u;\n"
    "  } else if (email) {\n"
    "    const u = usersDb[email.toLowerCase().trim()];\n"
    "    if (u) user = u;\n"
    "  }\n"
)

content = content[:start_idx] + new_block + content[end_idx:]
with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("\nOK: /api/scan ahora usa la sesion real (optionalAuth) en vez de fiarse solo del body.")
print("Revisa el diff con: git diff server.ts")
