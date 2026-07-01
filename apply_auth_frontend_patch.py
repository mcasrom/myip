import shutil, datetime, sys

FILE = "src/components/AuthSection.tsx"
backup = f"{FILE}.bak.{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy(FILE, backup)
print(f"Backup creado: {backup}")

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

def apply(anchor, replacement, expected_count=1, label=""):
    global content
    count = content.count(anchor)
    if count != expected_count:
        print(f"ABORTADO en '{label}': se esperaba {expected_count} ocurrencia(s), se encontraron {count}.")
        sys.exit(1)
    content = content.replace(anchor, replacement, 1)
    print(f"OK: {label}")

# 1. Estado: añadir password y modo login/registro
old1 = "  const [email, setEmail] = useState('');\n  const [loading, setLoading] = useState(false);"
new1 = (
    "  const [email, setEmail] = useState('');\n"
    "  const [password, setPassword] = useState('');\n"
    "  const [mode, setMode] = useState<'register' | 'login'>('register');\n"
    "  const [loading, setLoading] = useState(false);"
)
apply(old1, new1, 1, "estado (password + modo)")

# 2. Reescribir handleRegister para enviar password, y anadir handleLogin
start_marker = "  // Registro honesto: solo email, sin falsa verificación"
end_marker = "  // Acceso invitado: inmediato, sin datos personales"
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)
if start_idx == -1 or end_idx == -1:
    print("ABORTADO: no se encontraron los marcadores del bloque handleRegister.")
    sys.exit(1)
old2 = content[start_idx:end_idx]

new2 = (
    "  // Registro real con contraseña (minimo 8 caracteres)\n"
    "  const handleRegister = async (e: React.FormEvent) => {\n"
    "    e.preventDefault();\n"
    "    if (!email || !email.includes('@')) {\n"
    "      setError('Introduce un correo electrónico válido.');\n"
    "      return;\n"
    "    }\n"
    "    if (!password || password.length < 8) {\n"
    "      setError('La contraseña debe tener al menos 8 caracteres.');\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    setLoading(true);\n"
    "    setError(null);\n"
    "    setSuccessMsg(null);\n"
    "\n"
    "    try {\n"
    "      const res = await fetch('/api/auth/register', {\n"
    "        method: 'POST',\n"
    "        headers: { 'Content-Type': 'application/json' },\n"
    "        credentials: 'include',\n"
    "        body: JSON.stringify({ email, password })\n"
    "      });\n"
    "\n"
    "      const data = await res.json();\n"
    "      if (!res.ok) {\n"
    "        throw new Error(data.error || 'Error al registrar.');\n"
    "      }\n"
    "\n"
    "      onLoginSuccess(data.user);\n"
    "      setSuccessMsg(`Cuenta creada con ${email}. Tus escaneos se guardarán en esta cuenta.`);\n"
    "    } catch (err: any) {\n"
    "      setError(err.message || 'Error al conectar con el servidor.');\n"
    "    } finally {\n"
    "      setLoading(false);\n"
    "    }\n"
    "  };\n"
    "\n"
    "  // Login real: verifica contraseña contra el backend\n"
    "  const handleLogin = async (e: React.FormEvent) => {\n"
    "    e.preventDefault();\n"
    "    if (!email || !password) {\n"
    "      setError('Introduce email y contraseña.');\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    setLoading(true);\n"
    "    setError(null);\n"
    "    setSuccessMsg(null);\n"
    "\n"
    "    try {\n"
    "      const res = await fetch('/api/auth/login', {\n"
    "        method: 'POST',\n"
    "        headers: { 'Content-Type': 'application/json' },\n"
    "        credentials: 'include',\n"
    "        body: JSON.stringify({ email, password })\n"
    "      });\n"
    "\n"
    "      const data = await res.json();\n"
    "      if (!res.ok) {\n"
    "        throw new Error(data.error || 'Error al iniciar sesión.');\n"
    "      }\n"
    "\n"
    "      onLoginSuccess(data.user);\n"
    "    } catch (err: any) {\n"
    "      setError(err.message || 'Error al conectar con el servidor.');\n"
    "    } finally {\n"
    "      setLoading(false);\n"
    "    }\n"
    "  };\n"
    "\n"
)
content = content[:start_idx] + new2 + content[end_idx:]
print("OK: handleRegister real + handleLogin nuevo")

