# WAYAHEAD — myip

Registro de evolución del proyecto. Regla fija: nunca editar server.ts/tsx a mano
larga; usar scripts Python de insercion con anclas unicas verificadas via
content.count() (mismo criterio que ThreatRadar OSINT). Sincronizar
local <-> GitHub (mcasrom/myip) preservando .env, que nunca se sube.

## Estado 2026-07-01

### Stack confirmado
- Node/Express + tsx (dev) + Vite + React (frontend)
- Repo: https://github.com/mcasrom/myip.git (origin OK, verificado)
- .env correctamente en .gitignore, NO trackeado por git
- Claves en .env: APP_URL, SMTP_*, STRIPE_SECRET_KEY, GROQ_API_KEY,
  RESEND_API_KEY, GEMINI_API_KEY

### Bug raiz encontrado y arreglado: auth sin verificacion real
Sintoma original: "no me puedo registrar / no me puedo logear".
Causa real: el registro NO comprobaba contraseña (se ignoraba en el body),
no existia endpoint /api/auth/login, y usersDb vivia en memoria pura
(se perdia todo al reiniciar el server o si habia un proceso zombi duplicado
en el puerto 3000). Cualquiera podia "ser" cualquier email sin verificacion.

Fix aplicado (secuencial, backend primero, luego frontend):
1. db.ts nuevo: SQLite sincrono (better-sqlite3) + bcrypt. Tablas `users`
   (password_hash) y `sessions` (token opaco aleatorio, NO JWT, se borra al
   logout/expira solo). Cero dependencias de auth externas, cero llamadas
   a APIs para esto.
2. server.ts parcheado via apply_auth_patch.py (script Python con anclas
   extraidas dinamicamente del fichero, no escritas a mano, para evitar
   desajustes de espaciado/lineas en blanco):
   - usersDb en memoria ahora se hidrata desde SQLite al arrancar
   - middleware optionalAuth/requireAuth que lee cookie de sesion
   - POST /api/auth/register: exige password >= 8 chars, hash bcrypt,
     rechaza (409) si el email ya existe -> ya no se puede "reclamar"
     una cuenta ajena solo sabiendo el email
   - POST /api/auth/login (nuevo, no existia): verifica password con bcrypt
   - POST /api/auth/logout (nuevo): borra la sesion de la BD
3. AuthSection.tsx parcheado via apply_auth_frontend_patch.py:
   - input de password anadido (min 8 caracteres)
   - toggle "Crear Cuenta" / "Ya Tengo Cuenta" -> handleRegister / handleLogin
   - fetch con credentials: 'include' para que la cookie de sesion viaje
   - textos "Sin verificación. Sin contraseñas." eliminados (ya no aplican;
     decision tomada: password real es mas optimo que magic-link porque
     evita depender de Resend API en cada login)

Decision de diseño registrada: se descarto passwordless/magic-link porque
requeriria llamar a una API externa (Resend) en cada login, mas latencia y
dependencia de entrega de email. La solucion con bcrypt + SQLite es 100%
local, ya probada y funcionando.

### Verificado con curl (backend, antes del cambio de frontend)
- Registro con password -> 200 OK, cookie de sesion seteada
- Registro repetido mismo email -> 409 Conflict (ya no se puede duplicar/robar)
- Login con password correcta -> 200 OK, nueva cookie de sesion
- Login con password incorrecta -> 401 Unauthorized
Los 4 casos dieron el resultado esperado.

### Pendiente de verificar (siguiente paso inmediato)
- [ ] npx tsc --noEmit limpio tras el patch de frontend
- [ ] npm run dev arrancando sin errores con AuthSection.tsx nuevo
- [ ] Prueba end-to-end real desde el navegador (no solo curl): crear cuenta,
      cerrar sesion, volver a entrar con la misma contraseña
- [ ] Confirmar que /api/scan y el resto de rutas que leian usersDb[email]
      directamente del body siguen funcionando igual (no se toco esa parte)

### Bugs activos, aun sin tocar
- [ ] port_scan.py / scripts/port_scan.py sin auditar (equivalente al
      port_scanner.py de ThreatRadar, mismo tipo de bug historico)
