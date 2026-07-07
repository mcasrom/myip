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

## Sesión 2026-07-02 — Cron producción, fixes auth dev, dominio Resend verificado

### Fixes de código (validados con tsc --noEmit + tests curl)
- Cron de alertas cambiado de `'*/2 * * * *'` (test) a `'0 8 * * *'` (diario 08:00),
  vía patch_cron_production.py sobre alerts.ts.
- Mensaje engañoso "Reporte generado. Configura SMTP." corregido en server.ts
  (endpoint /api/premium/send-report): ahora indica fallo real de envío del
  mismo sendEmail()/Resend, no un sistema SMTP separado inexistente.
- Bug 400 en dev auto-login (src/App.tsx): el fetch a /api/auth/register no
  enviaba password (obligatorio, min 8 chars). Cambiado a patrón login-first
  con fallback a register, password fija DEV_PASSWORD='DevPass2026!'.
- Bug raíz relacionado: las cuentas dev (miguel@dev.com, test_dev@example.com)
  solo se creaban en usersDb (diccionario legacy en memoria), nunca en authDb
  (SQLite+bcrypt real) — por eso login/register daban 400/401. Fix en
  startServer() (server.ts): ahora crea/actualiza estas cuentas directamente
  en authDb vía createUserWithPassword + updateUserFields({isPremium:true}),
  gateado a NODE_ENV !== 'production', idempotente. Verificado: login exitoso,
  isPremium:true confirmado para ambas cuentas dev y para la cuenta premium
  real threatradar-osint@viajeinteligencia.com.
- Copy corregido en UpgradePanel.tsx (Tier 2 "SysAdmin Pro"): el feature
  listado decía "Alertas SSL/TLS inmediatas" pero el producto real implementado
  es detección de puerto recién abierto o IP añadida a blacklist. Cambiado a
  "Alertas por email: nuevo puerto expuesto o IP en blacklist". Mismo fix en
  el botón de simulación ("Simular Alerta de Puerto Abierto / Blacklist") y
  en el mensaje del toast simulado (handleSimulateAlert, App.tsx) — ya no
  menciona certificados SSL/MITM ficticios.

### Regresión validada end-to-end (sin roturas)
- Login dev (miguel@dev.com / DevPass2026!) -> isPremium:true OK
- Login premium real (threatradar-osint@viajeinteligencia.com) -> OK
- Register de usuario nuevo (cuenta gratis) -> sigue funcionando igual
- Scan real con sesión premium (nmap, 12 puertos) -> OK
- Reporte por email con mensaje corregido -> OK (falla el envío en sandbox
  Resend viejo, pero el mensaje de error ya es honesto, no dice "SMTP")

### Dominio Resend verificado (bloqueador de producción resuelto)
- Creado dominio viajeinteligencia.com en Resend vía API (POST /domains),
  usando una API key nueva Full Access (la key original en .env solo tenía
  permiso "sending", insuficiente para gestionar dominios — se rotó).
- Encontrados registros DNS duplicados/conflictivos preexistentes en
  Cloudflare de un intento anterior (21 abril), con contenido TXT malformado
  (comillas literales dentro del valor). Identificados y borrados vía API:
  - DKIM viejo (id 1b3bf74619485f21399ad0ee4c7a55b7)
  - MX eu-west-1 viejo (id 613ec81aefea22911f058fe420e21379)
  - SPF TXT viejo malformado (id c8b69a309006651b6ddb53639c03d21d)
- Registros nuevos correctos creados vía API Cloudflare (zone
  a56f7c002b1db64082f0813b839db412): DKIM TXT, MX priority 10
  (feedback-smtp.us-east-1.amazonses.com), SPF TXT.
- Verificado con dig @1.1.1.1 (autoritativo) tras la limpieza: todo correcto.
- POST /domains/{id}/verify + polling: status pasó a "verified" en los 3
  records (DKIM, SPF MX, SPF TXT) tras ~15-20 min de propagación.
- Domain ID Resend: a664a61a-3554-4ef6-b3b6-09a93231cb06

### RESEND_FROM configurado y envío real validado
- server.ts:322 y alerts.ts:39 ya usaban `process.env.RESEND_FROM || 'MyIP
  <onboarding@resend.dev>'`, pero RESEND_FROM no estaba definida en .env, así
  que seguía cayendo al sandbox de Resend pese al dominio ya verificado.
- Añadido a .env: `RESEND_FROM=MyIP <alertas@viajeinteligencia.com>`
- Validado con envío real (no a mcasrom@gmail.com): POST /api/premium/send-report
  con sesión de threatradar-osint@viajeinteligencia.com -> `[RESEND] Email
  enviado a threatradar-osint@viajeinteligencia.com (ID:
  dc66f2a4-1096-4e9e-8ef8-ad92f112cbe9)`, sin error 403 de sandbox. Bloqueador
  de producción de alertas queda RESUELTO end-to-end.

### PRÓXIMO PASO (antes de cerrar sesión)
- [ ] Rotar la API key de Resend vieja (solo sending) si sigue en .env sin
      uso, para no dejar credenciales huérfanas
- [ ] Revisar linea ~1520 de App.tsx: tabla comparativa menciona "alertas
      SSL en background" en contexto de competidores — verificar si necesita
      el mismo ajuste de copy que UpgradePanel.tsx
- [ ] Pendientes de sesiones previas siguen abiertos: geo-lookup server-side
      (ipapi.co en App.tsx, bloqueado por CORS/ETP), revisar si el 400 de
      /api/auth/register queda totalmente resuelto en otros flujos aparte
      del dev auto-login

## Idea de producto 2026-07-02 — Roadmap "Valor Añadido" (org-mode de Miguel)

Documento recibido: análisis de valor comercial para myip (competencia real no
es Nmap, es "tranquilidad + monitorización continua"). Mapeo contra lo ya
construido:

### Ya implementado (el doc lo pide, myip ya lo tiene)
- Alertas automáticas (puerto nuevo + blacklist) — sprint de hoy
- Histórico (scan_history SQLite)
- Blacklists/reputación (AbuseIPDB, OTX, ThreatFox vía stack compartido ThreatRadar)
- Informe por email (HTML, no PDF, cumple la función)
- Escaneo real de puertos (nmap)

### Encaja, esfuerzo bajo-medio (reusar de otros proyectos SIEG)
- [ ] Security Score visual (barra 0-100) — ya se calcula green/yellow/red,
      falta solo el número + barra visual
- [ ] "No se detectan cambios desde hace X días" — subproducto directo de
      compareScans(), ya existe la lógica base
- [ ] Comparativa nacional/premium (dato agregado propio, no requiere API nueva)
- [ ] Inventario de dispositivos (router/NAS/cámaras) — reusar fingerprint_engine.py
      de ThreatRadar (ya en la lista de módulos sanos) + nmap -O

### Encaja, esfuerzo real (features nuevas completas)
- [ ] CVEs de router/firmware (API NVD/vulners, módulo nuevo)
- [ ] DNS Leak / WebRTC Leak / IPv6 (requiere lógica client-side)
- [ ] Benchmark DNS con recomendaciones

### Descartado / no prioritario
- speedtest-cli: decisión ya tomada (sesión previa), sigue vigente, el doc
  lo reproponía pero el motivo de descarte no cambia (sin valor diferencial,
  añade latencia)
- PDF: WeasyPrint ya funciona en ThreatRadar, portable si hace falta, pero
  el email HTML actual ya cumple la función — no es prioritario

Nota: NO se ha tocado código para nada de esto. Es roadmap de referencia para
cuando se decida arrancar un sprint de "Security Score visual" u otro de esta
lista, empezar por los de esfuerzo bajo-medio.

## Sesión 2026-07-02 (tarde) — Badge reputación "Sin verificar" + fix seguridad botnet_checker.py

Bug encontrado: cuando falta API key (AbuseIPDB/VirusTotal), el badge de
reputación mostraba "Limpio" (verde) en vez de indicar que no se verificó
nada — falsa sensación de seguridad para el usuario.

Fix aplicado:
- server.ts: checkAbuseIPDB() y checkVirusTotal() ahora devuelven
  `unverified: true` cuando falta la API key (antes solo `clean: true`).
  Propagado también al fallback de Promise.race en catch (línea ~882).
- src/App.tsx (badge Reputación en Listas Negras, ~línea 841-846):
  tercer estado visual "Sin verificar" (gris, slate) antes de
  clean/reportado. Verificado visualmente, tsc --noEmit limpio.

Seguridad: scripts/botnet_checker.py tenía ABUSEIPDB_API_KEY hardcodeada
en texto plano. Movida a .env (ABUSEIPDB_API_KEY=...), script reescrito
para leer via os.getenv() + python-dotenv. Confirmado: la key NUNCA
quedó commiteada en git history (git log -p sin resultados), no requiere
rotación. .env ya estaba en .gitignore.

Pendiente verificación en runtime: reiniciar server (fuser -k + restart)
y curl /api/scan para confirmar `unverified` en la respuesta JSON real
antes de dar por cerrado el fix visual.

Pendientes de sesiones anteriores (sin tocar hoy):
- gating UI en UpgradePanel.tsx
- geo-lookup server-side (ipapi.co client-side en src/App.tsx, bloqueado por CORS/ETP)
- cron ya en producción (0 8 * * *), no confundir con este pendiente

## Verificación runtime 2026-07-02 (tarde) — badge "Sin verificar" confirmado

Servidor reiniciado (mataba proceso tsx huérfano en :3000 que impedía
recargar el patch + la ABUSEIPDB_API_KEY nueva del .env).
curl -X POST /api/scan con targetIp=8.8.8.8 confirma:
- Spamhaus/Barracuda: check real, sin unverified.
- AbuseIPDB: key real activa, score 0, clean:true, sin unverified
  (antes decía "Limpio" con "API key no configurada" — bug resuelto).
- VirusTotal no aparece para usuario no-premium (comportamiento esperado,
  no relacionado con el fix).
Fix cerrado y validado end-to-end.

## Sesión 2026-07-02 (tarde) — geo-lookup server-side

Fix: geo-lookup (ipapi.co/ipinfo.io) movido de client-side a server-side,
mismo patrón que /api/ip/detect, para evitar bloqueos CORS/ETP en navegador.

- server.ts: nuevo endpoint GET /api/geo/lookup?ip=X con fallback
  ipapi.co -> ipinfo.io hecho desde el servidor.
- src/App.tsx: llamada única a /api/geo/lookup en vez de fetch directo
  a ipapi.co/ipinfo.io desde el navegador.
- Verificado en runtime: curl /api/geo/lookup?ip=8.8.8.8 responde con
  datos geo reales (Brisbane, QLD, AU, Telstra vía fallback ipinfo.io).
- tsc --noEmit limpio.

Pendiente: gating UI en UpgradePanel.tsx (siguiente en la cola).

## Sesión 2026-07-02 (tarde) — Gating UpgradePanel: fix vulnerabilidad bypass de pago

Revisado UpgradePanel.tsx completo (616 líneas): gating visual correcto
en todo el componente (tiers, dev-code, panel premium, form de pago).
No se encontraron bugs de UI.

Vulnerabilidad real encontrada en server.ts: POST /api/premium/upgrade
activaba isPremium=true con solo un email, sin verificar tarjeta ni
pasar por Stripe. Es el fallback correcto SOLO cuando Stripe no está
configurado (modo demo local), pero sin ningún guard, en producción con
Stripe activo cualquiera podría llamar el endpoint directo y saltarse
el pago real por completo.

