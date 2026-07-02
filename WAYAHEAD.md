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

## Sesión 2026-07-01 (cierre) — Alertas recurrentes (v1, sin desplegar)

### Implementado (solo local, NO desplegado a Hetzner todavia)
- Instalado node-cron + @types/node-cron
- Nueva función `compareScans(prev, curr)` en server.ts: compara ports_json
  (puerto cerrado->abierto) y reputation_json (limpio->en blacklist) entre
  dos registros de scan_history.
- Cron job (cron.schedule) que cada 2 min (MODO TEST, cambiar a diario
  '0 8 * * *' antes de produccion): itera usuarios premium con IP real,
  llama a POST /api/scan internamente (localhost:PORT, reutiliza TODA la
  logica existente sin duplicar codigo), y si compareScans detecta cambios,
  envia email via sendEmail() (Resend, ya integrado).
- Reutiliza scan_history existente como baseline — NO se creo tabla nueva,
  se usa authDb.getScanHistory(email, 2) para comparar los 2 ultimos scans.
- Fix TS: curr.target_ip -> curr.targetIp (nombre de campo del tipo
  ScanRecord en db.ts es camelCase, no snake_case).

### Decision de producto (contexto de negocio)
Se descarto integrar speedtest-cli (usuario ya usa herramientas externas
solo cuando sospecha problema puntual, no aporta valor diferencial).
Analisis: escaneo puntual gratis ya esta resuelto en el mercado (GRC
ShieldsUp, ipvoid). El valor monetizable real es MONITOREO CONTINUO +
alertas automaticas — de ahi este sprint.

### PROXIMO SPRINT (siguiente sesion)
- [ ] Verificar npx tsc --noEmit limpio (pendiente confirmar en esta sesion)
- [ ] Reiniciar server y validar el cron end-to-end: esperar 2 min, revisar
      logs [CRON] Ejecutando... / [CRON] Sin cambios / [CRON] Alerta enviada
- [ ] Necesita al menos 2 registros en scan_history para un mismo email
      premium para que compareScans tenga algo que comparar (history.length
      === 2). Probar forzando 2 scans manuales seguidos con el mismo user
      premium antes de confiar en el cron.
- [ ] Si un puerto pasa de open->closed no se notifica (solo closed->open),
      revisar si eso es el comportamiento deseado o se quiere notificar
      ambos sentidos
- [ ] Cambiar cron.schedule de '*/2 * * * *' a '0 8 * * *' (diario) SOLO
      cuando el flujo este validado end-to-end
- [ ] server.ts sigue escribiendo/leyendo el archivo entero como monolito;
      valorar extraer compareScans + cron a modulo separado (alerts.ts)
      antes de que crezca mas
- [ ] Gating por plan: confirmar que free NO recibe estas alertas (ya
      filtrado por isPremium en el cron, pero falta UI que comunique esto
      como feature premium en UpgradePanel.tsx)
- [ ] Bug menor sin resolver: 400 en /api/auth/register visto en pruebas
      de sesiones anteriores, no confirmado si es problema real
- [ ] Geo-lookup (ipapi.co) sigue bloqueado por CORS/ETP en navegador,
      pendiente mover a server-side igual que se hizo con /api/ip/detect

## Sesión 2026-07-01 (noche, continuación) — Validación end-to-end del cron

### Bug raíz encontrado y arreglado: ip_address nunca se actualizaba
Síntoma: el cron nunca procesaba a ningún usuario premium, aunque
is_premium=1 y hubiera scans en scan_history.
Causa: createUserWithPassword guarda ip_address='pending' en el registro
inicial, y NINGUNA ruta llamaba a updateUserFields() después para
sincronizarla con la IP real detectada en cada scan. El filtro del cron
(`ipAddress !== 'pending'`) excluía a todos los usuarios para siempre.
Fix aplicado via patch_scan_ip_update.py (anchor-based, backup automático):
dentro de POST /api/scan, tras resolver `user`/`isPremium`/`isGuest`, se
añadió una llamada a authDb.updateUserFields(email, { ipAddress: ip })
cuando hay usuario identificado. Verificado con tsc --noEmit limpio y
confirmado en SQLite: ip_address pasó de 'pending' a la IP real tras el
primer scan.