- [ ] Rate limiting anti-fraude (ipRateLimit/fpRateLimit, server.ts) SIGUE
      en memoria pura -> mismo problema de persistencia que tenia usersDb,
      pendiente de migrar a SQLite tambien
- [ ] UpgradePanel.tsx aparecia modificado sin commitear en el primer diagnostico,
      pendiente de revisar su diff antes del proximo push

### Pendiente de auditar (no empezado)
- [ ] Legal: consentimiento antes de escanear IP objetivo (portar patron
      LegalPanel + tabla consent_log desde ThreatRadar OSINT)
- [ ] Monetizacion: STRIPE_SECRET_KEY presente en .env, sin confirmar si el
      flujo de checkout esta conectado de verdad o es placeholder
- [ ] Revisar UpgradePanel.tsx (pago premium) ahora que el login es real,
      para que "isPremium" se lea de forma consistente con la sesion nueva

### Flujo de trabajo fijado para este proyecto
1. Diagnosticar con grep/sed sobre el fichero real, nunca asumir texto de
   memoria (fallamos 2 veces por lineas en blanco no vistas -> desde ahora,
   extraer anclas dinamicamente del fichero cuando sea posible)
2. Backup automatico (.bak.TIMESTAMP) antes de cada patch, en .gitignore
3. Aplicar patch con script Python + verificacion via content.count()
4. tsc --noEmit + arranque limpio (fuser -k puerto, pkill proceso viejo)
5. Pruebas curl/manuales del flujo completo
6. Actualizar este WAYAHEAD.md
7. git add -A && git commit && git push (nunca subir .env, verificar con
   git ls-files | grep env antes de cada push)

## Sesion 2026-07-01 (continuacion)

### Verificado en navegador
- Login real funciona (entra con test_dev@example.com / Test1234!)
- PID 198594 en puerto 3000 confirmado como proceso node/tsx legitimo
  (nombre truncado "MainThrea" en lsof es normal, es el hilo principal de Node)

### Bug nuevo detectado, EN INVESTIGACION
Sintoma: tras loguearse correctamente, al intentar escanear (chequeo) la app
vuelve a pedir registro/activar premium -> friccion redundante, sesion
iniciada no se esta respetando en /api/scan.

Sospecha (a confirmar con sed -n '641,670p' server.ts):
El middleware optionalAuth/requireAuth que anadimos a db.ts/server.ts NO esta
enganchado a la ruta /api/scan. Esa ruta sigue leyendo el email solo del
body (`const { email, targetIp } = req.body`), no de req.authUser via cookie
de sesion. Si el frontend no manda el email logueado en el body de /api/scan,
el backend no reconoce al usuario ya autenticado.
Pendiente confirmar tambien si el fetch de /api/scan en el frontend usa
credentials: 'include' (sin eso la cookie de sesion ni siquiera viaja).

PROXIMO PASO: revisar sed -n '641,670p' server.ts + grep api/scan en src/
antes de tocar nada.

## Sesión 2026-07-01 (tarde) — Fix detección IP + bug crítico de reload

### Bug 1: IP detection bloqueada por Enhanced Tracking Protection (Firefox)
Sintoma: ipify.org bloqueado por CORS/ETP en el navegador, fallback a
/api/ip/detect devolvía 127.0.0.1 en local (correcto pero inútil para dev).
Fix: /api/ip/detect ahora prioriza cabecera real de proxy (cf-connecting-ip /
x-forwarded-for) y si no hay proxy (dev local), el propio servidor consulta
ipify.org (fetch server-side, sin CORS/ETP posible). trust proxy activado.

### Bug 2 (CRÍTICO): rebote a pantalla inicial tras pulsar "Analizar"
Sintoma: /api/scan devolvía NetworkError a mitad de fetch, React se
remontaba, usuario volvía al inicio del embudo sin explicación.
Causa raiz: scripts/port_audit.py escribia port_audit_report.json en la
RAIZ del repo (~/myip/). Vite en dev vigila todo el arbol del proyecto;
al detectar el archivo nuevo disparaba un full page reload, matando
cualquier fetch en curso (incluido el POST a /api/scan).
Fix: report_path movido a /tmp/port_audit_report.json (linea 195 de
scripts/port_audit.py). Archivo viejo borrado del repo, añadido a
.gitignore. Verificado: [SCAN] Response status: 200 sin reload de por medio.