Fix: guard `if (getStripe()) return 403` al inicio del endpoint —
bloquea el fallback de demo en cuanto STRIPE_SECRET_KEY esté configurada
en producción, forzando el flujo real (create-checkout-session -> pago
Stripe -> verify-session). En local (sin key) sigue funcionando igual
que siempre para pruebas.

Verificado en runtime:
- Sin STRIPE_SECRET_KEY (estado actual): /api/premium/upgrade sigue
  funcionando en modo demo (miguel@dev.com activado OK, isPremium:true).
- Guard aún no probado con key real de Stripe configurada (pendiente
  probar con key dummy si se quiere validar el 403 explícitamente).
tsc --noEmit limpio en todas las verificaciones.

Sprint UpgradePanel/gating: CERRADO.

## Sesión 2026-07-02 (tarde) — Auditoría de almacenamiento real

Se verificó qué se guarda de verdad en myip.sqlite3 (no solo lo que
se ofrece/menciona en la UI):

- users (5 filas): auth real bcrypt, persistente. OK.
- sessions (11 filas): tokens con expiración. OK.
- scan_history (160 filas): histórico REAL de escaneos con
  reputation_json/ports_json/geo_json/analysis_text. Se guarda SOLO
  para usuarios logueados (server.ts linea ~1012, `if (user)`) — no
  hay riesgo de que tráfico anónimo/demo llene la tabla sin control.
  Escritura real vive en db.ts (saveScanRecord), importado en
  server.ts como `authDb.saveScanRecord(...)`.

Problema encontrado: WAL sin checkpoint automatico configurado —
myip.sqlite3-wal llego a pesar 2.6MB vs 135K de datos reales en la DB
principal (probable causa: kills abruptos del proceso durante dev en
vez de shutdown limpio, antes del checkpoint automatico por defecto de
SQLite ~1000 paginas/4MB).

Fix:
1. Checkpoint manual inmediato: PRAGMA wal_checkpoint(TRUNCATE) —
   consolido a myip.sqlite3 (905K reales), wal a 0.
2. db.ts: agregado `db.pragma('wal_autocheckpoint = 100')` (checkpoint
   cada ~400KB en vez de ~4MB) para que no vuelva a acumularse tanto
   entre reinicios de desarrollo. Verificado: wal en 0 tras restart.

Pendientes anotados (NO abordados hoy, quedan en la cola):
- Backup real de myip.sqlite3 fuera del laptop (si el disco muere, se
  pierden usuarios reales + historico completo). Sin verificar aun.
- scan_history existe con datos reales pero NADA lee getScanHistory()
  todavia para clustering/anomalias/tendencias — la base esta lista,
  falta la capa analitica (ML wayahead, mencionado en conversaciones
  anteriores sobre ThreatRadar/GEORISK, aplicable aqui tambien).
- Auditoria de narrativa vs realidad en ThreatRadar/GEORISK (Hetzner):
  queda como sesion aparte, mayor alcance.

## Sesión 2026-07-02 (tarde/noche) — Backup rotativo myip.sqlite3

Añadido `backup_myip_db.sh`: usa `sqlite3 .backup` (online, consistente con
WAL activo, no requiere parar el server), comprime a .gz, rota backups
>14 dias. Backups en carpeta local `backups/` (ya cubierta por .gitignore
si aplica, revisar).

Pendiente en el laptop de Miguel (fuera de mi alcance desde el sandbox):
1. Copiar backup_myip_db.sh al repo local (~/myip) y darle permisos exec.
2. Anadir a crontab (usuario real /home/miguelc/, NO /home/miguel/):
   0 3 * * * /home/miguelc/myip/backup_myip_db.sh >> /home/miguelc/myip/backup.log 2>&1
3. Idealmente, ademas de local, sincronizar backups/ al Hetzner (rsync)
   o a otro disco fisico — backup solo local no protege contra fallo del
   propio laptop. Sin implementar, queda anotado para otra sesion rapida.
