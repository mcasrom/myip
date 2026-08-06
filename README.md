# MyIP

**Analiza la seguridad de tu conexión antes que un atacante.**

Plataforma web que diagnostica la seguridad de tu IP pública: puertos expuestos, reputación en listas negras, CVEs y más, con recomendaciones accionables.

- **Live**: https://myip.viajeinteligencia.com
- **Monetización**: NINGUNA — **100% gratuito**. Mantenimiento por **donaciones voluntarias Ko-fi** (https://ko-fi.com/m_castillo). Sin suscripciones, sin cuentas de pago.

## Funcionalidades

- 🔍 **Detección IP + escaneo de puertos** (nmap/sources pasivas) con explicación y recomendación por puerto (22, 3389, 445, 3306, 6379…).
- 🛡️ **Reputación de IP** en listas negras (Spamhaus, Barracuda, AbuseIPDB…).
- 📦 **CVEs**: consulta NVD/NIST de las versiones detectadas (CVSS 0-10).
- ⚡ **Speedtest** (ping, descarga, DNS), DNS leak, SSL check, URL scan, cabeceras, check de contraseñas, auditoría WiFi (solo tu propia IP).
- 📈 **Historial por usuario** con gráfica de evolución + **Exportar informe PDF**.
- 🌐 **KPIs de comunidad** (puertos expuestos, blacklist rate, tendencia semanal) con datos **anonimizados (Art. 89 RGPD)**.
- 📬 **Alertas por email** (severidad low/medium/critical, cooldown 24h).
- 📖 **Biblioteca How-To** con 13 guías técnicas en español (SSH, CVE, blacklist, puertos más atacados, firewall…).
- 🔔 **Radar de amenazas** (ThreatMap) + snapshots timeline.

## Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3).
- **Frontend**: React + Vite + Tailwind + Recharts + Leaflet.
- **PDF**: pdfkit.
- **Deploy**: Docker (Hetzner), Nginx + Cloudflare.

## Requisitos

- Node.js 18+ · npm

## Instalación y desarrollo

```bash
git clone https://github.com/mcasrom/myip.git
cd myip
cp .env.example .env   # rellena las claves (RESEND para alertas, GEOIP, etc.)
npm install
npm run dev            # desarrollo
npm run build          # compilar (dist/)
npm start              # producción (node dist/server.cjs)
```

## Docker (producción)

```bash
docker compose build myip
docker compose up -d myip
```

## API principal

| Endpoint | Descripción |
|---|---|
| `POST /api/scan` | Escanea tu IP (auth opcional para guardar historial) |
| `GET /api/ip/detect` | Detecta tu IP pública |
| `GET /api/scan/history` · `GET /api/scan/dashboard` | Historial del usuario |
| `POST /api/export/pdf` | Exporta el informe de seguridad en PDF |
| `GET /api/stats/community` · `GET /api/stats/anonymized` · `GET /api/stats/trends` | Estadísticas (anonimizadas Art. 89 RGPD) |
| `GET /api/tools/*` | Herramientas (dns-leak, ssl-check, url-scan, ip-reputation, cve-lookup…) |

## Seguridad y privacidad

- Solo audita la **propia IP pública** del usuario; no permite escanear terceros.
- Límites anti-abuso por IP + huella de navegador (guest 3 scans, free 1/24h).
- Estadísticas de comunidad anonimizadas (sin email/IP) — conforme a RGPD Art. 89.
- Sin tracking, sin publicidad, sin recopilación más allá de lo necesario para el servicio.

## Licencia

MIT