# 3. Actualizar el formulario: anadir input de password, toggle login/registro, quitar mensaje "sin verificacion"
old3 = (
    "              {/* Opción 2: Registro con email (solo para historial) */}\n"
    "              <form onSubmit={handleRegister} className=\"space-y-4\">\n"
    "                <div className=\"space-y-1.5\">\n"
    "                  <label className=\"text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold\">\n"
    "                    Guardar Historial con tu Email\n"
    "                  </label>\n"
    "                  <div className=\"relative\">\n"
    "                    <input\n"
    "                      type=\"email\"\n"
    "                      required\n"
    "                      placeholder=\"ejemplo@correo.com\"\n"
    "                      value={email}\n"
    "                      onChange={(e) => setEmail(e.target.value)}\n"
    "                      className=\"w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500\"\n"
    "                    />\n"
    "                    <Mail className=\"absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400\" />\n"
    "                  </div>\n"
    "                  <p className=\"text-[10px] text-slate-450 italic\">\n"
    "                    * Sin verificación. Sin contraseñas. Solo para vincular tus escaneos a esta cuenta.\n"
    "                  </p>\n"
    "                </div>\n"
    "\n"
    "                <button\n"
    "                  type=\"submit\"\n"
    "                  disabled={loading}\n"
    "                  className=\"w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm\"\n"
    "                >\n"
    "                  {loading ? (\n"
    "                    <RefreshCw className=\"w-4 h-4 animate-spin\" />\n"
    "                  ) : (\n"
    "                    'Crear Cuenta (Sin Verificación)'\n"
    "                  )}\n"
    "                </button>\n"
    "              </form>"
)
new3 = (
    "              {/* Opción 2: Cuenta con email + contraseña (historial persistente) */}\n"
    "              <div className=\"flex gap-2 mb-2\">\n"
    "                <button type=\"button\" onClick={() => { setMode('register'); setError(null); }}\n"
    "                  className={`flex-1 text-[10px] font-mono uppercase tracking-wider font-bold py-2 rounded-lg transition ${mode === 'register' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>\n"
    "                  Crear Cuenta\n"
    "                </button>\n"
    "                <button type=\"button\" onClick={() => { setMode('login'); setError(null); }}\n"
    "                  className={`flex-1 text-[10px] font-mono uppercase tracking-wider font-bold py-2 rounded-lg transition ${mode === 'login' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>\n"
    "                  Ya Tengo Cuenta\n"
    "                </button>\n"
    "              </div>\n"
    "              <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className=\"space-y-4\">\n"
    "                <div className=\"space-y-1.5\">\n"
    "                  <label className=\"text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold\">\n"
    "                    {mode === 'register' ? 'Guardar Historial con tu Email' : 'Inicia Sesión'}\n"
    "                  </label>\n"
    "                  <div className=\"relative\">\n"
    "                    <input\n"
    "                      type=\"email\"\n"
    "                      required\n"
    "                      placeholder=\"ejemplo@correo.com\"\n"
    "                      value={email}\n"
    "                      onChange={(e) => setEmail(e.target.value)}\n"
    "                      className=\"w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500\"\n"
    "                    />\n"
    "                    <Mail className=\"absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400\" />\n"
    "                  </div>\n"
    "                  <input\n"
    "                    type=\"password\"\n"
    "                    required\n"
    "                    minLength={8}\n"
    "                    placeholder=\"Contraseña (mínimo 8 caracteres)\"\n"
    "                    value={password}\n"
    "                    onChange={(e) => setPassword(e.target.value)}\n"
    "                    className=\"w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500\"\n"
    "                  />\n"
    "                  <p className=\"text-[10px] text-slate-450 italic\">\n"
    "                    {mode === 'register'\n"
    "                      ? '* Tu contraseña se guarda cifrada. Nunca la compartimos.'\n"
    "                      : '* Introduce tu email y contraseña para acceder a tu historial.'}\n"
    "                  </p>\n"
    "                </div>\n"
    "\n"
    "                <button\n"
    "                  type=\"submit\"\n"
    "                  disabled={loading}\n"
    "                  className=\"w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm\"\n"
    "                >\n"
    "                  {loading ? (\n"
    "                    <RefreshCw className=\"w-4 h-4 animate-spin\" />\n"
    "                  ) : mode === 'register' ? (\n"
    "                    'Crear Cuenta'\n"
    "                  ) : (\n"
    "                    'Iniciar Sesión'\n"
    "                  )}\n"
    "                </button>\n"
    "              </form>"
)
apply(old3, new3, 1, "formulario con password + toggle login/registro")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("\nTodo aplicado correctamente. Revisa el diff con: git diff src/components/AuthSection.tsx")