4. Verificar .gitignore no versiona backups/*.gz (no deberian subirse al repo).

Pendiente: que hacer con este cron cuando myip se despliegue en el Hetzner
(deploy user, 178.105.80.193). Hoy myip vive solo en el laptop Lubuntu, este
cron es local. Cuando se despliegue al server:
- Revisar si el path de la DB cambia (ruta absoluta distinta bajo
  /home/deploy/apps/myip/ en vez de /home/miguelc/myip/) — el script ya
  resuelve rutas relativas via $(dirname "$0") asi que en principio
  deberia funcionar igual solo copiando el script, pero VERIFICAR permisos
  del usuario deploy sobre el directorio antes de dar por hecho que corre.
  DECISION PENDIENTE, no bloqueante para el pendiente actual del laptop.

Pendientes de cola sin tocar hoy: capa analitica sobre scan_history,
roadmap Security Score visual / "sin cambios hace X dias" / etc.,
auditoria narrativa ThreatRadar/GEORISK.

## Checklist de despliegue a Hetzner (myip) — pendiente, sin implementar

Hoy myip vive solo en el laptop Lubuntu (dev/tsx). Cuando se despliegue al
Hetzner (deploy user, 178.105.80.193), hay que resolver:

1. **NODE_ENV=production** obligatorio en el ecosystem de PM2 — sin esto
   revive el modo dev completo (cuentas premium sin login, sin rate limit).
   Ver aviso defensivo ya implementado en server.ts (console.warn al arrancar).

2. **APP_URL** — hoy default `http://localhost:3000` (.env.example). En
   Hetzner debe apuntar al dominio real (ej. myip.viajeinteligencia.com o
   el que se decida), si no el boton "Iniciar sesion" del email de reporte
   (ya implementado) y los redirects de Stripe (success_url/cancel_url)
   quedan rotos.

3. **Cron de backup** — hoy corre local en el laptop:
   `0 3 * * * /home/miguelc/myip/backup_myip_db.sh`
   Al desplegar, replicar entrada analoga bajo usuario deploy, ruta
   `/home/deploy/apps/myip/` (verificar path exacto cuando se defina la
   estructura de deploy). Decidir si el backup del laptop se mantiene
   tambien (dev/testing) o se retira al pasar la DB real al server.

4. **Dependencia de sistema: nmap** — `port_audit.py` (via spawn) es el
   metodo primario de escaneo de puertos. Verificar que nmap esta
   instalado en el Hetzner antes del primer deploy:
   `ssh deploy@178.105.80.193 "which nmap || apt list --installed | grep nmap"`

5. **PYTHON_PATH** — server.ts usa `process.env.PYTHON_PATH || 'python3'`
   para lanzar port_audit.py y wifi_audit.py. Confirmar que python3 y las
   dependencias de esos scripts existen en el entorno del Hetzner (venv
   compartido o instalacion propia).

6. **wifi_audit.py** ya esta bloqueado en production (`403` explicito si
   NODE_ENV === production) — correcto por diseno, no requiere accion.

7. **Recursos verificados en el Hetzner real (2026-07-02)**:
   `free -h`: 3.7Gi total, 2.2Gi available (la metrica real, no el "free"
   engañoso de la primera columna) — margen amplio para los ~60-120MB
   estimados de myip. Swap 8Gi total, solo 108Mi usados — sistema sano,
   sin presion de memoria real.
   `df -h /`: 38G total, 25G usados (68%), 12G libres — con margen pero no
   holgado; vigilar crecimiento (scan_history de myip + urlhaus_feed de
   ThreatRadar + GEORISK snapshots) periodicamente, no urgente hoy.
   `nproc`: 2 — este es el recurso mas ajustado del server, no la RAM.
   Los picos de nmap de myip son cortos pero compiten con Next.js SSR de
   viajeinteligencia, cron OSINT de ThreatRadar, GEORISK v2 API, etc. No
   bloqueante para desplegar, pero primera sospechosa si aparece latencia
   rara en otra app coincidiendo con un escaneo de myip.
   `nmap`: confirmado en /usr/bin/nmap, dependencia ya resuelta.

## Sesión 2026-07-03

✅ ToS y FAQ integrados como tabs (MarkdownRenderer, headers ###, email
   corregido a threatradar-myip@viajeinteligencia.com)
✅ Soporte H1 y espaciado mejorado en MarkdownRenderer.tsx
✅ Historial de escaneos Premium: endpoint /api/scan/history ya existía en
   backend, ahora consumido en UpgradePanel.tsx como acordeon colapsable
   (resumen "N · último dd/mm hh:mm" cuando cerrado) con color-coding real
   por score (green/yellow/red confirmado via curl) y detalle expandible
   via MarkdownRenderer
✅ OG image confirmada ya correcta (1200x630, jpeg, todos los meta tags) —
   no era pendiente real, false positive de sesión anterior

⏳ Pendiente: prominencia visual del acordeon de historial (sprint de detalles)
⏳ Pendiente: share buttons RRSS (X/Twitter + LinkedIn + WhatsApp) tras
   completar un escaneo — punto de insercion localizado: bloque "Header
   Result summary bar" dentro de activeTab==='dashboard', linea ~795 de
   App.tsx, junto al boton "Actualizar Diagnóstico". Reutilizar imagen OG
   ya existente para preview en LinkedIn/WhatsApp. Falta escribir el patch.
⏳ Pendiente: endpoint de borrado de cuenta (RGPD, derecho al olvido) —
   mencionado en ToS/FAQ como solicitud manual por email mientras tanto
⏳ Pendiente: test despliegue Hetzner (recursos ya liberados y verificados
   2026-07-02, nmap confirmado, estructura /home/deploy/apps/myip/ por
   definir exacta)
⏳ Pendiente: UI gating en UpgradePanel.tsx (bloqueado hace sesiones,
   revisar estado real antes de retomar)
⏳ Pendiente: geo-lookup server-side, fix 400 en /api/auth/register,
   corregir texto "Configura SMTP" enganoso

## Sesión 2026-07-03

### password_health.py — CERRADO
- Fix aplicado y verificado (patch_password_health_v2.py): argv→stdin/getpass (evita exposición en `ps aux`/history), except desnudo→warning explícito + campo `dictionary_loaded`, cache pickle del diccionario (evita reparsear rockyou.txt en cada run).
- Breaking change de uso: ya no acepta password como argumento. Ahora: `python3 password_health.py` (oculto) o `--stdin` o `--dict <ruta>`.
- Pendiente si se quiere exponer como feature web: no wire-ar vía `execAsync` por request (coste de arrancar intérprete Python c/u) — evaluar microservicio persistente o Bloom filter client-side.

### Scripts en ~/myip/scripts — auditoría de viabilidad
- **botnet_checker.py** → DESCARTADO. Redundante: myip y ThreatRadar ya cubren IP+AbuseIPDB con más fuentes. VT_API_KEY cargada pero nunca usada (código muerto).
- **dns_risk_check.py** → DESCARTADO. Bug real (unpacking revienta si no hay DNS configurado). Lógica de riesgo genera falsos positivos graves (marca como "riesgo" el DNS del router/ISP, que es la config normal de la mayoría). No es fuga DNS real pese al nombre.
- **port_scan.py** → APARCADO, no integrar as-is. Vulnerable a inyección de argumentos nmap si `target_ip` no se valida antes de `subprocess`. Sin `blockPrivateTarget` (sí existe en ThreatRadar, replicar). Parseo XML por regex frágil → migrar a `ElementTree`. Peso legal: scan activo real, no pasivo — atarlo al Sprint legal (A) de ThreatRadar (consent_log) si algún día se integra.
- **ssl_cert_audit.py** → APARCADO. Bug de fondo: usa `create_default_context()` que valida cadena y fechas en el handshake, así que un cert YA expirado nunca llega a `getpeercert()` — la rama EXPIRED/CRITICAL es código muerto. Fix: contexto sin verificar solo para leer metadata + parsear con `cryptography`. Separar excepciones (DNS/timeout/cert inválido) en vez de un `except Exception` genérico.
- **wifi_audit_pro_tot.py** → APARCADO (decisión de Miguel: ya existe mejor herramienta en producción — WiFi Hotspot Analyzer basado en iwconfig). Bug de parseo si SSID contiene ":" (nmcli terse mode, escape no respetado por `split(":")`- usar `-m multiline` si se retoma algún día).
- **router_risk.py, test_scan.py, myip_network_core_v3.py, myip_network_health.py** → PENDIENTES de revisar, sin empezar.
- **.bak sueltos** (`port_audit.py.bak_report_path`, `wifi_audit.py.bak_parser_fix`, `wifi_audit.py.bak_gateway_fix`) → decidir si se borran (gitignored igualmente, no afecta git).

### Legal/Pricing — investigación en curso, SIN resolver
Estado real confirmado por grep + git log:
- UI (`UpgradePanel.tsx`): 3 tiers reales — Hogar $9.99 lifetime, SysAdmin Pro $4.99/mes, Consultor Marca Blanca $24.99 (correctamente gateado: badge "Próximamente" + grayscale + backend 501, SIN bug de cobro).
- ToS (`legal.ts`): describe SOLO 2 planes — Mensual 4,99€ y Anual 19,99€. No menciona Hogar ni Consultor. El plan Anual NO EXISTE en ningún commit del historial git (confirmado, `git log -p` desde `4a6cb00` initial commit) — probablemente texto de plantilla SaaS genérica sin cotejar contra los tiers reales.
- Moneda: Stripe cobra en `usd` de forma consistente (`server.ts:683`) — USD es la fuente de verdad, el ToS en EUR está mal.
- PENDIENTE ANTES DE TOCAR EL ToS: confirmar contra Stripe directamente (no solo git) que el plan Anual nunca se vendió manualmente fuera del flujo normal de `server.ts` (Payment Link a mano, etc). Comando pendiente de ejecutar:

stripe products list --limit 20 --api-key "$(grep STRIPE_SECRET_KEY .env | cut -d= -f2)"
stripe prices list --limit 30 --api-key "$(grep STRIPE_SECRET_KEY .env | cut -d= -f2)"

Si NO aparece nada de 19,99€/anual → confirmado que nunca existió, eliminar del ToS (decisión ya tomada por Miguel, pendiente solo de verificar antes de ejecutar).
- Además revisar: `guides.ts` línea 26 menciona "mitigación DDoS ilimitada" en el plan gratuito — no es un servicio real de myip, huele a boilerplate sin editar.
- Próximo paso una vez confirmado Stripe: patch anchor-based para `legal.ts` (3 planes reales en USD, sin Anual) + reconfirmar si `guides.ts` necesita limpieza.

### Nota técnica — stripe CLI
`stripe login` falla porque exige auth interactiva vía navegador (no viable en esta sesión). Solución: usar `--api-key` con la STRIPE_SECRET_KEY del `.env` directamente en cada comando, sin login. Confirmado como método a usar mañana.

## Sesión 2026-07-03 (continuación)

### Incidente: WAYAHEAD.md corrupto por heredoc partido — RESUELTO
- El `cat >> WAYAHEAD.md << 'EOF'` de la sesión anterior se pegó en dos bloques separados en terminal; el shell interpretó los comandos de `stripe products/prices list` como contenido del heredoc en vez de ejecutarlos. Archivo quedó cortado en "Comando pendiente de ejecutar:" (línea 771).
- Fix: contenido faltante generado aparte y añadido vía `cat archivo.md >> WAYAHEAD.md` (sin heredoc, sin riesgo de partirse). Commit `89ef516`.
- Lección para el futuro: pegar bloques largos con heredoc SIEMPRE en una sola pieza, nunca partidos en varios paste.

### Incidente: rockyou.txt + rockyou.txt.pkl en el repo — RESUELTO
- El `git add -A` del commit anterior se llevó por delante `scripts/rockyou.txt` (133MB) y `scripts/rockyou.txt.pkl` (155MB), generados por el fix de `password_health.py`. Push rechazado por GitHub (límite 100MB/archivo).
- Como el push nunca llegó a completarse, el remoto quedó limpio — solo hubo que arreglar el historial local:
  1. `git-filter-repo --path scripts/rockyou.txt --path scripts/rockyou.txt.pkl --invert-paths --force` (purga ambos blobs de todo el historial local).
  2. `rockyou.txt` recuperado de SecLists (mismo diccionario, ~133MB confirmados).
  3. Ambos archivos + `*.pkl` añadidos a `.gitignore`.
  4. Push limpio tras la purga: 11.94 KiB (vs 140MB+ antes). Commit `b54d91c`.

### legal.ts — pricing corregido, CERRADO
- Investigación confirmó que el "Plan Anual 19,99€/año" del ToS nunca existió en el código de myip (verificado con `git log -p` desde el commit inicial) — era texto copiado del ToS de viajeinteligencia.com, que sí tiene ese precio real en Stripe (`Premium Anual`, `price_1TQ0Ng...`, 1999 = 19.99€/año) y coincide exactamente.
- Confirmado también contra Stripe (`stripe products/prices list --api-key`) que myip no crea Product/Price fijos — usa `price_data` al vuelo en Checkout (`mode = 'payment'` en `server.ts:1517`), por eso nunca aparecerá como producto propio en Stripe. Esperado, no es bug.
- Patch aplicado (`patch_legal_pricing.py`): eliminado plan Anual, añadidos Hogar ($9.99 pago único) y Consultores (Marca Blanca, próximamente), moneda EUR→USD, ajustadas secciones 4 (Facturación) y 5 (Cancelación) para reflejar que Hogar es pago único sin renovación. Commit `d2780f9`.

### guides.ts — auditado, SIN cambios necesarios
- Grep de afirmaciones tipo marketing (gratis/ilimitado/100%/garantiza/nunca/siempre): las 4 coincidencias son correctas y no comprometen a myip — DDoS ilimitado gratis es una característica real de Cloudflare free tier (no promesa de myip), SSL gratuito de por vida es cómo funciona Let's Encrypt realmente, el resto es lenguaje descriptivo normal. Cerrado sin patch.

### Auditoría de API keys en .env
- `VIRUSTOTAL_API_KEY` en `.env` de myip es solo un comentario recordatorio (no variable activa) — la key real y en uso está en producción en ThreatRadar (`VT_API_KEY`, mismo valor). No hay duplicidad ni key huérfana que gestionar.
- `ABUSEIPDB_API_KEY` ya está cargada y en uso server-side en myip — correcto tal cual.

### Bloom filter contra rockyou.txt en /api/auth/register — CERRADO
- Decisión de diseño: NO wire-ar `password_health.py` (Python, set de 14M strings en memoria = 400-600MB RAM) directo a un endpoint vía `execAsync` — inviable en servidor compartido con 9 apps PM2. En su lugar, Bloom filter nativo en Node/TS dentro del propio proceso `myip`.
- `scripts/build-bloom-filter.cjs`: build offline (una sola vez, ~106s), lee `rockyou.txt` en streaming, genera `scripts/rockyou-bloom.json` (32.9MB, 14,344,379 entradas, error rate 0.1%). Gitignored — se regenera con el script, no viaja por git.
  - Nota: tuvo que renombrarse de `.js` a `.cjs` porque `package.json` tiene `"type": "module"` (ESM no soporta `require()`).
- `src/utils/passwordBloom.ts`: carga el `.json` UNA VEZ al arrancar el proceso (~33MB RAM fijos, nada por request), expone `isCommonPassword(password): boolean`. Fail-open si el filtro no carga (no bloquea registros por fallo de infra, pero loguea el error).
  - Nota: tuvo que fixearse `__dirname` (no existe en ESM nativo) reconstruyéndolo vía `fileURLToPath(import.meta.url)`.
- `server.ts` (`/api/auth/register`): añadido chequeo tras la validación de longitud (≥8 caracteres) — si `isCommonPassword()` devuelve true, rechaza con 400 y mensaje claro ("aparece en filtraciones de datos públicas conocidas"). Antes de tocar la BD, así que no crea usuario a medias.
- Probado en local: `password123` → rechazada (400). `Xk9$mQ2vN8pL!zR4` → aceptada, cuenta creada. `npm audit` de `bloom-filters`: 0 vulnerabilities.
- Comparativa de recursos vs alternativa Python: 133MB (txt) + 155MB (pkl) + spawn de proceso Python por request → 32.9MB (json) + ~33MB RAM fija, en el propio proceso Node, cero spawn.
- Commit `3a0ab6e`. Usuarios de test (`test_bloom@`, `test_bloom2@`) limpiados de la SQLite local antes del push.

### ⚠️ PENDIENTE CRÍTICO para el deploy a Hetzner
`scripts/rockyou-bloom.json` está gitignored — **no viaja con git pull/push**. Antes de que el registro funcione en producción hay que, en el servidor:
```bash
cd /home/deploy/apps/myip
node scripts/build-bloom-filter.cjs
```
(requiere que `scripts/rockyou.txt` también esté presente ahí — rsync manual o descarga de SecLists igual que en local). Si no se hace, `isCommonPassword()` cae en fail-open (log de warning, pero no bloqueará registros) — no es un crash, pero la protección quedaría inactiva silenciosamente hasta que se genere el archivo.

### Sin empezar / aparcado (sin cambios respecto a antes)
- `router_risk.py`, `test_scan.py`, `myip_network_core_v3.py`, `myip_network_health.py` — pendientes de revisar.
- Test de despliegue Hetzner (recursos liberados y verificados 2026-07-02, nmap confirmado, estructura `/home/deploy/apps/myip/` por definir exacta) — ahora con el añadido del punto crítico del Bloom filter arriba.
- UI gating en `UpgradePanel.tsx` — bloqueado hace sesiones, revisar estado real antes de retomar.
- geo-lookup server-side, fix 400 en `/api/auth/register` (el general, no el del Bloom filter), corregir texto "Configura SMTP" engañoso.

### Cierre de sesión 2026-07-03 — dos dudas abiertas SIN resolver, retomar aquí

1. **Modelo Hogar ($9.99 pago único, escaneos ilimitados "de por vida")**: preocupación de negocio planteada por Miguel — cada escaneo consume APIs de pago (AbuseIPDB, Shodan, Gemini/Grok) + ancho de banda, un pago único con uso ilimitado no escala si el servicio crece. Pendiente decisión de producto: ¿mantener tal cual, poner límite mensual de escaneos al plan Hogar, o subir precio? NO se ha tocado código ni precios todavía.

2. **Duda sobre moneda/importe real cobrado por Stripe**: Miguel sostiene que el precio correcto es "19,99 Anual" y no en dólares — contradice lo que se verificó esta sesión contra Stripe directamente (ver más arriba: `stripe products/prices list` mostró que el Anual 19,99€ pertenece a viajeinteligencia.com, no a myip; y `server.ts` usa `price_data` dinámico en USD). Antes de cambiar nada, PENDIENTE verificar la fuente de verdad real ejecutando:
   ```
   grep -n -B3 -A3 "currency" server.ts
   grep -n -B2 -A5 "tier === 'lifetime'\|tier === 'hogar'\|tier === 'monthly'\|tier === 'whitelabel'" server.ts
   ```
   para confirmar moneda e importes exactos que el Checkout Session envía a Stripe HOY, antes de asumir que hay que cambiar algo. No tocar `legal.ts`/`UpgradePanel.tsx` hasta tener esa confirmación.

3. **password_health / Bloom filter — aclarado**: no tiene UI, es un guardarraíl silencioso backend-only en `/api/auth/register` (rechaza registro si la contraseña está en rockyou.txt). No hay indicador de fortaleza visible en el formulario. Si se quiere visible (ej. semáforo en tiempo real al escribir), es trabajo de frontend nuevo, sin empezar.

4. **Bullets del plan Hogar en UpgradePanel.tsx — verificados, NO son marketing falso**: "Envío de Reportes por Correo" (real, server.ts:1119-1161 vía Resend), "Escaneo TCP real de puertos" (real, vía nmap, server.ts:174), "Diagnósticos ilimitados" (plausible, sin verificar línea a línea). Marca Blanca correctamente gateada con 501 + "Próximamente", sin bullets falsos detectados ahí.

### Webhook de Stripe — INTENTO, bloqueado por gestión de keys, retomar aquí

**Contexto de la tarea**: diseñar `/api/webhooks/stripe` (verificación de firma con `STRIPE_WEBHOOK_SECRET`, manejo de `checkout.session.completed`) como confirmación server-to-server de pagos, en vez de depender solo de `/api/premium/verify-session` (que se dispara desde el frontend tras la redirección — funcional pero más frágil).

**Bloqueo encontrado — gestión de Stripe keys, NO es un bug de código**:
1. `.env` tenía originalmente solo `STRIPE_SECRET_KEY` = clave **LIVE** (`sk_live_...`). Todas las Checkout Sessions de prueba de esta sesión y la anterior (moneda, tiers, límite Hogar) se crearon contra Stripe REAL — sin riesgo económico porque nunca se completó ningún pago con tarjeta, pero mala práctica tener solo live en dev.
2. Se añadió `STRIPE_SECRET_KEY_TEST`, pero resultó ser una **restricted key** (`rk_test_...`), no una secret key estándar (`sk_test_...`) — le falta el permiso "Debugging Tools Write" que exige `stripe listen`. Error 403 al intentar `stripe listen --forward-to ...`.
3. `stripe listen`/`stripe trigger` (necesarios para simular webhooks en local sin desplegar) requieren específicamente una `sk_test_...` estándar. Pendiente: reemplazar `STRIPE_SECRET_KEY_TEST` en `.env` por la secret key de test real desde https://dashboard.stripe.com/test/apikeys (sección "Secret key", NO "Restricted keys").

**Estado del código**: CERO cambios de código hechos en este intento — no se tocó `server.ts` ni se creó el endpoint todavía. Solo se investigó infraestructura de keys. Nada que revertir.

**Próximos pasos exactos para retomar**:
1. Sacar la secret key de test estándar (`sk_test_...`) del dashboard de Stripe (única excepción justificada al evitar el dashboard — es configuración única, no operativa).
2. Reemplazar el valor de `STRIPE_SECRET_KEY_TEST` en `.env` con esa clave.
3. Verificar: `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe --api-key "$(grep STRIPE_SECRET_KEY_TEST .env | cut -d= -f2)"` — debe imprimir `Ready! Your webhook signing secret is whsec_...` sin error 403.
4. Copiar ese `whsec_...` a `.env` como `STRIPE_WEBHOOK_SECRET` (nueva variable).
5. Pendiente de Claude: pedir contexto de `getStripe()` en `server.ts` (`grep -n -B2 -A10 "function getStripe" server.ts`) — necesario para reutilizar el mismo patrón de inicialización en el endpoint nuevo.
6. Diseñar patch: endpoint `/api/webhooks/stripe` con `express.raw({type: 'application/json'})` montado ANTES de la línea `app.use(express.json())` (línea 351 actual) para que esa ruta específica no pase por el parser JSON global — los webhooks de Stripe necesitan el body raw para verificar la firma.
7. Reutilizar la misma lógica de `tier` (`'lifetime'`/`'monthly'` desde `session.metadata.tier`) que ya existe en `/api/premium/verify-session`, para que ambos caminos queden sincronizados.
8. Probar con `stripe trigger checkout.session.completed --api-key "$(grep STRIPE_SECRET_KEY_TEST .env | cut -d= -f2)"` (simula el evento sin tarjeta real).
9. Para producción (cuando se despliegue `myip.viajeinteligencia.com`): crear un segundo webhook endpoint específico de producción vía `stripe webhook_endpoints create --url https://myip.viajeinteligencia.com/api/webhooks/stripe --enabled-events checkout.session.completed --api-key <LIVE key>` — genera su PROPIO `whsec_...` distinto al de desarrollo local. No reusar el secreto de test en producción.

**Nota de seguridad**: durante esta sesión se pegaron en el chat, en texto plano, tanto la clave `rk_test_...` completa como (en sesión anterior) `ABUSEIPDB_API_KEY` y `VIRUSTOTAL_API_KEY`. No hay evidencia de exposición real (conversación privada), pero evitar repetirlo — usar siempre `$(grep ... | cut -d= -f2)` para pasarlas como variable sin mostrarlas en pantalla.

## Estado 2026-07-04 — Deploy en Hetzner + mejoras

### Deploy en Hetzner VPS (178.105.80.193)
- Repo clonado en /home/deploy/myip
- Docker Compose: puerto 3004 -> 3000 (3000 ocupado por viajeinteligencia.com)
- Nginx: proxy_pass a 127.0.0.1:3004 con SSL (Certbot)
- Cloudflare DNS: myip.viajeinteligencia.com -> A record (DNS only, gris)
- SQLite persistente en /home/deploy/myip/data/
- Backup automático: cron diario 03:00 (backup_myip_db.sh)
- Bloom filter: rockyou-bloom.json (33MB, 14M contraseñas) cargado correctamente

### Fixes aplicados
1. **IP Detection**: Añadido X-Real-IP como fallback (sin Cloudflare proxy)
2. **GeoIP**: Corregido ipinfo.io para usar IP del cliente, no del servidor
3. **Healthcheck**: Cambiado localhost -> 127.0.0.1 (evita IPv6)
4. **Rate Limit**: Premium users saltan rate limit correctamente
5. **Usuario Dev**: dev@viajeinteligencia.com (SysAdmin Pro, escaneos ilimitados)
6. **WiFi Audit -> Network Quality**: Reemplazado por auditoría cliente-side (latencia, jitter, velocidad, DNS, contexto de red)

### Mejora: Cache de GeoIP en SQLite
- Nueva tabla  con TTL 24h
- Funciones: , 
- Aplicado en  y endpoint 
- Reduce llamadas a APIs externas (ipapi.co/ipinfo.io) para IPs repetidas
- Primera consulta: API. Segunda+: cache local (campo )

### Recursos del servidor
- RAM: 3.7GB total, ~2.4GB libre
- Disco: 38GB, ~11GB libre (71% usado)
- CPU: 91% idle
- Docker: myip-server (27MB RAM), uptime-kuma (91MB RAM)


## Estado 2026-07-04 -- Deploy en Hetzner + mejoras

### Deploy en Hetzner VPS (178.105.80.193)
- Repo clonado en /home/deploy/myip
- Docker Compose: puerto 3004 -> 3000 (3000 ocupado por viajeinteligencia.com)
- Nginx: proxy_pass a 127.0.0.1:3004 con SSL (Certbot)
- Cloudflare DNS: myip.viajeinteligencia.com -> A record (DNS only, gris)
- SQLite persistente en /home/deploy/myip/data/
- Backup automatico: cron diario 03:00 (backup_myip_db.sh)
- Bloom filter: rockyou-bloom.json (33MB, 14M contraseñas) cargado correctamente

### Fixes aplicados
1. **IP Detection**: Anadido X-Real-IP como fallback (sin Cloudflare proxy)
2. **GeoIP**: Corregido ipinfo.io para usar IP del cliente, no del servidor
3. **Healthcheck**: Cambiado localhost -> 127.0.0.1 (evita IPv6)
4. **Rate Limit**: Premium users saltan rate limit correctamente
5. **Usuario Dev**: dev@viajeinteligencia.com (SysAdmin Pro, escaneos ilimitados)
6. **WiFi Audit -> Network Quality**: Reemplazado por auditoria cliente-side (latencia, jitter, velocidad, DNS, contexto de red)

### Mejora: Cache de GeoIP en SQLite
- Nueva tabla geo_cache con TTL 24h
- Funciones: getGeoFromCache, saveGeoToCache
- Aplicado en getGeoForIp y endpoint /api/geo/lookup
- Reduce llamadas a APIs externas (ipapi.co/ipinfo.io) para IPs repetidas
- Primera consulta: API. Segunda+: cache local (campo cached: true/false)

### Recursos del servidor
- RAM: 3.7GB total, ~2.4GB libre
- Disco: 38GB, ~11GB libre (71% usado)
- CPU: 91% idle
- Docker: myip-server (27MB RAM), uptime-kuma (91MB RAM)


## Mejora: Responsive para smartphones y tablets
- LocalNetworkDiagnostic.tsx adaptado con clases Tailwind sm:
- Padding, tamanos de fuente, iconos y gaps reducidos en movil
- Boton de auditoria ancho completo en pantallas pequenas
- Score circle escalado (w-28 sm:w-36)
- Grid de metricas con 2 columnas, espaciado compacto
- Hallazgos con iconos y texto proporcionales

## Sesión 2026-07-04 (tarde/noche) — Sincronización server ↔ GitHub ↔ local

### Contexto de partida
Más evolución había ocurrido en el server (Hetzner) que en local/GitHub —
deploy Docker + Cloudflare completo hecho directamente ahí, sin pasar por
el flujo habitual de commit local -> push -> pull en server. Se decidió
invertir la dirección esta vez: server -> GitHub -> local, y retomar
desde ahí el flujo normal (local como referencia).

### Diagnóstico realizado (sin tocar nada hasta confirmar)
- Comparados por hash los 5 archivos modificados sin commitear en local
  contra el server: Dockerfile y LocalNetworkDiagnostic.tsx ya eran
  idénticos; db.ts, docker-compose.yml y passwordBloom.ts divergían.
- git status del server reveló además server.ts, backup_myip_db.sh,
  WAYAHEAD.md modificados, y un archivo intruso: src/utils/docker-compose.yml
  (copia vieja abandonada de un cp mal apuntado) -> borrado.
- Verificados en runtime real vía docker logs: IP detection ya funciona
  con IPs de cliente reales (no la del datacenter Hetzner), GeoIP cache
  operativo, Bloom filter cargando, scans nmap sin errores.
- Confirmado: Stripe en producción corre con sk_live_ (correcto), webhook
  (STRIPE_WEBHOOK_SECRET) sigue sin configurar. Resend responde 200,
  sin errores en logs. Cron 08:00 no verificable hoy (contenedor con
  pocas horas de uptime, se comprueba mañana tras las 08:00).

### Bug encontrado y corregido ANTES de comprometerlo (no llegó a producción)
`passwordBloom.ts`: el server tenía la ruta del Bloom filter cambiada de
`fileURLToPath(import.meta.url)` a `__dirname` sin comprobar que el
proyecto es ESM puro (`"type": "module"` en package.json) pero el build
de producción usa esbuild --format=cjs (bundle único dist/server.cjs).
Probado en aislado (`node dist/server.cjs` en el server, sin tocar el
contenedor Docker real): CRASH total, ERR_INVALID_ARG_TYPE, import.meta.url
vacío en el bundle cjs. Fix aplicado: `typeof __dirname !== 'undefined'
? __dirname : path.dirname(fileURLToPath(import.meta.url))` — esbuild
inyecta __dirname real en cjs (apunta a dist/), ESM nativo en dev usa el
fallback. Verificado con build real + arranque real tras el fix: Bloom
filter carga correctamente en los dos entornos. tsc --noEmit limpio.

### Commits aplicados en el server, pusheados y traídos a local (fast-forward,
### sin conflictos reales tras `git restore` de los archivos ya idénticos)
- 63b46b4 — cache GeoIP SQLite + fix ipinfo.io sin IP + x-real-ip fallback + fix isGuest
- b9dc763 — docs: wayahead deploy Hetzner + Docker
- 39a7583 — fix: passwordBloom ruta dual dev/prod + backup_myip_db.sh rutas relativas
- 786dad9 — feat: LocalNetworkDiagnostic responsive

### Estado final: server = GitHub = local, todos en 786dad9

### PENDIENTE PARA MAÑANA
- [ ] Instalar Stripe CLI en el server (no estaba instalada, confirmado
      `command not found`) y retomar el webhook bloqueado desde la sesión
      2026-07-03 (falta sk_test_... estándar del dashboard, no restricted key)
- [ ] Verificar cron de alertas 08:00 corrió hoy sin errores:
      `ssh deploy@178.105.80.193 'docker logs myip-server --since 24h | grep -i CRON'`
- [ ] Investigar por qué `threatradar` (PM2 id 8) aparece `stopped, pid 0`
      en el server — detectado de pasada en el diagnóstico, sin tocar,
      confirmar si fue intencional o es una caída real
- [ ] Decidir si `diag_local.sh` / `diag_local_OUTPUT.txt` se quedan como
      herramienta (añadir a .gitignore) o se borran
- [ ] Localizar el vhost real de nginx para myip (el grep inicial en
      /etc/nginx/sites-enabled/ no lo encontró pese a que el sitio
      responde bien — probablemente vive en conf.d/ o un server_block
      wildcard *.viajeinteligencia.com, sin confirmar aún)

## Sesión 2026-07-05 — Health password / indicador de fortaleza (trabajo en server)

### Contexto
Trabajo hecho de nuevo solo en el server (limitación de sesión en laptop).
Mismo protocolo que ayer: diagnóstico por hash + diff antes de commitear,
nunca asumir que "compila = funciona bien".

### Cambios
- server.ts: límite superior de 128 caracteres en /api/auth/register
  (ya existía el mínimo de 8, faltaba el máximo — mitiga DoS por hashing
  de passwords absurdamente largas antes de que bcrypt las trunque).
- AuthSection.tsx: indicador visual de fortaleza de contraseña en el
  registro (barra de 4 segmentos + label + feedback), cálculo local sin
  dependencias externas (getPasswordStrength).

### Bug encontrado y corregido ANTES de comprometer
El score de fortaleza podía llegar a 5 (3 puntos por longitud + 2 por
variedad de caracteres) pero los arrays `labels`/`colors` solo tenían
índices 0-4. Con la mejor contraseña posible (16+ chars, los 4 tipos de
carácter), `labels[5]`/`colors[5]` devolvían `undefined` -> la barra de
fortaleza se quedaba SIN COLOR justo para las contraseñas más fuertes,
al revés de la intención. Bug silencioso: tsc --noEmit no lo detecta
(no es error de tipos, es índice fuera de rango en runtime). Fix:
`cappedScore = Math.min(score, 4)` antes de indexar los arrays.

### Commit
dca033f — feat: limite 128 chars en registro + indicador visual de
fortaleza de password (fix indice fuera de rango en score maximo)

### Estado: server = GitHub = local en dca033f

## Sesión 2026-07-06 — Email routing OK, cron premium a medio confirmar

### Confirmado
- Cloudflare Email Routing -> mybloggingnotes@gmail.com: verificado, funciona.
- Usuario premium test creado en DB real (/home/deploy/myip/data/myip.sqlite3):
  mybloggingnotes@gmail.com, is_premium=1.
- Cron de alertas SÍ se dispara a su hora (confirmado en logs, 21:56 UTC).
- HALLAZGO: email HTML de alerta es solo <h2>+<ul>, sin link ni branding.
- alerts.ts revertido a su estado original en el server, diff limpio confirmado,
  rebuild + restart completado, logs limpios (sin residuos de test).

### Pendiente próxima sesión
- [ ] Probar disparo real del email de alerta con cambio (margen de tiempo mayor,
      lección: dejar 4+ min de margen, el build tarda 30-60s)
- [ ] Mejorar plantilla HTML del email (link app + branding SIEG)
- [ ] Limpiar scan_history sintético (ids 9,10,12 de mybloggingnotes@gmail.com)
## Sesión 2026-07-05 (noche) — Cierre: Stripe rotado, checkout test OK, email routing

### Stripe: incidente CERRADO
- Clave live rotada con éxito tras 4h de bloqueo por incompatibilidad de
  verificación en Firefox/Chromium en Linux (resuelto usando Chrome).
- Propagada a myip (.env) y viajeinteligencia (.env.local) - MISMA CLAVE
  COMPARTIDA entre los dos proyectos, confirmado por sha256 en 3 puntos
  antes de reiniciar nada (leccion: el primer intento via sed remoto con
  comillas anidadas en SSH escribio una clave distinta a la esperada sin
  dar error - metodo cambiado a scp + python con verificacion de hash
  post-escritura, mucho mas fiable para este tipo de operacion sensible).
- docker compose restart (myip) + pm2 restart --update-env (viajeinteligencia)
  ambos healthcheck 200 confirmados.
- Clave vieja: NO revocada aun, dejada expirar por el plazo de gracia de
  7 dias (decision consciente, sin riesgo real: ya no esta referenciada
  en ningun .env).
- Checkout de TEST probado con exito via API (rk_test_ SI tiene permisos
  para Checkout Sessions, aunque no para stripe listen/webhooks - son
  scopes distintos). Sesion cs_test_ generada y pendiente de completar
  con tarjeta 4242 4242 4242 4242 (activar manana antes de que expire
  a las 24h).

### PENDIENTE INMEDIATO (retomar aqui)
- [ ] Completar el checkout de test generado hoy (URL en el chat de esta
      fecha, expira ~24h desde generacion) - verificar que redirige bien
      a /success y que el flujo se ve correcto
- [ ] Revocar manualmente la clave Stripe vieja en el Dashboard cuando
      convenga (no urgente, expira sola en el plazo de gracia)
- [ ] Limpiar ~/myip/.env local: borrar linea `#otro_stripe=...` una vez
      confirmado que todo funciona (sed -i '/^#otro_stripe=/d' .env)
- [ ] Email routing: Miguel confirma que YA configuro una regla en
      Cloudflare Email Routing para threatradar-myip@viajeinteligencia.com
      (dominio ya tenia MX de Cloudflare Email Routing activo, confirmado
      via dig). Pendiente: verificar a que bandeja reenvia y probar con
      un envio real
- [ ] Usuario premium de test con email real (info@viajeinteligencia.com)
      para validar cron de alertas en produccion - AUN NO CREADO, pendiente
      confirmar primero si ese buzon es revisado de verdad, y localizar
      create_premium_test_user.ts en el server para reutilizar el patron
      ya probado con threatradar-osint@viajeinteligencia.com

### Sesion completa de hoy (resumen)
1. Narrativa: Embudo->Ruta de Proteccion, M.Castillo->SIEG/fundador,
   deployado con exito (commit c1a270d)
2. Bug de indice fuera de rango en password strength (sesion anterior,
   dca033f) - ya cerrado
3. Stripe: incidente completo de arriba
4. deploy_myip.sh creado, probado end-to-end con exito, ya en el repo

## Sesión 2026-07-06 (tarde) — Cierre: Password breach vía servidor, seguridad reforzada, sincronizado

### Cambios aplicados
- **Contraseñas filtradas (fix crítico):** Se movió la verificación de HIBP a un
  endpoint del servidor (`/api/security/check-password`) que actúa como proxy.
  El navegador bloqueaba la petición directa a `api.pwnedpasswords.com` (CORS/AdBlock),
  lo que causaba falsos "✅ Seguro" para contraseñas como `12345`.
  Commits: `9ecb24f`, `4b9d1d9`, `f958263`, `723fe50`
- **Test de calidad de red:** Reemplazado Cloudflare por endpoints internos
  (`/api/speedtest/ping`, `/download`, `/dns`) para evitar latencia/CORS.
- **Auditoría de navegador:** Nueva sección en `TerminalSecurityCheck.tsx` que detecta
  WebRTC leaks, DNT, cookies, password manager.
- **ToS/FAQ actualizados:** Precios en EUR, links `mailto:` clicables, RGPD/LOPDGDD
  expandidos, `MarkdownRenderer.tsx` soporta markdown links.
- **Compartir en RRSS:** Botones X, LinkedIn, WhatsApp, Telegram, Copiar enlace.
- **Emails automáticos:** Bienvenida al registro + email post-primer-scan.
- **VirusTotal:** API key activada (`VIRUSTOTAL_API_KEY`) en server y local.
- **Seguridad nginx:** Bloqueo público de `*.sqlite3`, `.env`, `data/`, `backups/`,
  `scripts/`. Permisos `600` en archivos sensibles.
- **Limpieza servidor:** Docker build cache + logs viejos eliminados (~8.8GB liberados).
- **RGPD Art. 17:** `deleteUserAccount()` en `db.ts` para borrado completo de cuenta.

### Estado final
- Commit: `723fe50` (fix: variable duplicada en TerminalSecurityCheck)
- Local ↔ GitHub ↔ Server: **sincronizado**
- Server healthy (HTTP 200, sin errores)
- CSP desactivado temporalmente (bloqueaba la app, se reconfigurará después)

### PENDIENTE próxima sesión
- [ ] Webhook Stripe: no existe en myip, se necesita `sk_test_...` estándar
  (la `rk_test_...` actual no sirve para webhooks)
- [ ] CSP correcto: reconfigurar sin bloquear la app
- [ ] Auditoría Dashboard: panel visual de estadísticas (usuarios, escaneos, emails)
- [ ] `sendEmail` duplicado en `alerts.ts` y `server.ts` (deuda técnica menor)
- [ ] Limpiar scans sintéticos de test en `scan_history`
- [ ] Borrar línea `#otro_stripe=...` del `.env` local
- [ ] Completar checkout de test generado el 05/07 (expira ~24h)
- [ ] Revocar clave Stripe vieja (plazo de gracia, no urgente)
- [ ] Email routing Cloudflare: verificar buzón destino para threatradar-myip@
- [ ] Usuario premium test con `info@viajeinteligencia.com` para validar cron alertas

### Recursos servidor (actual)
- RAM: 1.4/3.7 GB | Disco: 22/38 GB (60%) | CPU: 0.34
- myip-server: 68 MB / 512 MB límite

## Pendiente 2026-07-06 (noche) — Verificar preview OG en RRSS

- [ ] Confirmar que el preview (imagen 1200x630 + título + descripción) se ve
      correctamente al compartir el link de myip.viajeinteligencia.com en:
      - Telegram
      - Facebook
      - WhatsApp
  Contexto: og:image ya está en index.html (/og-preview.jpg, 1200x630),
  share buttons ya implementados (App.tsx). Falta solo la verificación visual
  real en cada plataforma, no se ha probado todavía.

## Sesión 2026-07-06 (cierre) — Auditoría admin + compresión OG image

### Hecho y verificado en producción
- Plantilla HTML de email de alerta con branding SIEG (alerts.ts) — commit 899e70e
- Endpoint /api/admin/audit protegido con ADMIN_SECRET (.env, no versionado) —
  devuelve totalUsers/premiumUsers/totalScans reales desde SQLite. Verificado
  con curl real: 6 usuarios, 2 premium, 35 escaneos. Commit 168027d.
- og-preview.jpg comprimido con jpegoptim --max=75 --strip-all: 739KB -> 115KB
  (-84%), verificado en producción real (Content-Length: 115152). Commit 28171d9.
- Verificado independientemente trabajo de otra sesión (Qwen): DB/.env
  bloqueados con 403, endpoint borrado RGPD (authDb.deleteUserAccount) existe
  de verdad, share buttons en App.tsx confirmados.
- Tres bloques (server/GitHub/laptop) sincronizados en 28171d9.

### Pendiente próxima sesión
- [ ] Fase 2 auditoría: lastCronRun y emailsSent devuelven null/0 porque
      nada los alimenta todavía — conectar cron (alerts.ts) y sendEmail()
      para que escriban esos contadores en SQLite
- [ ] Verificar preview visual real en WhatsApp y Telegram (mandarse el
      link a uno mismo, usar ?v=2 si hay cache vieja de la imagen pesada)
- [ ] Facebook Debugger: re-scrapear tras compresión, confirmar que carga
      la imagen de 115KB (aviso fb:app_id es opcional, no bloqueante)
- [ ] Desajuste menor: meta tags declaran og:image 1200x630 pero la imagen
      real es 1376x768 — no rompe el preview pero está desalineado
- [ ] Confirmar HTML de alerta con un cambio real (solo se vio "sin cambios")
- [ ] Decidir hora del cron: hoy 0 8 * * * UTC = 10:00 España verano
- [ ] Webhook Stripe sigue sin existir (confirmado, cero código) - bloqueado
      por tipo de clave (falta sk_test_... estándar, no rk_test_... restringida)
- [ ] sendEmail duplicado en alerts.ts y server.ts (deuda técnica menor)
- [ ] CSP quitado temporalmente por Qwen - reconfigurar sin bloquear la app

## Roadmap 2026-07-06 — Analítica, ML y engagement (sin empezar, ideas para priorizar)

### Gráficas / historiales / estadísticas
- [ ] Panel visual (no solo JSON de /api/admin/audit): gráficas de escaneos
      por día/semana, evolución de score por usuario, tendencia de alertas.
      Python + matplotlib/plotly server-side (generar PNG/SVG bajo demanda)
      o Chart.js/Recharts client-side consumiendo el JSON ya existente.
- [ ] Módulo `statistics` de Python (stdlib, sin dependencias nuevas) para
      medias/medianas/desviación de scores históricos por usuario, útil
      antes de meter ML pesado — nivel intermedio entre "nada" y "sklearn".
- [ ] Historial visual por usuario: línea temporal de sus propios escaneos
      (ya hay datos en scan_history, falta solo la vista).

### Recolección de datos para ML / clustering de incidentes
- [ ] Requiere consentimiento explícito ANTES de recolectar (RGPD real, no
      opcional) — reusar patrón consent_log de ThreatRadar (tabla SQLite
      con timestamp + versión de ToS aceptada + IP).
- [ ] Sin consentimiento, cero recolección adicional a lo que ya se guarda
      para el servicio en sí (scan_history ya existe para dar el servicio,
      eso no es "ML data", es el propio producto).
- [ ] Con consentimiento: clustering de patrones de incidentes (ej. HDBSCAN
      sobre combinaciones puerto+reputación+geo) para detectar campañas de
      ataque comunes entre usuarios, no solo alertas individuales. Roadmap
      de 3-6 meses ya mencionado en conversaciones anteriores (trip-osint/
      GEORISK usan patrón similar) — necesita volumen de datos real primero.

### Engagement / conversión
- [ ] Popup de bienvenida llamativo (primera visita, no cada vez — usar
      localStorage o cookie de "ya visto") explicando en 2-3 puntos el
      valor del producto antes del primer escaneo. Cuidado: no debe tapar
      el CTA principal ni sentirse invasivo (eso ahuyenta, no atrae).
      Alternativa más suave: banner superior dismissible en vez de modal.

### Otras ideas (respuesta a "¿más?")
- [ ] Security Score visual tipo barra 0-100 (ya se calcula green/yellow/red
      internamente, falta solo el número + barra — esfuerzo bajo, ya
      identificado en sesiones anteriores)
- [ ] "Sin cambios detectados desde hace X días" — subproducto directo de
      compareScans(), refuerza sensación de vigilancia activa sin acción
- [ ] Exportar historial de escaneos a PDF (WeasyPrint, ya usado en
      ThreatRadar, portable a myip si se quiere)
- [ ] Comparativa anónima "tu score vs la media de otros usuarios" (dato
      agregado propio, no requiere API externa ni tabla nueva)
- [ ] Inventario de dispositivos en red (reusar fingerprint_engine.py de
      ThreatRadar + nmap -O) — esfuerzo medio, ya evaluado antes como viable

## Roadmap 2026-07-06 — i18n Español/Inglés (sin empezar, decisión: retomar en sesión dedicada)

### Estado actual confirmado
- Cero i18n implementado. Cero texto en ingles en ningun sitio (grep
  confirmado en App.tsx, index.html, legal.ts, guides.ts). 100% español.

### Por que tiene sentido de producto
Herramienta de diagnostico de red/seguridad tiene audiencia natural fuera
de España (sysadmins, developers hispanohablantes de otros paises +
mercado angloparlante, mucho mayor). Cerrarse a español es decision de
producto no tomada aun, no limitacion tecnica.

### Por que NO es tarea de sesion rapida (advertencia para el futuro)
- No es un patch pequeño: requiere tocar CADA string visible en App.tsx
  (1700+ lineas), legal.ts, guides.ts, emails de alerts.ts/server.ts,
  meta tags OG.
- Patron estandar: extraer strings a es.json/en.json + selector de idioma
  (useState + localStorage para recordar preferencia).
- Riesgo alto si se hace con prisa: find/replace masivo puede romper JSX
  en decenas de sitios simultaneamente (mismo tipo de error que RRSS hoy,
  multiplicado por escala).

### Recomendacion para cuando se retome
Empezar con piloto pequeño y aislado (ej. solo ToS/FAQ en ingles) antes
de tocar App.tsx completo. Sesion dedicada, con tiempo, no mezclado con
otros pendientes del dia.

Decision 2026-07-06: pospuesto, se anota como roadmap, NO se empieza hoy.

## Sesión 2026-07-07 — 4 features rápidas del roadmap "Valor Añadido" completadas

### Contexto
Retomado el roadmap de 2026-07-06 (Security Score visual, Sin cambios,
Comparativa anónima, etc.), priorizado por ratio impacto/esfuerzo. Las
4 opciones de menor riesgo/dificultad de la tabla quedaron cerradas hoy,
cada una con su propio deploy verificado end-to-end (tsc --noEmit ->
build -> rsync -> docker compose up -d --build -> logs limpios).

### 1. Security Score visual (barra 0-100) — YA EXISTÍA, verificado
No requirió código nuevo. server.ts ya calculaba `scoreNumeric` (líneas
1099-1105) y TrafficLight.tsx ya lo renderizaba como barra de color con
"{scoreNumeric}/100". Confirmado en producción vía grep sobre el bundle
JS servido (`de 100 pts` presente en index-oNyypEF0.js).

### 2. "Sin cambios detectados desde hace X días" — CERRADO
- alerts.ts: `compareScans()` exportada (antes solo uso interno del cron).
- server.ts: import de `compareScans`; antes de guardar el escaneo nuevo,
  se consulta `authDb.getScanHistory(user.email, 1)` para obtener el
  escaneo anterior, se calcula `noChanges` (inverso de `hasChanges`) y
  `daysSinceLastScan` (diff de `created_at` en días). Ambos incluidos en
  la respuesta JSON del escaneo.
- src/types.ts: campos opcionales `noChanges`/`daysSinceLastScan`.
- src/App.tsx: mensaje bajo el TrafficLight si `noChanges === true`.
- Limitación conocida: solo aplica a usuarios Premium (mismo gating que
  `/api/scan/history`, que ya exige `isPremium`).
- Deploy verificado: build limpio, contenedor recreado sin errores,
  commit `68c8b93`.

### 3. Popup automático de cambios detectados tras escaneo — CERRADO
- Decisión de UX (confirmada con Miguel): aparece automáticamente si
  `changes.length > 0`, no requiere click manual.
- server.ts: nueva variable `detectedChanges` (= `cmp.changes`), incluida
  en la respuesta JSON como `changes`.
- src/types.ts: campo opcional `changes?: string[]`.
- src/components/ChangesPopup.tsx (nuevo): modal clonando el patrón visual
  ya usado en el modal de guía iOS de PWAInstallBanner.tsx (`fixed inset-0
  z-50 bg-slate-950/80 backdrop-blur-sm`, card blanca `rounded-3xl`).
- src/App.tsx: `useState<boolean>` para controlar visibilidad, trigger
  justo después de `setScanResult(data)` si `data.changes.length > 0`,
  render condicional junto a `PWAInstallBanner`.
- Deploy verificado: build limpio, contenedor recreado sin errores,
  commit `c0ebdad`.

### 4. Comparativa anónima (tu score vs media de la comunidad) — CERRADO
- Investigación previa al patch: `scan_history` NO tenía columna numérica
  persistida del score (solo el categórico green/yellow/red). Los 34
  registros existentes en producción eran 100% "green" categórico, lo
  que hacía inútil una comparativa por categoría — se optó por migrar
  esquema y comparar el número real 0-100.
- db.ts: migración `ALTER TABLE scan_history ADD COLUMN score_numeric
  INTEGER` con el mismo patrón try/catch ya usado para `tier`/
  `monthly_scan_count` (SQLite no soporta `ADD COLUMN IF NOT EXISTS`).
  `saveScanRecord()` ahora acepta y persiste `scoreNumeric`. Nueva función
  `getCommunityStats()`: `SELECT AVG(score_numeric) as avg, COUNT(*) as
  total FROM scan_history WHERE score_numeric IS NOT NULL` (los 34
  registros viejos con NULL quedan excluidos del promedio automáticamente,
  sin migración de datos históricos).
- server.ts: `scoreNumeric` pasado a `saveScanRecord()`; `communityAverage`
  (resultado de `getCommunityStats().avgScore`) incluido en la respuesta
  JSON del escaneo.
- src/types.ts: campo opcional `communityAverage?: number | null`.
- src/App.tsx: texto "Tu puntuación: X — Media de la comunidad: Y" bajo
  el TrafficLight, junto al mensaje de "sin cambios".
- Verificado en producción tras el deploy: `PRAGMA table_info(scan_history)`
  confirma la columna `score_numeric` ya presente en el esquema real.
- Nota para vigilar: la media empieza en 0 muestras útiles (solo cuenta
  escaneos NUEVOS a partir de hoy); revisar en ~1 semana si conviene
  mostrar aviso de "pocos datos aún" mientras `totalScored` sea bajo.
- Deploy verificado: build limpio, migración de esquema confirmada en
  runtime, commit `9a47d27`.

### Metodología de la sesión (para repetir)
Cada feature siguió el mismo ciclo estricto: inspección con grep/sed
antes de escribir una sola línea (nunca asumir estructura de código sin
verla), patch Python anchor-based (`content.count(anchor) == 1` o aborta
y restaura backups automáticamente), `tsc --noEmit` obligatorio antes de
build, build local antes de tocar el servidor, deploy a la ruta correcta
confirmada (`/home/deploy/myip/`, NO `/home/deploy/apps/myip/` — error
de un intento de deploy hoy, corregido sin dejar rastro, carpeta vacía
borrada), y verificación de logs post-deploy antes de dar por cerrado.
Cero roturas en las 3 features con código nuevo.

### Pendiente (siguiente en la cola del roadmap 2026-07-06)
- [ ] Fase 2 auditoría (lastCronRun/emailsSent aún null/0, sigue sin
      resolver de sesiones anteriores)
- [ ] Inventario de dispositivos (fingerprint_engine + nmap -O) — esfuerzo
      medio, siguiente candidato natural tras cerrar las 4 rápidas
- [ ] Webhook Stripe — sigue bloqueado por tipo de clave (falta sk_test_
      estándar, no rk_test_ restringida), sin tocar hoy
- [ ] i18n Español/Inglés — pospuesto a sesión dedicada, decisión ya
      tomada el 2026-07-06, no mezclar con pendientes sueltos
- [ ] CSP sigue desactivado temporalmente (Qwen lo quitó, reconfigurar
      pendiente de sesión anterior)

## Duda aclarada 2026-07-07 — Test de Calidad de Red vs Test de Seguridad (dos sistemas distintos)

Pregunta de Miguel: el chequeo da casi 100/100 siempre, ¿no detecta fallos?

Aclarado por inspección de codigo (no habia confusion de bug, son DOS
sistemas distintos con proposito distinto):
- `LocalNetworkDiagnostic.tsx` ("Network Quality"): mide latencia/jitter/
  velocidad/DNS via fetch() del navegador contra /api/speedtest/*. Empieza
  en 100, resta solo por lentitud de conexion. NO escanea puertos, NO
  consulta listas negras, NO detecta vulnerabilidades — es normal que de
  casi 100/100 con buena conexion, no es un bug ni una falta de deteccion.
- El escaneo principal (TrafficLight/scoreNumeric): este SI es seguridad
  real. Target = IP publica del usuario (x-real-ip/x-forwarded-for),
  nmap real + listas negras (AbuseIPDB/Spamhaus/etc). Este es el que
  puede bajar de 100 y detecta exposicion real del router/NAT.
Sin ambiguedad de codigo, cerrado sin patch (era pregunta, no bug).

## Roadmap — Inventario de dispositivos locales (topologia de red), analisis de arquitectura

Idea: esquema grafico de la LAN del usuario (IPs, gateway, dispositivos)
via python-nmap/scapy + networkx + matplotlib/graphviz. Encaja con
"Inventario de dispositivos" ya evaluado en 2026-07-02 (reusar
fingerprint_engine.py de ThreatRadar).

Complejidad desglosada:
- Descubrimiento (nmap -sn, python-nmap): FACIL, mismo patron que
  port_audit.py ya existente.
- Identificar gateway real (no asumir .1, leer tabla de rutas): MEDIO.
- Fingerprint de tipo de dispositivo (MAC OUI vendor lookup): MEDIO,
  heuristico no exacto, reusar fingerprint_engine.py.
- Dibujar grafo (networkx + matplotlib/graphviz): FACIL una vez el dato
  esta limpio.

BLOQUEADOR DE ARQUITECTURA (no es problema de codigo, es de diseño):
myip es SaaS en Hetzner (Alemania) — el servidor NO tiene ruta de red
a la LAN domestica del usuario. Un escaneo de dispositivos locales debe
ejecutarse DENTRO de la LAN del usuario, nunca desde el backend.
Dos caminos reales:
  1. Script Python descargable (mismo patron que password_health.py) que
     el usuario corre en su maquina, con opcion de subir resultado a myip
     para visualizarlo — unico camino realista para un solo-dev.
  2. Agente/app nativa instalable — fuera de alcance de una sesion.
Decision: si se retoma, empezar por opcion 1, sesion dedicada aparte,
no mezclar con pendientes sueltos del dia a dia.

## Hallazgo 2026-07-07 — Gap real de cobertura de puertos (Samba/impresoras NO detectados)

Pregunta de Miguel: si tengo Samba o puerto de impresora abierto, ¿se
detecta? Respuesta confirmada por codigo: NO, y no es un bug sutil —
es que esos puertos no estan en la lista que se le pide a nmap escanear.

`scripts/port_audit.py` -> `CRITICAL_PORTS` (lista fija pasada a
`nmap -p <lista>`, NO es un top-N de nmap): solo cubre
22,80,443,3306,8080,3389,5432,6379,27017,21,25,53. Ningun puerto de
Samba/NetBIOS (139,445), impresoras (631 IPP, 9100 JetDirect, 515 LPD),
VNC (5900), Telnet (23), UPnP (1900) esta en esa lista — nmap ni
siquiera los consulta, no aparecen ni como "closed"/"filtered".

Gap secundario (ya detectado antes, menor): de los 12 puertos que SI se
escanean, solo 5 (22,80,443,3306,8080) tienen explicacion especifica en
`portDefinitions` de server.ts — los otros 7 (3389,5432,6379,27017,21,
25,53) se detectan pero caen en mensaje generico "puerto desconocido".

Impacto: vector de riesgo domestico mas comun (Samba mal configurado
exponiendo carpetas, impresora de red accesible) es invisible hoy. Score
puede marcar 100/100 con ese fallo presente sin que el test lo pregunte.

### Pendiente (patch concreto para retomar, NO empezar sin sesion dedicada)
- [ ] Añadir a CRITICAL_PORTS (port_audit.py): 139, 445 (Samba/NetBIOS),
      631 (IPP), 9100 (JetDirect), 515 (LPD), 5900 (VNC), 23 (Telnet),
      1900 (UPnP, sobre UDP - nmap necesitaria -sU, coste extra de tiempo
      de escaneo, decidir si vale la pena o se documenta como limitacion)
- [ ] Añadir entradas correspondientes en portDefinitions (server.ts) con
      openExplanation/openRecommendation especificas por servicio (ej.
      Samba: "Tu compartición de archivos está expuesta a internet,
      cualquiera podría listar o acceder a tus carpetas compartidas")
- [ ] Completar tambien las 7 explicaciones genericas que faltan hoy
      (3389,5432,6379,27017,21,25,53) mientras se toca este archivo
- [ ] Nota de rendimiento: cada puerto nuevo añade tiempo de escaneo
      nmap (timeout actual 120s en scan_with_nmap) - verificar que anadir
      ~7-8 puertos mas no empuja el escaneo fuera de rangos razonables
      para el usuario (medir antes/despues del cambio)

## Roadmap — Esquema gráfico de dispositivos: opciones de UX evaluadas 2026-07-07

Pregunta de Miguel tras confirmar viabilidad tecnica (ver entrada anterior
sobre bloqueador de arquitectura LAN): ¿el grafico es estetico, da valor
real al usuario?

### Valor: SI, confirmado
Usuario domestico normal no sabe que dispositivos tiene conectados a su
router. Mapa visual convierte "12 puertos abiertos" (abstracto) en "esta
camara que no reconoces esta aqui" (concreto, accionable). El valor real
es detectar el dispositivo intruso/olvidado, no solo estetica.

### 3 opciones evaluadas, de menos a mas esfuerzo

**Opcion A — Lista jerarquica simple (recomendada para empezar)**
Router como raiz, dispositivos como hijos, iconos lucide-react ya
disponibles, color por riesgo. Cero librerias nuevas, cero diseño de
grafico real. Poco "wow" visual pero 100% del valor funcional. Permite
validar si a los usuarios les importa esto antes de invertir mas.

**Opcion B — Grafo interactivo real (D3.js o vis.js, client-side)**
Nodo central + lineas a cada dispositivo, iconos por tipo, color por
riesgo. Vendible en capturas de marketing, pero es una app React/D3
nueva de esfuerzo real, no un simple render.

**Opcion C — Imagen estatica Python (networkx + matplotlib)**
La idea original planteada. Se ve mas "informe tecnico" que "app
pulida" — coherente con publico sysadmin/developer, menos atractivo
para usuario domestico medio (target principal actual segun ToS).

### Decision recomendada
Empezar por Opcion A (barata, reusa componentes ya existentes tipo
TrafficLight/ChangesPopup). Si engancha con usuarios reales, subir a
Opcion B con calma, sesion dedicada aparte.

Nota: esto depende del pendiente de arquitectura ya documentado arriba
(script Python descargable, el escaneo NO puede hacerse desde el backend
Hetzner por estar en red distinta a la LAN del usuario) — sin resolver
eso primero, no hay datos que graficar.

## Sesión 2026-07-07 (continuación) — Gap de cobertura de puertos CERRADO

Patch aplicado siguiendo el plan documentado en la entrada anterior
(hallazgo del mismo día).

### Cambios
- scripts/port_audit.py: CRITICAL_PORTS ampliado de 12 a 19 puertos —
  añadidos 139 (NetBIOS), 445 (SMB/Samba), 631 (IPP), 9100 (JetDirect),
  515 (LPD), 5900 (VNC), 23 (Telnet). UPnP/1900 (UDP) dejado fuera por
  ahora, según lo ya decidido (coste de escaneo UDP, documentado como
  limitación conocida).
- server.ts: 7 entradas nuevas en portDefinitions con explicacion/
  recomendacion especifica por servicio (antes solo 5 de 12 puertos
  tenian explicacion; ahora 12 de 19).

### Verificacion de rendimiento (la duda real antes de tocar produccion)
- Local (laptop): escaneo completo de 19 puertos contra 8.8.8.8 = 10s
  reales (`time python3 port_audit.py`).
- Produccion (dentro del contenedor Docker, tras deploy): 1.7s para los
  mismos 19 puertos contra la misma IP de prueba — bien por debajo del
  timeout de 120s en scan_with_nmap() y del Promise.race de 30s en
  server.ts. Cero impacto de rendimiento, cobertura casi duplicada.

### Pendiente (siguiente patch, NO mezclado con este)
- [ ] Completar las 7 explicaciones genericas restantes (3389, 5432,
      6379, 27017, 21, 25, 53) — mismo patron, separado a proposito para
      mantener el diff de este commit legible
- [ ] Decidir si se añade UPnP/1900 con -sU (coste real de escaneo UDP,
      medir antes de decidir)

## Sesión 2026-07-07 (noche) — Webhook Stripe CERRADO (bloqueado desde 2026-07-03)

### Desbloqueo de la clave
La clave test estándar correcta (`sk_test_51...`) llevaba semanas ya
generada, guardada en `.env` bajo el nombre `#otro_stripe=` (comentada,
sin usar) desde la sesión 2026-07-05. Nunca se relacionó con el bloqueo
de `STRIPE_SECRET_KEY_TEST` (que seguia siendo una `rk_test_` restringida)
hasta revisar el .env a fondo hoy. Activada copiando su valor a
STRIPE_SECRET_KEY_TEST.

### stripe listen — confirmado funcionando
`stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
--api-key sk_test_...` -> "Ready! ... webhook signing secret is whsec_..."
sin error 403. La restriccion de scopes de la key vieja (rk_test_,
sin permiso "Debugging Tools Write") ya no aplica.

### Endpoint /api/webhooks/stripe implementado
- server.ts: nuevo endpoint montado con `express.raw({type:
  'application/json'})`, ANTES de `app.use(express.json())` global (linea
  358), imprescindible para que Stripe pueda verificar la firma HMAC
  sobre el body sin parsear.
- Verifica firma via `stripe.webhooks.constructEvent(req.body, sig,
  webhookSecret)`, usando STRIPE_WEBHOOK_SECRET (variable nueva).
- Maneja `checkout.session.completed`: misma logica que
  `/api/premium/verify-session` ya validada (normaliza email, resuelve
  tier desde metadata, actualiza usersDb en memoria + authDb.
  updateUserFields en SQLite) — ambos caminos quedan sincronizados como
  estaba planeado.
- Otros tipos de evento: logueados como "sin manejar", sin error, para
  visibilidad futura sin bloquear nada.
- tsc --noEmit limpio. Commit `bb16f70`.

### Incidente de patch — anchor no encontrado, resuelto sin perdida
Primer intento (script Python con heredoc + comillas triples anidadas)
fallo con "anchor encontrado 0 veces" — probablemente el heredoc se
corrompio al pegarse en terminal (multiples comandos mezclados en el
output). Backup intacto confirmado por `diff` antes de reintentar.
Metodo alternativo usado con exito: snippet en archivo de texto aparte
(`cat > archivo.txt << 'EOF'`, verificado con `wc -l`/`head`/`tail` antes
de tocar server.ts) + insercion via `sed -i '358r archivo.txt' server.ts`
por numero de linea exacto. Mas robusto que heredoc con comillas
anidadas para bloques de codigo largos — considerar como metodo
preferido para patches grandes en el futuro.

### Pruebas end-to-end (test mode local)
- `stripe trigger checkout.session.completed` -> stripe listen reenvio
  el evento, servidor respondio 200, log
  "[WEBHOOK] checkout.session.completed recibido pero sin email/pago
  confirmado, ignorado." — correcto, `stripe trigger` genera evento
  generico sin la metadata custom (email/tier) que solo existe en
  sesiones reales creadas por server.ts. Firma verificada correctamente
  (si fallara, response seria 400, no 200).
- Otros eventos de la cascada de fixtures de Stripe (product.created,
  price.created, charge.succeeded, payment_intent.*, charge.updated)
  logueados correctamente como "sin manejar", sin crash.

### Webhook de PRODUCCION creado (live mode)
- Bug encontrado al crear el webhook de produccion: comando usaba
  `grep STRIPE_SECRET_KEY .env` (sin anclaje `^` ni `=`) — matcheaba
  TANTO `STRIPE_SECRET_KEY=` como `STRIPE_SECRET_KEY_TEST=`, devolviendo
  dos valores separados por salto de linea. Ese `\n` interno rompia la
  cabecera HTTP Authorization (`net/http: invalid header field value`).
  Fix: `grep '^STRIPE_SECRET_KEY='` (anclado + con el `=`) — mismo tipo
  de bug de anclaje que ya habiamos evitado en sesiones anteriores con
  `cut -c1-8`, pero esta vez colado en un comando distinto. Leccion:
  SIEMPRE anclar `^` y incluir el `=` al hacer grep sobre variables de
  .env que puedan ser prefijo de otras (ej. STRIPE_SECRET_KEY vs
  STRIPE_SECRET_KEY_TEST).
- Webhook creado con exito via API (`stripe webhook_endpoints create`),
  modo live, URL https://myip.viajeinteligencia.com/api/webhooks/stripe,
  evento checkout.session.completed. ID: we_1TqPbZ1yXjIoL1LjhfjP1MA6.
  Secret de produccion: whsec_3UoLfjGnP9upr3iUZAVmsa74nolD3rKa (distinto
  al de test local, correcto segun el plan original).
- STRIPE_WEBHOOK_SECRET añadido al .env del servidor Hetzner (no existia
  antes, confirmado con grep vacio previo).
- Deploy de server.ts al servidor (rsync + docker compose up -d --build),
  contenedor recreado sin errores.
- Verificacion final end-to-end en produccion real: `curl -X POST
  https://myip.viajeinteligencia.com/api/webhooks/stripe` sin firma
  valida -> 400 (rechazo correcto). Confirma cadena completa: DNS ->
  Cloudflare -> Nginx -> Docker -> Express -> verificacion HMAC, todo
  operativo.

### Estado: CERRADO
Webhook de Stripe, pendiente desde 2026-07-03, funcional en test y
produccion. Unico camino de confirmacion de pago ahora es doble:
`/api/premium/verify-session` (frontend, tras redireccion) +
`/api/webhooks/stripe` (server-to-server, no depende de que el
navegador del cliente complete la redireccion) — resuelve el riesgo de
pago cobrado sin isPremium activado que motivo originalmente esta tarea.

### Pendiente (limpieza menor, no bloqueante)
- [ ] Borrar la linea `#otro_stripe=...` del .env local, ya migrada a
      STRIPE_SECRET_KEY_TEST (sed -i '/^#otro_stripe=/d' .env)
- [ ] Confirmar un pago real de prueba con tarjeta 4242 4242 4242 4242
      contra el checkout real (no solo `stripe trigger`) para validar
      el camino completo con metadata.email/tier real, no simulado
- [ ] Considerar añadir mas eventos al webhook si hacen falta en el
      futuro (ej. `checkout.session.expired`, `charge.refunded`) —
      hoy solo checkout.session.completed esta manejado

## Sesión 2026-07-07 (madrugada) — Webhook Stripe: codigo cerrado, falta 1 prueba con pago real

### Lo que YA esta confirmado y funcionando (no repetir)
- Endpoint /api/webhooks/stripe implementado, deployado en local Y produccion.
- Verificado con `stripe trigger checkout.session.completed`: firma OK,
  respuesta 200, logica correcta (ignora evento sin metadata, como se
  espera de un trigger simulado).
- Verificado en produccion real con curl sin firma: 400 (rechazo correcto).
- Webhook de produccion creado en Stripe (modo live), whsec_ guardado en
  .env del servidor Hetzner. Commit bb16f70 + 9585092.
- CONCLUSION: el codigo del webhook esta completo y correcto. Lo unico
  que falta es la ultima milla: un pago real end-to-end con tarjeta de
  test para confirmar que `isPremium` se activa en la SQLite real.

### Pendiente exacto para retomar (bloqueo fue de logistica de terminales, NO de codigo)
Intento de hoy fallo por gestion de multiples terminales (tmux resulto
incomodo para copiar/pegar, procesos se perdieron entre ventanas). El
plan es correcto, solo hace falta ejecutarlo con calma:

1. Terminal 1 (dejar corriendo, NO tocar mas):
   cd ~/myip
   STRIPE_SECRET_KEY="$(grep '^STRIPE_SECRET_KEY_TEST=' .env | cut -d= -f2)" APP_URL="https://myip.viajeinteligencia.com" npm run dev
   Esperar a ver "MyIP server running on http://0.0.0.0:3000" y que NO
   crashee tras unos segundos.

2. Terminal 2 (dejar corriendo, NO tocar mas):
   cd ~/myip
   stripe listen --forward-to http://localhost:3000/api/webhooks/stripe --api-key "$(grep '^STRIPE_SECRET_KEY_TEST=' .env | cut -d= -f2)"
   Esperar a ver "Ready!".

3. Terminal 3 (aqui se trabaja):
   curl -X POST http://localhost:3000/api/premium/create-checkout-session \
     -H "Content-Type: application/json" \
     -d '{"email":"test-checkout3@example.com","tier":"lifetime"}'
   Copiar checkoutUrl, abrir en navegador, pagar con 4242 4242 4242 4242,
   fecha 12/30, CVC 123.

4. Tras pagar, revisar Terminal 1 y 2 (deberian mostrar
   "[WEBHOOK] Premium activado..." y evento 200 respectivamente).

5. Confirmar en SQLite:
   node -e "
   const Database = require('better-sqlite3');
   const db = new Database('myip.sqlite3');
   console.log(JSON.stringify(db.prepare('SELECT email, is_premium, tier FROM users WHERE email = ?').get('test-checkout3@example.com')));
   "

### Hallazgo colateral IMPORTANTE encontrado hoy, sin resolver
`.env` local tiene `APP_URL="MY_APP_URL"` — placeholder de plantilla SIN
RELLENAR, no una URL real ni siquiera localhost. Esto rompe cualquier
flujo que dependa de APP_URL en local (creacion de checkout session da
error url_invalid de Stripe, botones de email con URL de vuelta, etc).
PENDIENTE URGENTE: verificar si el .env del SERVIDOR (Hetzner,
/home/deploy/myip/.env) tiene el mismo problema o esta bien configurado
- si esta mal en produccion, es un bug activo ahora mismo afectando
  usuarios reales, no solo dev local.
Comando para verificar manana:
  ssh deploy@178.105.80.193 "grep '^APP_URL=' /home/deploy/myip/.env"

### Limpieza pendiente menor
- [ ] Borrar linea #otro_stripe= del .env local (ya migrada a STRIPE_SECRET_KEY_TEST)
- [ ] Matar cualquier proceso node/curl huerfano en puerto 3000 antes de la proxima sesion:
      fuser -k 3000/tcp

## Sesión 2026-07-07 (mañana) — Webhook Stripe verificado + script auditoría

### Webhook Stripe: CERRADO ✅
- Problema: server usaba `rk_test_` (restricted key) que no verifica firmas de webhook.
- Solución: actualizado a `sk_test_51TMtvL1yXjIoL1LjdbGli...` (rotación anterior).
- Creado webhook en Stripe apuntando a `https://myip.viajeinteligencia.com/api/webhooks/stripe`.
- `DB_PATH=/app/data/myip.sqlite3` añadido al .env del server (container no arrancaba sin ello).
- `stripe trigger checkout.session.completed` → webhook recibe evento, firma válida, 200 OK.
- Pendiente: probar checkout real con tarjeta 4242 en producción.

### Script de auditoría
- `scripts/auditoria_myip.py` — panel de estadísticas de producción vía SSH.
- Muestra: usuarios, escaneos, IPs únicas, top IPs, scans por día, premium, contadores.
- Ejecución: `python3 scripts/auditoria_myip.py` (desde raíz del proyecto o ruta absoluta).

### Estadísticas actuales (BD producción)
- Usuarios: 6 | Escaneos: 42 | IPs únicas: 8 | Premium: 2
- Top IP: 1.146.110.90 (16 escaneos)