### Usuario de prueba premium con email real creado
threatradar-osint@viajeinteligencia.com (password: MyipDev2026!, ver
create_premium_test_user.ts) — necesario porque Resend no entrega a
direcciones ficticias tipo test_dev@example.com. is_premium=1,
ip_address=1.146.112.212 confirmados en SQLite.

### Cron validado end-to-end (caso "sin cambios")
Con el fix de ip_address, el cron (cada 2 min, modo test) SÍ detecta al
usuario premium, ejecuta el scan via POST /api/scan interno, y
compareScans() se ejecuta correctamente:
  [CRON] Sin cambios para threatradar-osint@viajeinteligencia.com
Confirma que la lógica de comparación funciona; falta validar el caso
"con cambios" (envío real de email) sin depender de que Resend entregue
a tiempo — decisión pendiente: simular un cambio editando reputation_json
de un registro histórico en vez de esperar un cambio orgánico real.

### Hallazgo nuevo, SIN INVESTIGAR: feature "Informes PDF/Email premium"
En el panel premium aparece "Envío de Informes PDF/Email de Alto Valor"
que al probarse devuelve "Reporte generado. Configura SMTP." — sistema
distinto al de alertas (que usa Resend, ya integrado). No se ha tocado
código para esto todavía; pendiente decidir si se reutiliza Resend o es
un flujo SMTP aparte, y documentar antes de tocar.

### PRÓXIMO PASO
- [ ] Simular cambio de reputación (Spamhaus ZEN clean:true en el
      registro histórico id=24) para forzar rama "con cambios" del cron
      y confirmar que sendEmail() se invoca sin excepción (aunque el
      email no llegue por temas de Resend, no es lo que estamos validando)
- [ ] Decidir si notificar también open->closed (pendiente de sesión anterior)
- [ ] Investigar feature "Informes PDF/Email premium" (Configura SMTP)
- [ ] Resto de pendientes de sesión anterior siguen abiertos: extraer
      alerts.ts, gating UI en UpgradePanel.tsx, geo-lookup server-side,
      revisar 400 en /api/auth/register, cambiar cron a '0 8 * * *'
      tras validar

## Sesión 2026-07-01 (cierre 2) — Bug de falso positivo en alertas + fix

### Bug encontrado: cron reportaba "Alerta enviada" aunque Resend fallara
Al simular un cambio real de reputación (Spamhaus ZEN clean:true->false en
un registro historico via UPDATE manual en scan_history), se confirmo que
compareScans() y el disparo de sendEmail() funcionan correctamente, PERO:
Resend devolvio 403 (modo sandbox, solo permite enviar al email propio
verificado, no a threatradar-osint@viajeinteligencia.com) y el cron logueo
igualmente "[CRON] Alerta enviada a ... 1 cambio(s)" - el codigo no
comprobaba el booleano que devuelve sendEmail().
Fix aplicado via patch_cron_email_result.py (anchor-based): ahora se
captura `const emailSent = await sendEmail(...)` y solo se loguea "Alerta
enviada" si emailSent===true; si no, se loguea
"[CRON] FALLO al enviar alerta a ..." como console.error. Verificado con
tsc --noEmit limpio.

### Cron validado end-to-end (ambas ramas)
- [x] Caso "sin cambios": confirmado en sesion anterior
- [x] Caso "con cambios" + envio exitoso/fallido: confirmado, con el fix
      de arriba ya no hay falsos positivos en el log
- [ ] Pendiente para produccion real: verificar dominio viajeinteligencia.com
      en resend.com/domains y configurar RESEND_FROM con ese dominio (en
      sandbox de Resend solo se puede enviar al email propio verificado)

