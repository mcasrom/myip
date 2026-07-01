import re, shutil, datetime, sys

FILE = "server.ts"
backup = f"server.ts.bak.{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy(FILE, backup)
print(f"Backup creado: {backup}")

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

def apply(anchor, replacement, expected_count=1, label=""):
    global content
    count = content.count(anchor)
    if count != expected_count:
        print(f"ABORTADO en '{label}': se esperaba {expected_count} ocurrencia(s) del ancla, se encontraron {count}.")
        print("No se ha modificado nada. Revisa el ancla manualmente.")
        sys.exit(1)
    content = content.replace(anchor, replacement, 1)
    print(f"OK: {label}")

# 1. Imports: cookie-parser + capa db.ts
anchor1 = "import { createHash } from 'crypto';\n\ndotenv.config();"
repl1 = (
    "import { createHash } from 'crypto';\n"
    "import cookieParser from 'cookie-parser';\n"
    "import * as authDb from './db';\n"
    "dotenv.config();"
)
apply(anchor1, repl1, 1, "imports (cookie-parser + db.ts)")

# 2. cookieParser middleware
anchor2 = "app.use(express.json());"
repl2 = "app.use(express.json());\napp.use(cookieParser());"
apply(anchor2, repl2, 1, "cookieParser middleware")

# 3. DbUser interface + hidratacion desde SQLite
anchor3 = (
    "interface DbUser {\n"
    "  email: string; isPremium: boolean; ipAddress: string;\n"
    "  lastScanTime?: number; scanCount: number;\n"
    "  verified: boolean; isGuest?: boolean; premiumCode?: string;\n"
    "}\n"
    "const usersDb: Record<string, DbUser> = {};"
)
repl3 = (
    "interface DbUser {\n"
    "  email: string; isPremium: boolean; ipAddress: string;\n"
    "  lastScanTime?: number; scanCount: number;\n"
    "  verified: boolean; isGuest?: boolean; premiumCode?: string;\n"
    "}\n"
    "const usersDb: Record<string, DbUser> = {};\n"
    "// Hidratar cache en memoria desde SQLite al arrancar (sobrevive a reinicios)\n"
    "for (const u of authDb.getAllUsers()) {\n"
    "  usersDb[u.email] = {\n"
    "    email: u.email, isPremium: u.isPremium, ipAddress: u.ipAddress,\n"
    "    lastScanTime: u.lastScanTime, scanCount: u.scanCount,\n"
    "    verified: u.verified, isGuest: u.isGuest, premiumCode: u.premiumCode\n"
    "  };\n"
    "}\n"
    "console.log(`[DB] ${authDb.getAllUsers().length} usuario(s) cargado(s) desde SQLite.`);\n"
    "// Middleware de sesion: lee cookie, resuelve usuario real (no confia en el body)\n"
    "function optionalAuth(req: any, res: any, next: any) {\n"
    "  const token = req.cookies?.myip_session;\n"
    "  if (token) {\n"
    "    const su = authDb.getSessionUser(token);\n"
    "    if (su) req.authUser = su.email;\n"
    "  }\n"
    "  next();\n"
    "}\n"
    "function requireAuth(req: any, res: any, next: any) {\n"
    "  const token = req.cookies?.myip_session;\n"
    "  const su = token ? authDb.getSessionUser(token) : undefined;\n"
    "  if (!su) return res.status(401).json({ error: 'No autenticado. Inicia sesion.' });\n"
    "  req.authUser = su.email;\n"
    "  next();\n"
    "}"
)
apply(anchor3, repl3, 1, "DbUser + hidratacion + middleware de sesion")

# 4. Endpoint de registro: ahora exige password real (bcrypt) + nuevo /login y /logout
start_marker = "// Auth: Registro honesto"
end_marker = "// Acceso invitado"
start_idx4 = content.find(start_marker)
end_idx4 = content.find(end_marker)
if start_idx4 == -1 or end_idx4 == -1:
    print("ABORTADO: no se encontraron los marcadores del bloque de registro.")
    sys.exit(1)
anchor4 = content[start_idx4:end_idx4]
repl4 = (
    "// Auth: Registro real con contrasena (bcrypt). Rechaza si el email ya tiene cuenta.\n"
    "app.post('/api/auth/register', async (req, res) => {\n"
    "  const { email, password, clientIp } = req.body;\n"
    "  if (!email || !email.includes('@')) {\n"
    "    return res.status(400).json({ error: 'Por favor, proporciona un correo electrónico válido.' });\n"
    "  }\n"
    "  if (!password || typeof password !== 'string' || password.length < 8) {\n"
    "    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });\n"
    "  }\n"
    "  const normalizedEmail = email.toLowerCase().trim();\n"
    "  if (authDb.getUserByEmail(normalizedEmail)) {\n"
    "    return res.status(409).json({ error: 'Ya existe una cuenta con ese email. Inicia sesion en su lugar.' });\n"
    "  }\n"
    "  const stored = await authDb.createUserWithPassword(normalizedEmail, password, clientIp || 'pending');\n"
    "  usersDb[normalizedEmail] = {\n"
    "    email: stored.email, isPremium: stored.isPremium, ipAddress: stored.ipAddress,\n"
    "    scanCount: stored.scanCount, verified: stored.verified, isGuest: stored.isGuest\n"
    "  };\n"
    "  const token = authDb.createSession(normalizedEmail);\n"
    "  res.cookie('myip_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });\n"
    "  console.log(`[AUTH] Nueva cuenta: ${normalizedEmail}`);\n"
    "  res.json({\n"
    "    message: 'Cuenta creada. Tus escaneos se guardarán en esta cuenta.',\n"
    "    user: { email: stored.email, isPremium: stored.isPremium, ipAddress: stored.ipAddress, scanCount: stored.scanCount, isGuest: stored.isGuest }\n"
    "  });\n"
    "});\n"
    "// Auth: Login real, verifica contrasena con bcrypt\n"
    "app.post('/api/auth/login', async (req, res) => {\n"
    "  const { email, password } = req.body;\n"
    "  if (!email || !password) {\n"
    "    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });\n"
    "  }\n"
    "  const normalizedEmail = email.toLowerCase().trim();\n"
    "  const ok = await authDb.verifyPassword(normalizedEmail, password);\n"
    "  if (!ok) {\n"
    "    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });\n"
    "  }\n"
    "  const stored = authDb.getUserByEmail(normalizedEmail)!;\n"
    "  const token = authDb.createSession(normalizedEmail);\n"
    "  res.cookie('myip_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });\n"
    "  console.log(`[AUTH] Login: ${normalizedEmail}`);\n"
    "  res.json({\n"
    "    message: 'Bienvenido de vuelta.',\n"
    "    user: { email: stored.email, isPremium: stored.isPremium, ipAddress: stored.ipAddress, scanCount: stored.scanCount, isGuest: stored.isGuest }\n"
    "  });\n"
    "});\n"
    "// Auth: Logout, borra la sesion de la BD (no solo la cookie)\n"
    "app.post('/api/auth/logout', (req, res) => {\n"
    "  const token = req.cookies?.myip_session;\n"
    "  if (token) authDb.deleteSession(token);\n"
    "  res.clearCookie('myip_session');\n"
    "  res.json({ message: 'Sesion cerrada.' });\n"
    "});\n\n"
)
apply(anchor4, repl4, 1, "register + login + logout")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("\nTodo aplicado correctamente. Revisa el diff con: git diff server.ts")
