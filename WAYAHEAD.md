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

## Backlog priorizado
1. **Sprint 6 — Exportar Reporte PDF** (prioridad alta) → detallado abajo.
2. **Sprint C — Blog técnico SEO** (continuo): guías "Qué son los CVE", "Cómo interpretar vulnerabilidades", etc.
3. **CSP reconfigurar** (seguridad del frontend).
4. **7 explicaciones `portDefinitions` faltantes** (mejorar recomendaciones).
5. **`sendEmail` duplicado** (alerts.ts + server.ts) → unificar.
6. **Clustering/ML** de datos de comunidad — requiere **opt-in explícito RGPD** (futuro, NO implementado).
7. ~~Checkout Stripe~~ → **CANCELADO** (no hay monetización).

## Decisiones pendientes
- ¿Eliminar `WelcomeModal`?
- ¿Docker o PM2 directo? (Docker funciona en prod; PM2 solo para dev local)

## Sprint 6 — Exportar Reporte PDF (prioridad alta)

**Objetivo**: el usuario puede guardar/compartir su análisis de seguridad en PDF (un clic, desde el dashboard o el historial).

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