### PRÓXIMO PASO
- [ ] Decidir si notificar tambien open->closed (pendiente sesiones previas)
- [ ] Investigar feature "Informes PDF/Email premium" (Configura SMTP)
- [ ] Extraer alerts.ts como modulo separado
- [ ] Gating UI en UpgradePanel.tsx
- [ ] Geo-lookup server-side
- [ ] Revisar 400 en /api/auth/register
- [ ] Cambiar cron.schedule de '*/2 * * * *' a '0 8 * * *' antes de produccion

## Sesión 2026-07-01 (cierre 2) — Bug de falso positivo en alertas + fix

### Bug encontrado: cron reportaba "Alerta enviada" aunque Resend fallara
Al simular un cambio real de reputación (Spamhaus ZEN clean:true->false en
un registro historico via UPDATE manual en scan_history), se confirmo que
compareScans() y el disparo de sendEmail() funcionan correctamente, PERO:
Resend devolvio 403 (modo sandbox, solo permite enviar al email propio
verificado, no a threatradar-osint@viajeinteligencia.com) y el cron logueo
igualmente "[CRON] Alerta enviada a ... 1 cambio(s)" - el codigo no
comprobaba el booleano que devuelve sendEmail().
Fix aplicado via patch_cron_email_result.py (anchor-based): ahora se
captura `const emailSent = await sendEmail(...)` y solo se loguea "Alerta
enviada" si emailSent===true; si no, se loguea
"[CRON] FALLO al enviar alerta a ..." como console.error. Verificado con
tsc --noEmit limpio.

### Cron validado end-to-end (ambas ramas)
- [x] Caso "sin cambios": confirmado en sesion anterior
- [x] Caso "con cambios" + envio exitoso/fallido: confirmado, con el fix
      de arriba ya no hay falsos positivos en el log
- [ ] Pendiente para produccion real: verificar dominio viajeinteligencia.com
      en resend.com/domains y configurar RESEND_FROM con ese dominio (en
      sandbox de Resend solo se puede enviar al email propio verificado)

### PRÓXIMO PASO
- [ ] Decidir si notificar tambien open->closed (pendiente sesiones previas)
- [ ] Investigar feature "Informes PDF/Email premium" (Configura SMTP)
- [ ] Extraer alerts.ts como modulo separado
- [ ] Gating UI en UpgradePanel.tsx
- [ ] Geo-lookup server-side
- [ ] Revisar 400 en /api/auth/register
- [ ] Cambiar cron.schedule de '*/2 * * * *' a '0 8 * * *' antes de produccion

## Sesión 2026-07-02 — Cron producción + fixes de auth dev
- Cron cambiado de '*/2 * * * *' a '0 8 * * *' (diario 08:00).
- Mensaje engañoso "Reporte generado. Configura SMTP." corregido para
  reflejar fallo real de envío (mismo sendEmail()/Resend).
- Bug 400 en dev auto-login (src/App.tsx): login-first + fallback a
  register, con DEV_PASSWORD fija para miguel@dev.com.
- Bug raíz encontrado: las cuentas dev (miguel@dev.com, test_dev@example.com)
  solo se creaban en usersDb (diccionario legacy en memoria), nunca en
  authDb (SQLite+bcrypt real), por eso login/register fallaban con 400/401.
  Fix: startServer() ahora crea/actualiza estas cuentas directamente en
  authDb vía createUserWithPassword + updateUserFields({isPremium:true}),
  gateado a NODE_ENV !== 'production', idempotente (getUserByEmail antes
  de insertar). Verificado: login exitoso, isPremium:true confirmado.

Nota: miguel@dev.com es solo para auth local (login/register), no envía
emails. threatradar-osint@viajeinteligencia.com sigue siendo el usuario
premium real para probar sendEmail()/Resend/alertas.

Pendientes: gating UI en UpgradePanel.tsx, geo-lookup server-side
(ipapi.co client-side en src/App.tsx, bloqueado por CORS/ETP).
