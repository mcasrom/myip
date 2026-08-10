# WAYAHEAD — MyIP

**Qué es**: "Analiza la seguridad de tu conexión antes que un atacante". Plataforma web de análisis y diagnóstico de seguridad de la IP pública (Node/TS, Express + SQLite, Docker).
**Live**: https://myip.viajeinteligencia.com · **Repo**: https://github.com/mcasrom/myip
**Monetización**: NINGUNA — **100% gratuito**, mantenimiento por **donaciones voluntarias Ko-fi** (https://ko-fi.com/m_castillo). Stripe eliminado (06-Ago-2026).

## Estado actual (06-Ago-2026, noche)
- **Fixes aplicados y en vivo**: botón Ko-fi compacto 46px (causa: CSP nginx bloqueaba estilos inline, corregida) · tarjeta 'Usuarios Premium' (NaN) eliminada + refs premium de la UI · historial por usuario verificado (requiere login) · WAYAHEAD limpio + session-log archivado. Commit e9a3629.
- **En producción**: Docker `myip-server` (puerto 3004, healthy, límite 512MB — usa ~76MB). PM2 `myip` redundante eliminado.
- **Git**: sincronizado con `origin/main` (`d1656c0`). Existe **WIP local sin commitear** (refactor "todo free": Snapshots Timeline, ThreatMap/heatmap, SSE push, SupportPanel Ko-fi, auth updates).
- **Sin rastro de Stripe**: código, `.env`, `.env.example`, dependencia y `stripe.env` limpios. `legal.ts` consistente (gratuito + Ko-fi).

## Hecho (resumen)
- **Core**: detección IP + geo, escaneo de puertos con recomendaciones accionables, speedtest (ping/download/DNS), DNS leak, SSL check, reputación/blacklists, CVE/NIST, URL scan, cabeceras, check de contraseñas, auditoría WiFi (solo la propia IP; bloqueada en prod para terceros).
- **Cuenta**: registro/login/guest, historial de escaneos, dashboard con evolución, KPIs comunidad (puertos expuestos, blacklist rate, tendencia semanal — datos **anonimizados Art. 89 RGPD**).
- **Alertas email**: en tiempo real con severidad (low/medium/critical), detección de IP dinámica, cooldown 24h, tabla `alert_log`, limpieza mensual.
- **Seguridad/privacidad**: auditoría externa GDPR/LOPDGDD resuelta, política de cookies, DPO/trazabilidad, `X-Powered-By` off, rate-limit anti-abuso por IP + fingerprint (guest 3 scans de por vida, free 1/24h).
- **UI**: SPA por tabs, errores graceful, botón Ko-fi, privacidad honesta.

## Seguridad (07-Ago): CSP estricta — el grado bajó de A+ a B (`securityheaders.com`: unsafe-inline en script-src)
- **Fix**: extraído el registro del Service Worker a `public/sw-register.js` (script externo, commit `721213f`) → HTML construido sin scripts inline → CSP sin `unsafe-inline` en script-src.
- **nginx** (`/etc/nginx/sites-enabled/myip.viajeinteligencia.com`): `script-src 'self' https://cdnjs.cloudflare.com` (sin unsafe-inline) + `object-src 'none'` + `base-uri 'self'` + `frame-ancestors 'none'`. Verificado: app carga sin violaciones CSP (headless, #root renderizado, sin errores JS). **Nota**: este cambio es infraestructura (nginx), no está en el repo.

## Mejoras 07-Ago (commit `a54cb02`, un solo rebuild):
- **SSL/TLS en el informe PDF**: sección nueva con estado/emisor/expiración + protocolos TLS sondeados (TLS 1.0-1.3) + grade local. `ssl_info` guardado en `scan_history`.
- **Grade SSL local**: sondeo de protocolos TLS y grade orientativo (A: TLS1.3+1.2, B: 1.2, C: 1.1, D: 1.0) mostrado en informe.
- **+7 portDefinitions** (110 POP3, 143 IMAP, 993 IMAPS, 995 POP3S, 161 SNMP, 5060 SIP, 8443) → mejores recomendaciones.
- **GeoIP en el informe**: ubicación (ciudad/país/ISP) en la sección Datos del PDF.
- **Alertas push por empeoramiento del score**: `web-push` + tabla `push_subscriptions` + `/api/push/{vapid-key,subscribe,unsubscribe}` + `sendPushToUser` (dispara si el nuevo score es peor que el anterior) + SW v3 (handlers push/notificationclick) + botón "Activar alertas push" en la cuenta (logueado). VAPID keys en `.env` del servidor (fuera del repo).
- **Pendiente**: verificar el informe completo con un escaneo real (el endpoint PDF requiere sesión); probar el disparo push end-to-end.

## Backlog priorizado
1. **Sprint 6 — Exportar Reporte PDF** (prioridad alta) → detallado abajo.
2. **Sprint C — Blog técnico SEO** ✅ (06-Ago): 3 nuevas guías (7 puertos más atacados · DNSBL/blacklist · escaneo de puertos) + duplicado PWA eliminado → **13 guías**. Commit `37eabfc`. (Continuo: más contenido SEO a demanda.)
3. **CSP reconfigurar** (seguridad del frontend).
4. **7 explicaciones `portDefinitions` faltantes** (mejorar recomendaciones).
5. ~~**`sendEmail` duplicado**~~ → **unificado** (exportado de alerts.ts).
6. **Clustering/ML** de datos de comunidad — requiere **opt-in explícito RGPD** (futuro, NO implementado).
7. ~~Checkout Stripe~~ → **CANCELADO** (no hay monetización).

## Decisiones pendientes
- ¿Eliminar `WelcomeModal`?
- ¿Docker o PM2 directo? (Docker funciona en prod; PM2 solo para dev local)

## Sprint 6 — Exportar Reporte PDF ✅ (06-Ago-2026)

**HECHO**: endpoint `POST /api/export/pdf` (pdfkit, 2-3 páginas: score, datos del análisis, puertos con estado/riesgo/recomendación, blacklist, resumen ejecutivo) + botón **"📄 Exportar PDF"** en la dashboard del historial. Verificado: PDF válido con contenido correcto. Commit `320bfab`.
**FIX 07-Ago (`006c2a6`)**: el PDF salía deformado/mal alineado — las tarjetas de puertos (60px) y filas de blacklist (26px) tenían altura fija y el texto largo (explicaciones/recomendaciones) se salía del recuadro y se solapaba. Arreglado con **alturas dinámicas** (`heightOfString`) para puertos y blacklist. Verificado: tsc OK + PDF de prueba válido (header/xref/EOF) + redesplegado (Docker rebuild healthy, `heightOfString` en dist).
**FIX RAÍZ 07-Ago (`258508d`)**: el cuerpo seguía desalineado — pdfkit deja `doc.x` en la última x usada (440 tras los badges con `align:right`) y `drawSection` no la reseteaba → los títulos de sección se dibujaban desplazados a la derecha (p. ej. «Resumen ejecutivo» a x=440). `drawSection` ahora fija `doc.x=50`; flecha `→` reemplazada por `»` (Helvetica no soporta U+2192 y salía como caja). Verificado por bbox: títulos a x=50.

**Objetivo original**: el usuario puede guardar/compartir su análisis de seguridad en PDF (un clic, desde el dashboard o el historial).

**Estado**: `PDFDocument` ya importado en `server.ts`. **Tiempo**: 3-5 días · **Riesgo**: bajo.

### Tareas
1. **Endpoint** `POST /api/export/pdf` que recibe un `scanId` (o el último scan) y devuelve el PDF.
2. **Contenido del PDF** (reutilizando `PDFDocument`):
   - Cabecera: MyIP + fecha + URL del usuario + score (con barra).
   - Resultados: puertos abiertos (con severidad y recomendación), CVEs detectados, estado blacklist, resumen ejecutivo.
3. **UI**: botón **"📄 Exportar PDF"** en el dashboard y en cada entrada del historial (descarga directa).
4. **Exportación desde historial**: generar PDF de scans anteriores.
5. **i18n**: contenido del PDF en español (consistente con el resto).
6. **Pruebas**: generación correcta en navegador (Chrome/Firefox), PDF < 2 MB, sin datos de terceros.

### Criterios de aceptación
- El PDF se descarga y muestra: score, top puertos con severidad, CVEs y recomendaciones.
- No incluye datos de otros usuarios (solo la IP del propio usuario).
- Latencia < 2 s; no rompe el flujo de escaneo.

### Fuera de alcance (este sprint)
- PDFs programados/por email (si se quiere, sprint posterior como funcionalidad gratuita).
- Rediseño visual del informe.
## Fix — Pantalla en blanco PWA (10 Ago 2026)

- **Síntoma**: pantalla en blanco total. F12: CSP bloqueaba inline script + "Failed to load /src/main.tsx. A ServiceWorker intercepted the request".
- **Causa raíz**: el `dist/index.html` del contenedor apuntaba a `src/main.tsx` (ruta de DESARROLLO) en vez del build compilado `assets/index-*.js`. El index.html se sobrescribió el 9-Ago 19:37 con una versión de dev. El ServiceWorker cacheaba ese HTML roto.
- **Fix**: rebuild `vite build` (dist correcto, apunta a assets/index-C7IA1x_u.js) + copiar al contenedor + **bump SW a `myip-pwa-v4`** (fuerza que el navegador descargue el index nuevo y elimine la caché vieja).
- **Verificado** con puppeteer: render completo (MyIP V2.6, IP visible, menús), 0 errores JS. Ecosistema intacto.
- **Seguro de vida**: backups de dist y DB hechos antes (`myip-backups-dist-20260810`, `myip-backups-db-20260810.sqlite3`).
- **Commit**: `483e911`.