### Pendiente
- [ ] Geo-lookup (ipapi.co) sigue bloqueado por CORS/ETP en el navegador -> 
      mover a server-side igual que /api/ip/detect (geo queda en N/A ahora,
      no rompe nada pero no da datos reales)
- [ ] Revisar 400 en /api/auth/register visto en consola durante pruebas
      (probablemente password de prueba < 8 caracteres, no confirmado)
- [ ] WiFi Hotspot Analyzer: audit failed (code 1), revisar dependencia nmcli

## Sesión 2026-07-01 (noche) — WiFi Hotspot Analyzer arreglado

### Bug 1: gateway UnboundLocalError (crash total, code 1)
scripts/wifi_audit.py nunca calculaba la variable `gateway` antes de usarla
en el ping de latencia. Fix: nuevo Step 4c, gateway obtenido via
`ip route show default` + regex, antes del Step 5 que lo consume.

### Bug 2: parser de iwconfig no leia Frequency/Signal/Bit Rate
El regex buscaba esos datos en la MISMA linea que "ESSID", pero iwconfig
los pone en la linea siguiente (Mode:Managed Frequency:... Signal level:...).
Fix: parseo linea por linea sin el filtro `if "ESSID" in line`, cada regex
se evalua independientemente en cada linea del output.

### Bug 3: mismatch de campo gateway vs gateway_ip
Frontend (LocalNetworkDiagnostic.tsx) esperaba `data.gateway`, Python
devolvia `gateway_ip`. Fix: alias añadido en server.ts justo antes de
devolver el JSON al frontend (data.gateway = data.gateway_ip).

### Seguridad: /api/wifi/audit bloqueado en produccion
Este endpoint ejecuta nmcli/iwconfig/ping contra la interfaz de red del
PROCESO NODE, no del navegador del usuario. En produccion (Hetzner) eso
interrogaria la red del SERVIDOR, no del cliente -> inutil + fuga de
topologia interna del servidor a cualquier usuario que llame el endpoint.
Fix: guard `if (NODE_ENV === 'production') return 403` al inicio del
handler. Esta funcion solo tiene sentido corriendo local/dev.

Verificado con curl: gateway, frequency_ghz, signal_dbm, link_speed_mbps
todos poblados correctamente tras los 3 fixes.

### Decision de producto: no integrar speedtest-cli
Se evaluo añadir test de velocidad real (descarga/subida) via speedtest-cli.
Descartado: el usuario ya usa herramientas de speedtest externas solo
cuando sospecha un problema puntual, no como parte de un chequeo rutinario.
No aporta valor diferencial al producto, añade dependencia y latencia
(15-30s) al audit. link_speed_mbps (tasa de enlace WiFi via iwconfig) se
mantiene como esta, sin pretender ser velocidad de internet real.

### Siguiente gran pieza: Alertas recurrentes (monetizable)
Analisis de mercado: escaneo puntual de puertos/reputacion ya esta resuelto
gratis en el mercado (GRC ShieldsUp, ipvoid, apps de router ISP). El valor
real y monetizable es MONITOREO CONTINUO: "avisanos si tu IP entra en una
blacklist nueva o se abre un puerto que antes estaba cerrado", sin que el
usuario tenga que acordarse de volver a comprobar. Roadmap:
- [ ] Cron periodico (diario/semanal segun plan) que re-ejecute el scan
      guardado por usuario (requiere историal de baseline por usuario)
- [ ] Comparacion diff vs ultimo scan guardado (puertos que cambiaron,
      nuevas entradas en blacklist)
- [ ] Notificacion via email (Resend, ya integrado en otros proyectos SIEG)
      y/o Telegram (patron ya usado en ThreatRadar: bot dedicado)
- [ ] Gating por plan: free = scan manual bajo demanda, premium = alertas
      automaticas recurrentes
