import express from 'express';
import path from 'path';
import { getSecurityKpis } from './securityKpis';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import https from 'https';
import tls from 'tls';
import net from 'net';
import dns from 'dns';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import cookieParser from 'cookie-parser';
import * as authDb from './db';
import { startAlertsCron, compareScans } from './alerts';
import { isCommonPassword } from './src/utils/passwordBloom.js';
import PDFDocument from 'pdfkit';
dotenv.config();

// ============================================================================
// SECURITY: IP Validation — Block private, reserved, and internal IPs
// ============================================================================
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^224\./,
  /^240\./,
  /^255\./,
  /^100\.64\./,
  /^198\.18\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
];

function isPublicIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  if (ip === '::1' || ip.startsWith('fe80') || ip.startsWith('fc00') || ip.startsWith('fd00')) return false;
  return !PRIVATE_IP_RANGES.some((regex) => regex.test(ip));
}

// ============================================================================
// Utility: HTTP GET helper
// ============================================================================
function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON from ${url}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

// ============================================================================
// Utility: HTTP POST helper
// ============================================================================
function postJson(url: string, body: any, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON from ${url}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    req.write(postData);
    req.end();
  });
}

// ============================================================================
// DNSBL lookup (with 5s timeout)
// ============================================================================
function checkDNSBL(ip: string, dnsblServer: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), 5000);
    const reversedIp = ip.split('.').reverse().join('.');
    dns.resolve4(`${reversedIp}.${dnsblServer}`, (err, addresses) => {
      clearTimeout(timer);
      if (err) { resolve(true); return; }
      const isListed = addresses?.some((a) => a.startsWith('127.0.0.') && !a.endsWith('.0')) ?? false;
      resolve(!isListed);
    });
  });
}

// ============================================================================
// SSL certificate check
// ============================================================================
function checkSSL(hostname: string, port = 443, timeoutMs = 5000): Promise<{
  valid: boolean; issuer: string; validTo: string; daysToExpiry: number; alert?: string;
} | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      if (!cert || Object.keys(cert).length === 0) { socket.destroy(); resolve(null); return; }
      const validTo = new Date(cert.valid_to);
      const now = new Date();
      const daysToExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      socket.destroy();
      resolve({
        valid: now <= validTo,
        issuer: (cert.issuer as any)?.CN || (cert.issuer as any)?.O || JSON.stringify(cert.issuer) || 'Desconocido',
        validTo: validTo.toISOString().split('T')[0],
        daysToExpiry,
        alert: daysToExpiry < 30 ? `El certificado SSL vencerá en ${daysToExpiry} días.` : undefined,
      });
    });
    socket.setTimeout(timeoutMs, () => { socket.destroy(); resolve(null); });
    socket.on('error', () => resolve(null));
  });
}

// ============================================================================
// Port Scanning: Shodan API
// ============================================================================
async function getPortsFromShodan(ip: string): Promise<any[]> {
  const apiKey = process.env.SHODAN_API_KEY;
  if (!apiKey) return [];
  try {
    const data = await fetchJson(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`);
    if (data?.data) {
      return data.data.map((item: any) => ({
        port: item.port, protocol: item.transport || 'tcp',
        service: `${item.product || ''} ${item.version || ''}`.trim() || item.service || 'unknown',
        status: 'open', banner: item.data || '',
      }));
    }
  } catch (err) { console.log('[SHODAN] Error:', err); }
  return [];
}

// ============================================================================
// Port Scanning: Censys API
// ============================================================================
async function getPortsFromCensys(ip: string): Promise<any[]> {
  const apiId = process.env.CENSYS_API_ID;
  const apiSecret = process.env.CENSYS_API_SECRET;
  if (!apiId || !apiSecret) return [];
  try {
    const auth = Buffer.from(`${apiId}:${apiSecret}`).toString('base64');
    const data = await fetchJson(`https://search.censys.io/api/v2/hosts/${ip}`, { 'Authorization': `Basic ${auth}` });
    if (data?.result?.services) {
      return data.result.services.map((svc: any) => ({
        port: svc.port, protocol: svc.transport_protocol?.toLowerCase() || 'tcp',
        service: svc.service_name || 'unknown', status: 'open', banner: svc.banner || '',
      }));
    }
  } catch (err) { console.log('[CENSYS] Error:', err); }
  return [];
}

// ============================================================================
// Port Scanning: nmap via port_audit.py (PRIMARY method — real TCP scan)
// ============================================================================
async function getPortsFromNmap(ip: string, profile: string = 'standard'): Promise<any[]> {
  const pythonPath = process.env.PYTHON_PATH || 'python3';
  const scriptsDir = process.env.SCRIPTS_DIR || './scripts';
  return new Promise((resolve) => {
    const timeout = profile === 'full' ? 300000 : 30000; // 30s max for quick
    const timer = setTimeout(() => { proc.kill(); resolve([]); }, timeout);
    const proc = spawn(pythonPath, [`${scriptsDir}/port_audit.py`, ip, '--profile', profile], {
      timeout,
    });
    let output = '';
    proc.stdout.on('data', (chunk) => output += chunk);
    proc.stderr.on('data', (chunk) => console.error(`[NMAP STDERR] ${chunk}`));
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          if (data.ports && Array.isArray(data.ports)) {
            resolve(data.ports.map((p: any) => {
              const parsed = parseBanner(p.banner || p.version || '', p.service || 'unknown');
              return {
                port: p.port,
                protocol: 'tcp',
                service: p.service || 'unknown',
                status: p.state === 'open' ? 'open' : p.state === 'closed' ? 'closed' : p.state === 'filtered' ? 'closed' : 'unknown',
                banner: p.banner || '',
                version: parsed.version,
                parsedService: parsed.service,
              };
            }));
            return;
          }
        } catch { /* fall through */ }
      }
      resolve([]);
    });
    proc.on('error', () => { clearTimeout(timer); resolve([]); });
  });
}

// Parse service version from nmap banner
function parseBanner(banner: string, defaultService: string): { service: string; version: string } {
  if (!banner || banner === 'unknown') return { service: defaultService, version: '' };

  const patterns: Array<{ regex: RegExp; service: string }> = [
    { regex: /OpenSSH[_\s]([\d.]+)/i, service: 'openssh' },
    { regex: /Apache[/\s]([\d.]+)/i, service: 'apache' },
    { regex: /nginx[/\s]?([\d.]+)/i, service: 'nginx' },
    { regex: /MySQL\s([\d.]+)/i, service: 'mysql' },
    { regex: /PostgreSQL\s([\d.]+)/i, service: 'postgresql' },
    { regex: /Redis\s+v?([\d.]+)/i, service: 'redis' },
    { regex: /MongoDB\s+v?([\d.]+)/i, service: 'mongodb' },
    { regex: /FTP\s+\(.*?([\d.]+)\)/i, service: 'ftp' },
    { regex: /vsftpd\s+([\d.]+)/i, service: 'vsftpd' },
    { regex: /ProFTPD\s+([\d.]+)/i, service: 'proftpd' },
    { regex: /Dovecot\s+([\d.]+)/i, service: 'dovecot' },
    { regex: /Exim\s+([\d.]+)/i, service: 'exim' },
    { regex: /Postfix\s+([\d.]+)/i, service: 'postfix' },
    { regex: /SMB\s+([\d.]+)/i, service: 'smb' },
    { regex: /Samba\s+([\d.]+)/i, service: 'samba' },
    { regex: /OpenSSL\s+([\d.]+)/i, service: 'openssl' },
    { regex: /PHP[/\s]?([\d.]+)/i, service: 'php' },
    { regex: /Python[/\s]?([\d.]+)/i, service: 'python' },
    { regex: /WordPress[/\s]?([\d.]+)/i, service: 'wordpress' },
    { regex: /Joomla[/\s]?([\d.]+)/i, service: 'joomla' },
  ];

  for (const p of patterns) {
    const match = banner.match(p.regex);
    if (match) {
      return { service: p.service, version: match[1] };
    }
  }

  // Generic version extraction: try to find any version-like pattern
  const genericMatch = banner.match(/v?([\d]+\.[\d]+(?:\.[\d]+)?)/);
  if (genericMatch) {
    return { service: defaultService.toLowerCase(), version: genericMatch[1] };
  }

  return { service: defaultService.toLowerCase(), version: '' };
}

// ============================================================================
// Reputation: AbuseIPDB
// ============================================================================
async function checkAbuseIPDB(ip: string): Promise<{ score: number; reports: number; clean: boolean; unverified?: boolean; details: string }> {
  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey) return { score: 0, reports: 0, clean: true, unverified: true, details: 'API key no configurada.' };
  try {
    const data = await fetchJson(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
      'Key': apiKey, 'Accept': 'application/json',
    });
    if (data?.data) {
      const score = data.data.abuseConfidenceScore || 0;
      const reports = data.data.totalReports || 0;
      return {
        score, reports, clean: score < 25,
        details: score > 50 ? `IP reportada ${reports} veces con confianza de abuso del ${score}%.` :
          score > 0 ? `IP tiene ${reports} reporte(s) con confianza de abuso del ${score}%.` :
            `IP limpia en AbuseIPDB. Sin reportes en los últimos 90 días.`
      };
    }
  } catch (err) { console.log('[ABUSEIPDB] Error:', err); }
  return { score: 0, reports: 0, clean: true, details: 'Error consultando AbuseIPDB.' };
}

// ============================================================================
// Reputation: VirusTotal
// ============================================================================
async function checkVirusTotal(ip: string): Promise<{ malicious: number; clean: boolean; unverified?: boolean; details: string }> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return { malicious: 0, clean: true, unverified: true, details: 'API key no configurada.' };
  try {
    const data = await fetchJson(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
      'x-apikey': apiKey, 'Accept': 'application/json',
    });
    if (data?.data?.attributes?.last_analysis_stats) {
      const stats = data.data.attributes.last_analysis_stats;
      const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
      return {
        malicious, clean: malicious === 0,
        details: malicious > 0 ? `${malicious} motor(es) detectan actividad maliciosa.` :
          `Análisis limpio: ${stats.harmless || 0} motores confirman IP segura.`
      };
    }
  } catch (err) { console.log('[VIRUSTOTAL] Error:', err); }
  return { malicious: 0, clean: true, details: 'Error consultando VirusTotal.' };
}

// ============================================================================
// AI: Groq (Llama/Mixtral) for executive reports
// ============================================================================
async function generateGroqReport(scanData: any): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return '';
  try {
    const data = await postJson('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Eres un analista senior de ciberseguridad. Genera informes ejecutivos precisos basados exclusivamente en los datos proporcionados. NO inventes información. Escribe en español profesional.' },
        { role: 'user', content: `Genera un informe ejecutivo de seguridad para la IP ${scanData.ip}. Datos:\n${JSON.stringify(scanData, null, 2)}\n\nEstructura: 1) Resumen ejecutivo, 2) Hallazgos críticos, 3) Recomendaciones prioritarias.` }
      ],
      max_tokens: 1500, temperature: 0.3,
    }, { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' });
    return data.choices?.[0]?.message?.content || '';
  } catch (err) { console.log('[GROQ] Error:', err); }
  return '';
}

// ============================================================================
// Geo lookup (server-side, for a specific IP provided by client)
// ============================================================================
async function getGeoForIp(ip: string): Promise<any> {
  const cached = authDb.getGeoFromCache(ip);
  if (cached) {
    console.log('[GEO] Cache hit for', ip);
    return { country: cached.country, countryCode: cached.countryCode, region: cached.region, city: cached.city, isp: cached.isp, cached: true };
  }
  try {
    const data = await fetchJson(`https://ipapi.co/${ip}/json/`);
    if (data && !data.error) {
      const geo = { country: data.country_name || 'N/A', countryCode: data.country_code || 'XX', region: data.region || 'N/A', city: data.city || 'N/A', isp: data.org || 'N/A' };
      authDb.saveGeoToCache(ip, geo);
      return geo;
    }
  } catch (err) { console.log('[GEO] Error:', err); }
  try {
    const r = await fetch(`https://ipinfo.io/${ip}/json`);
    if (r.ok) {
      const d = await r.json() as any;
      const geo = { country: d.country || 'N/A', countryCode: d.country || 'XX', region: d.region || 'N/A', city: d.city || 'N/A', isp: d.org || 'N/A' };
      authDb.saveGeoToCache(ip, geo);
      return geo;
    }
  } catch (err) { console.log('[GEO] ipinfo fallback error:', err); }
  return { country: 'N/A', countryCode: 'XX', region: 'N/A', city: 'N/A', isp: 'N/A' };
}

// ============================================================================
// Mail Sending via Resend API (no SMTP, no Gmail exposure)
// Free tier: 3,000 emails/month
// Get API key: https://resend.com/api-keys
// ============================================================================
async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[EMAIL] Resend API key no configurada. Email a ${to} no enviado.`);
    return false;
  }

  try {
    const data = await postJson('https://api.resend.com/emails', {
      from: process.env.RESEND_FROM || 'MyIP <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
      html,
    }, {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    });

    if (data?.id) {
      console.log(`[RESEND] Email enviado a ${to} (ID: ${data.id})`);
      return true;
    }
    console.log(`[RESEND] Error enviando email:`, data);
    return false;
  } catch (err) {
    console.error('[RESEND ERROR]', err);
    return false;
  }
}

// ============================================================================
// Express App
// ============================================================================
const app = express();
app.disable('x-powered-by'); // Fix: evita fuga "X-Powered-By: Express" (detectado por testssl.sh 08 Jul 2026)

const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  // X-Content-Type-Options se fija en Nginx (borde); duplicarlo aquí generaba
  // "misconfiguration: X-Content-Type-Options 2x" en testssl.sh (08 Jul 2026)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// ============================================================================
// Speedtest endpoints (para mediciones reales desde el navegador)
// ============================================================================
const speedTestData = Buffer.alloc(500_000, 0); // 500KB - test rápido y fiable

app.get('/api/speedtest/ping', (req, res) => {
  res.json({ t: Date.now() });
});

app.get('/api/speedtest/download', (req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.send(speedTestData);
});

app.get('/api/speedtest/dns', (req, res) => {
  res.json({ ok: true, t: Date.now() });
});

// In-memory database
interface DbUser {
  email: string; ipAddress: string;
  lastScanTime?: number; scanCount: number;
  verified: boolean; isGuest?: boolean;
}
const usersDb: Record<string, DbUser> = {};
// Hidratar cache en memoria desde SQLite al arrancar (sobrevive a reinicios)
for (const u of authDb.getAllUsers()) {
  usersDb[u.email] = {
    email: u.email, ipAddress: u.ipAddress,
    lastScanTime: u.lastScanTime, scanCount: u.scanCount,
    verified: u.verified, isGuest: u.isGuest,
  };
}
console.log(`[DB] ${authDb.getAllUsers().length} usuario(s) cargado(s) desde SQLite.`);
// Middleware de sesion: lee cookie, resuelve usuario real (no confia en el body)
function optionalAuth(req: any, res: any, next: any) {
  const token = req.cookies?.myip_session;
  if (token) {
    const su = authDb.getSessionUser(token);
    if (su) {
      req.authUser = su.email;
    }
  }
  next();
}
function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies?.myip_session;
  const su = token ? authDb.getSessionUser(token) : undefined;
  if (!su) return res.status(401).json({ error: 'No autenticado. Inicia sesion.' });
  req.authUser = su.email;
  next();
}

// ============================================================================
// Anti-Fraud: Rate limiting by IP + Fingerprint
// - Same IP: 1 scan per 24h
// - Same fingerprint: max 3 scans per 7 days (regardless of IP changes)
// - Combined: both limits apply — bypassing one still hits the other
// ============================================================================
interface RateRecord {
  count: number;
  firstScan: number;
  lastScan: number;
}

const ipRateLimit: Record<string, RateRecord> = {};
const fpRateLimit: Record<string, RateRecord> = {};

function checkRateLimit(ip: string, fingerprint: string, isGuest: boolean): { allowed: boolean; error?: string; hoursRemaining?: number } {
  const now = Date.now();

  // Guest: max 3 scans lifetime
  if (isGuest) {
    const fpRecord = fpRateLimit[fingerprint];
    if (fpRecord && fpRecord.count >= 3) {
      return { allowed: false, error: 'Límite de invitado alcanzado (3 escaneos). Crea una cuenta con email para continuar.' };
    }
  }

  // IP rate limit: 1 scan per 24h for free users (relaxed to 5 min in dev)
  const ipRecord = ipRateLimit[ip];
  if (ipRecord && !isGuest) {
    const hoursSince = (now - ipRecord.lastScan) / (1000 * 60 * 60);
    const limitHours = process.env.NODE_ENV === 'production' ? 24 : 0.083; // 5 min in dev
    if (hoursSince < limitHours) {
      const remaining = Math.ceil((limitHours - hoursSince) * 60);
      return { allowed: false, error: `Espera ${remaining} minuto(s) antes del próximo escaneo.`, hoursRemaining: remaining };
    }
  }

  // Fingerprint rate limit: max 3 scans per 7 days (relaxed in dev)
  const fpRecord = fpRateLimit[fingerprint];
  if (fpRecord) {
    const maxScans = process.env.NODE_ENV === 'production' ? 3 : 50;
    const daysWindow = process.env.NODE_ENV === 'production' ? 7 : 0.003; // ~5 min window in dev
    const daysSinceFirst = (now - fpRecord.firstScan) / (1000 * 60 * 60 * 24);
    if (daysSinceFirst < daysWindow && fpRecord.count >= maxScans) {
      return { allowed: false, error: 'Límite de escaneos alcanzado. Espera un momento o regístrate con email.' };
    }
    if (daysSinceFirst >= daysWindow) {
      fpRateLimit[fingerprint] = { count: 0, firstScan: now, lastScan: 0 };
    }
  }

  return { allowed: true };
}

function recordScan(ip: string, fingerprint: string) {
  const now = Date.now();

  // IP record
  if (!ipRateLimit[ip]) {
    ipRateLimit[ip] = { count: 0, firstScan: now, lastScan: 0 };
  }
  ipRateLimit[ip].count += 1;
  ipRateLimit[ip].lastScan = now;

  // Fingerprint record
  if (!fpRateLimit[fingerprint]) {
    fpRateLimit[fingerprint] = { count: 0, firstScan: now, lastScan: 0 };
  }
  fpRateLimit[fingerprint].count += 1;
  fpRateLimit[fingerprint].lastScan = now;
}

// ============================================================================
// Gemini client
// ============================================================================
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'myip-server' } } });
    console.log('Gemini API client initialized.');
  } catch (err) { console.error('Error initializing Gemini:', err); }
}

// ============================================================================
// API ROUTES
// ============================================================================
app.set('trust proxy', true);

// Detecta la IP real del visitante. Si hay proxy (Cloudflare/Nginx), usa la
// cabecera real. Si no (dev local), consulta ipify desde el propio servidor
// para evitar bloqueos de CORS/ETP en el navegador del cliente.
app.get('/api/ip/detect', async (req, res) => {
  try {
    const forwardedIp = (req.headers['cf-connecting-ip'] as string)
      || (req.headers['x-real-ip'] as string)
      || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();

    if (forwardedIp && !['127.0.0.1', '::1', '0.0.0.0'].includes(forwardedIp)) {
      return res.json({ ip: forwardedIp });
    }

    // Dev local o sin proxy: el servidor pregunta su propia IP publica
    const r = await fetch('https://api.ipify.org?format=json');
    if (!r.ok) throw new Error(`ipify respondio ${r.status}`);
    const data = await r.json() as { ip?: string };
    if (!data.ip) throw new Error('ipify sin campo ip');
    res.json({ ip: data.ip });
  } catch (e) {
    console.error('[IP DETECT] Error:', e);
    res.status(500).json({ ip: 'unknown' });
  }
});

// Geo-lookup: hecho server-side para evitar bloqueos de CORS/ETP en el
// navegador del cliente (mismo motivo que /api/ip/detect).
app.get('/api/geo/lookup', async (req, res) => {
  const ip = (req.query.ip as string || '').trim();
  if (!ip) return res.status(400).json({ error: 'Se requiere parametro ip.' });

  const cached = authDb.getGeoFromCache(ip);
  if (cached) {
    return res.json({ country: cached.country, countryCode: cached.countryCode, region: cached.region, city: cached.city, isp: cached.isp, cached: true });
  }

  let geoData: any = null;
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (r.ok) {
      const data = await r.json() as any;
      if (!data.error) {
        geoData = { country: data.country_name || 'Desconocido', countryCode: data.country_code || 'XX', region: data.region || 'Region desconocida', city: data.city || 'Ciudad desconocida', isp: data.org || 'ISP desconocido' };
      }
    }
  } catch (e) { console.warn('[GEO LOOKUP] ipapi.co fallo:', e); }

  if (!geoData) {
    try {
      const r2 = await fetch(`https://ipinfo.io/${ip}/json`);
      if (r2.ok) {
        const data2 = await r2.json() as any;
        geoData = { country: data2.country || 'Desconocido', countryCode: data2.country || 'XX', region: data2.region || 'Region desconocida', city: data2.city || 'Ciudad desconocida', isp: data2.org || 'ISP desconocido' };
      }
    } catch (e) { console.warn('[GEO LOOKUP] ipinfo.io fallo:', e); }
  }

  if (geoData) {
    authDb.saveGeoToCache(ip, geoData);
    return res.json({ ...geoData, cached: false });
  }

  res.status(502).json({ country: 'N/A', countryCode: 'XX', region: 'N/A', city: 'N/A', isp: 'N/A' });
});

// Auth: Registro real con contrasena (bcrypt). Rechaza si el email ya tiene cuenta.
app.post('/api/auth/register', async (req, res) => {
  const { email, password, clientIp } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Por favor, proporciona un correo electrónico válido.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (isCommonPassword(password)) {
    return res.status(400).json({
      error: 'Esa contraseña aparece en filtraciones de datos públicas conocidas. Por seguridad, elige una diferente.'
    });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (authDb.getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email. Inicia sesion en su lugar.' });
  }
  const stored = await authDb.createUserWithPassword(normalizedEmail, password, clientIp || 'pending');
  usersDb[normalizedEmail] = {
    email: stored.email, ipAddress: stored.ipAddress,
    scanCount: stored.scanCount, verified: stored.verified, isGuest: stored.isGuest
  };
  const token = authDb.createSession(normalizedEmail);
  res.cookie('myip_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
  console.log(`[AUTH] Nueva cuenta: ${normalizedEmail}`);

  // Email de bienvenida
  sendEmail({
    to: normalizedEmail,
    subject: 'Bienvenido a MyIP — Tu diagnóstico de red te espera',
    text: `Bienvenido a MyIP. Tu cuenta ha sido creada con éxito. Haz tu primer escaneo de seguridad ahora y descubre el estado de tu conexión.`,
    html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #4338ca;">Bienvenido a MyIP</h2>
      <p>Tu cuenta ha sido creada con éxito. Ahora puedes:</p>
      <ul>
        <li>Escanear tu IP pública en busca de puertos expuestos</li>
        <li>Verificar la reputación de tu IP en listas negras</li>
        <li>Obtener un diagnóstico completo de la seguridad de tu red</li>
      </ul>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${process.env.APP_URL || 'https://myip.viajeinteligencia.com'}" style="display: inline-block; background: #4338ca; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600;">Hacer mi primer escaneo</a>
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">MyIP &copy; 2026 SIEG — Herramienta de auditoría de seguridad</p>
    </div>`,
  });

  res.json({
    message: 'Cuenta creada. Tus escaneos se guardarán en esta cuenta.',
    user: { email: stored.email, ipAddress: stored.ipAddress, scanCount: stored.scanCount, isGuest: stored.isGuest }
  });
});
// Auth: Login real, verifica contrasena con bcrypt
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const ok = await authDb.verifyPassword(normalizedEmail, password);
  if (!ok) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }
  const stored = authDb.getUserByEmail(normalizedEmail)!;
  const token = authDb.createSession(normalizedEmail);
  res.cookie('myip_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
  console.log(`[AUTH] Login: ${normalizedEmail}`);
  res.json({
    message: 'Bienvenido de vuelta.',
    user: { email: stored.email, ipAddress: stored.ipAddress, scanCount: stored.scanCount, isGuest: stored.isGuest }
  });
});
// Auth: Logout, borra la sesion de la BD (no solo la cookie)
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.myip_session;
  if (token) authDb.deleteSession(token);
  res.clearCookie('myip_session');
  res.json({ message: 'Sesion cerrada.' });
});

// Auth: Delete account (RGPD Art. 17 - Right to erasure)
app.post('/api/auth/delete-account', optionalAuth, (req: any, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Debes iniciar sesión para eliminar tu cuenta.' });
  const email = req.authUser;
  
  // Remove from in-memory cache
  delete usersDb[email];
  
  // Remove from SQLite (user, sessions, scan history)
  try {
    authDb.deleteUserAccount(email);
  } catch (e) {
    console.error('[AUTH] Error eliminando cuenta:', e);
    return res.status(500).json({ error: 'Error interno al eliminar la cuenta.' });
  }
  
  res.clearCookie('myip_session');
  console.log(`[AUTH] Cuenta eliminada (RGPD): ${email}`);
  res.json({ message: 'Tu cuenta y todos tus datos han sido eliminados permanentemente.' });
});

// Acceso invitado: inmediato, sin datos personales
app.post('/api/auth/guest', async (req, res) => {
  const { clientIp } = req.body;
  const randomId = crypto.randomBytes(4).toString('hex');
  const guestEmail = `invitado_${randomId}@myip.local`;

  usersDb[guestEmail] = {
    email: guestEmail, ipAddress: clientIp || 'pending',
    scanCount: 0, verified: true, isGuest: true
  };

  res.json({
    message: 'Sesión de invitado iniciada. 3 escaneos gratuitos.',
    user: { email: guestEmail, ipAddress: clientIp || 'pending', scanCount: 0, isGuest: true }
  });
});

app.get('/api/admin/audit', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const expected = `Bearer ${process.env.ADMIN_SECRET || ''}`;
  if (!process.env.ADMIN_SECRET || authHeader !== expected) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  try {
    const stats = authDb.getSystemStats();
    const recentUsers = authDb.getAllUsers().slice(-10).map(u => ({
      email: u.email,
      ipAddress: u.ipAddress,
    }));
    res.json({ stats, recentUsers, checkedAt: new Date().toISOString() });
  } catch (e) {
    console.error('[ADMIN AUDIT] Error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});







// ============================================================================
// MAIN SCAN — Client MUST send targetIp. Server NEVER detects IP.
// ============================================================================
app.post('/api/scan', optionalAuth, async (req: any, res) => {
  const { targetIp, email } = req.body;
  if (!targetIp || typeof targetIp !== 'string' || !targetIp.trim()) {
    return res.status(400).json({ error: 'Se requiere targetIp. El cliente debe detectar su IP pública y enviarla.' });
  }
  const ip = targetIp.trim();
  if (!isPublicIp(ip)) {
    return res.status(400).json({ error: `No se permite escanear IPs privadas o internas (${ip}). Solo IPs públicas.` });
  }
  let user: DbUser | undefined;
  // Prioridad: sesion real (cookie verificada) sobre el email que mande el cliente en el body
  if (req.authUser) {
    const u = usersDb[req.authUser];
    if (u) user = u;
  } else if (email) {
    const u = usersDb[email.toLowerCase().trim()];
    if (u) user = u;
  }
  const isGuest = user?.isGuest ?? (user ? false : true);

  // [PATCH ip_address sync] Actualiza la IP conocida del usuario en cada scan
  // exitoso, para que el cron de alertas recurrentes deje de excluirlo por
  // tener ip_address = 'pending'.
  if (user) {
    const resolvedEmailForIp = req.authUser || (email ? String(email).toLowerCase().trim() : undefined);
    if (resolvedEmailForIp) {
      try {
        authDb.updateUserFields(resolvedEmailForIp, { ipAddress: ip });
      } catch (e) {
        console.error('[SCAN] No se pudo actualizar ip_address:', e);
      }
    }
  }

  // [Consent traceability] Log del consentimiento con timestamp + IP
  const clientIpForConsent = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  try {
    authDb.logConsent(req.authUser || email || undefined, clientIpForConsent, req.headers['user-agent']);
  } catch (e) {
    console.error('[SCAN] No se pudo registrar consentimiento:', e);
  }

  if (isGuest && user && user.scanCount >= 3) {
    return res.status(429).json({ error: 'Límite de invitado alcanzado (3/3). Crea una cuenta con email.', rateLimited: true, isGuestLimit: true });
  }

  // Development mode: NO rate limits at all
  if (process.env.NODE_ENV !== 'production') {
    // skip all rate limiting in dev
  } else {
    // Production: same rate limits for all users
    const fingerprint = req.headers['x-device-fingerprint'] || '';
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const limit = checkRateLimit(clientIp, fingerprint, isGuest);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.error, rateLimited: true });
    }
    recordScan(clientIp, fingerprint);
  }

  // --- PORT SCANNING via external APIs or direct nmap ---
  let ports: any[] = [];
  let portScanSource = '';

  // Strategy 1: Shodan (5s timeout)
  let shodanPorts: any[] = [];
  try { shodanPorts = await Promise.race([getPortsFromShodan(ip), new Promise<any[]>((r) => setTimeout(() => r([]), 5000))]); } catch { shodanPorts = []; }
  if (shodanPorts.length > 0) { ports = shodanPorts; portScanSource = 'Shodan'; }

  // Strategy 2: Censys (5s timeout)
  if (ports.length === 0) {
    let censysPorts: any[] = [];
    try { censysPorts = await Promise.race([getPortsFromCensys(ip), new Promise<any[]>((r) => setTimeout(() => r([]), 5000))]); } catch { censysPorts = []; }
    if (censysPorts.length > 0) { ports = censysPorts; portScanSource = 'Censys'; }
  }

  // Strategy 3: nmap direct scan (30s timeout)
  if (ports.length === 0) {
    let nmapPorts: any[] = [];
    try { nmapPorts = await Promise.race([getPortsFromNmap(ip, 'standard'), new Promise<any[]>((r) => setTimeout(() => r([]), 30000))]); } catch { nmapPorts = []; }
    if (nmapPorts.length > 0) { ports = nmapPorts; portScanSource = 'nmap (escaneo directo)'; }
  }

  // If ALL methods failed, show honest status — NEVER assume
  const scanFailed = ports.length === 0;

  // Ensure standard ports are present
  for (const stdPort of [22, 80, 443, 3306, 8080]) {
    if (!ports.some(p => p.port === stdPort)) {
      ports.push({ port: stdPort, protocol: 'tcp', service: 'not-scanned', status: scanFailed ? 'unknown' : 'closed' });
    }
  }

  const portDefinitions: Record<number, {
    service: string;
    openRisk: string;
    openExplanation: string;
    openRecommendation: string;
    closedExplanation: string;
    closedRecommendation: string;
    unknownExplanation: string;
    unknownRecommendation: string;
  }> = {
    22: {
      service: 'SSH (Secure Shell)',
      openRisk: 'high',
      openExplanation: 'El puerto SSH (22) está accesible desde internet. Los bots escanean constantemente este puerto para intentar acceso por fuerza bruta.',
      openRecommendation: 'Desactiva el login por contraseña. Usa llaves SSH (ed25519). Considera cambiar el puerto o restringir por IP en el firewall.',
      closedExplanation: 'El puerto SSH (22) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Si necesitas acceso remoto, usa una VPN en lugar de exponer SSH.',
      unknownExplanation: 'No se pudo verificar el estado del puerto SSH (22). Ningún método de escaneo está disponible actualmente.',
      unknownRecommendation: 'Para verificar este puerto, configura una API key de Shodan/Censys o instala nmap en el servidor.',
    },
    80: {
      service: 'HTTP (Tráfico Web No Cifrado)',
      openRisk: 'medium',
      openExplanation: 'El puerto HTTP (80) acepta conexiones sin cifrar. Cualquier dato enviado por este puerto viaja en texto plano.',
      openRecommendation: 'Configura una redirección 301 de HTTP a HTTPS (puerto 443). Usa Let\'s Encrypt para certificados gratuitos.',
      closedExplanation: 'El puerto HTTP (80) no está expuesto. El tráfico web no cifrado no es accesible desde internet.',
      closedRecommendation: 'No se requiere acción. Si hosting web, asegúrate de que todo el tráfico vaya por HTTPS (443).',
      unknownExplanation: 'No se pudo verificar el estado del puerto HTTP (80). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    443: {
      service: 'HTTPS (Tráfico Web Cifrado SSL/TLS)',
      openRisk: 'low',
      openExplanation: 'El puerto HTTPS (443) está abierto. Esto es normal y necesario si hosting web con cifrado SSL/TLS.',
      openRecommendation: 'Verifica que tu certificado SSL esté vigente y usa TLS 1.2 o superior. Desactiva TLS 1.0 y 1.1.',
      closedExplanation: 'El puerto HTTPS (443) no está expuesto. Si no hosting web, esto es correcto.',
      closedRecommendation: 'Si ofreces servicios web, considera activar HTTPS con un certificado gratuito de Let\'s Encrypt.',
      unknownExplanation: 'No se pudo verificar el estado del puerto HTTPS (443). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    3306: {
      service: 'MySQL Database',
      openRisk: 'high',
      openExplanation: '¡Crítico! El puerto MySQL (3306) está expuesto a internet. Cualquiera puede intentar conectarse a tu base de datos.',
      openRecommendation: 'Cierra este puerto inmediatamente en el firewall. Configura MySQL para escuchar solo en 127.0.0.1 (bind-address = 127.0.0.1).',
      closedExplanation: 'El puerto MySQL (3306) no es accesible desde internet. Tu base de datos está protegida de accesos externos.',
      closedRecommendation: 'No se requiere acción. Las bases de datos nunca deben exponerse al internet público.',
      unknownExplanation: 'No se pudo verificar el estado del puerto MySQL (3306). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    8080: {
      service: 'HTTP Alternate / Panel Admin',
      openRisk: 'medium',
      openExplanation: 'El puerto alternativo HTTP (8080) está abierto. Suele usarse para paneles de administración o servicios de desarrollo.',
      openRecommendation: 'Asegura este servicio con autenticación fuerte. Si no lo necesitas, ciérralo en el firewall.',
      closedExplanation: 'El puerto alternativo HTTP (8080) no está expuesto. Correcto si no necesitas servicios en este puerto.',
      closedRecommendation: 'No se requiere acción.',
      unknownExplanation: 'No se pudo verificar el estado del puerto HTTP alternativo (8080). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    139: {
      service: 'NetBIOS (Compartición de Archivos Windows)',
      openRisk: 'high',
      openExplanation: 'El puerto NetBIOS (139) está expuesto a internet. Este servicio permite listar y acceder a carpetas compartidas de Windows y nunca debería ser accesible desde fuera de tu red local.',
      openRecommendation: 'Bloquea este puerto en tu router/firewall inmediatamente. La compartición de archivos debe limitarse a tu red local, nunca exponerse a internet.',
      closedExplanation: 'El puerto NetBIOS (139) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Mantén la compartición de archivos solo en tu red local.',
      unknownExplanation: 'No se pudo verificar el estado del puerto NetBIOS (139). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    445: {
      service: 'SMB / Samba (Compartición de Archivos)',
      openRisk: 'high',
      openExplanation: '¡Crítico! El puerto SMB/Samba (445) está expuesto a internet. Cualquiera podría intentar listar o acceder a tus carpetas compartidas, e incluso explotar vulnerabilidades conocidas de SMB (como WannaCry).',
      openRecommendation: 'Bloquea este puerto en tu router/firewall de inmediato. SMB nunca debe exponerse a internet; úsalo solo dentro de tu red local o mediante VPN.',
      closedExplanation: 'El puerto SMB/Samba (445) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Mantén la compartición de archivos solo en tu red local.',
      unknownExplanation: 'No se pudo verificar el estado del puerto SMB/Samba (445). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    631: {
      service: 'IPP (Impresora de Red)',
      openRisk: 'medium',
      openExplanation: 'El puerto de impresión IPP (631) está expuesto a internet. Cualquiera podría enviar trabajos de impresión a tu impresora o, en algunos modelos, acceder a su panel de configuración.',
      openRecommendation: 'Bloquea este puerto en tu router/firewall. Las impresoras deben ser accesibles solo desde tu red local.',
      closedExplanation: 'El puerto de impresión IPP (631) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Mantén tu impresora accesible solo en tu red local.',
      unknownExplanation: 'No se pudo verificar el estado del puerto IPP (631). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    9100: {
      service: 'JetDirect (Impresora de Red)',
      openRisk: 'medium',
      openExplanation: 'El puerto JetDirect (9100), usado por muchas impresoras de red, está expuesto a internet. Cualquiera podría enviar trabajos de impresión directamente a tu impresora.',
      openRecommendation: 'Bloquea este puerto en tu router/firewall. Las impresoras deben ser accesibles solo desde tu red local.',
      closedExplanation: 'El puerto JetDirect (9100) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Mantén tu impresora accesible solo en tu red local.',
      unknownExplanation: 'No se pudo verificar el estado del puerto JetDirect (9100). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    515: {
      service: 'LPD (Impresora de Red)',
      openRisk: 'medium',
      openExplanation: 'El puerto de impresión LPD (515) está expuesto a internet. Cualquiera podría enviar trabajos de impresión a tu impresora.',
      openRecommendation: 'Bloquea este puerto en tu router/firewall. Las impresoras deben ser accesibles solo desde tu red local.',
      closedExplanation: 'El puerto de impresión LPD (515) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Mantén tu impresora accesible solo en tu red local.',
      unknownExplanation: 'No se pudo verificar el estado del puerto LPD (515). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    5900: {
      service: 'VNC (Escritorio Remoto)',
      openRisk: 'high',
      openExplanation: '¡Atención! El puerto VNC (5900) está expuesto a internet. Esto permite a cualquiera intentar tomar control remoto de tu equipo, muchas veces con contraseñas débiles o inexistentes por defecto.',
      openRecommendation: 'Bloquea este puerto en tu router/firewall inmediatamente. Si necesitas escritorio remoto, usa una VPN en lugar de exponer VNC directamente.',
      closedExplanation: 'El puerto VNC (5900) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Si necesitas acceso remoto, usa una VPN en lugar de exponer VNC.',
      unknownExplanation: 'No se pudo verificar el estado del puerto VNC (5900). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
    23: {
      service: 'Telnet (Acceso Remoto sin Cifrar)',
      openRisk: 'high',
      openExplanation: '¡Crítico! El puerto Telnet (23) está expuesto a internet. Telnet transmite usuario y contraseña en texto plano, sin ningún cifrado — es uno de los puertos más buscados por bots maliciosos.',
      openRecommendation: 'Cierra este puerto de inmediato. Usa SSH (puerto 22) en su lugar, que sí cifra la conexión.',
      closedExplanation: 'El puerto Telnet (23) no es accesible desde internet. Correcto para equipos domésticos.',
      closedRecommendation: 'No se requiere acción. Nunca deberías necesitar Telnet expuesto a internet.',
      unknownExplanation: 'No se pudo verificar el estado del puerto Telnet (23). Ningún método de escaneo está disponible.',
      unknownRecommendation: 'Configura Shodan, Censys o nmap para verificar este puerto.',
    },
  };

  const enrichedPorts = ports.map((p: any) => {
    const def = portDefinitions[p.port];
    const isOpen = p.status === 'open';
    const isUnknown = p.status === 'unknown';

    let service: string;
    let risk: string;
    let explanation: string;
    let recommendation: string;

    if (def) {
      service = def.service;
      if (isUnknown) {
        risk = 'low';
        explanation = def.unknownExplanation;
        recommendation = def.unknownRecommendation;
      } else {
        risk = isOpen ? def.openRisk : 'low';
        explanation = isOpen ? def.openExplanation : def.closedExplanation;
        recommendation = isOpen ? def.openRecommendation : def.closedRecommendation;
      }
    } else {
      service = p.service || `Puerto ${p.port}`;
      if (isUnknown) {
        risk = 'low';
        explanation = `Puerto ${p.port}: no se pudo verificar el estado real. Ningún método de escaneo está disponible.`;
        recommendation = 'Configura Shodan, Censys o nmap para obtener datos reales.';
      } else {
        risk = isOpen ? 'medium' : 'low';
        explanation = isOpen
          ? `El puerto ${p.port} (${service}) está accesible desde internet. Verifica si este servicio necesita estar expuesto.`
          : `El puerto ${p.port} no es accesible desde internet.`;
        recommendation = isOpen
          ? `Verifica si el servicio en el puerto ${p.port} necesita estar expuesto públicamente. Si no es necesario, ciérralo en el firewall.`
          : 'No se requiere acción.';
      }
    }

    return { port: p.port, service, status: isUnknown ? 'unknown' : (isOpen ? 'open' : 'closed'), risk, explanation, recommendation, banner: p.banner || null, version: p.version || p.parsedService?.version || null, cveService: p.parsedService?.service || null, protocol: p.protocol || 'tcp' };
  });

  console.log(`[SCAN] IP: ${ip} | Puertos: ${enrichedPorts.length} | Fuente: ${portScanSource || 'NINGUNA - sin verificación posible'}`);

  // --- REPUTATION (with 8s timeout) ---
  const dnsblServers = (process.env.DNSBL_SERVERS || 'zen.spamhaus.org,b.barracudacentral.org').split(',');
  let reputation: any[] = [];
  try {
    const dnsblResults = await Promise.race([
      Promise.all(dnsblServers.map(async (server) => {
        const clean = await checkDNSBL(ip, server.trim());
        const name = server.trim() === 'zen.spamhaus.org' ? 'Spamhaus ZEN' :
          server.trim() === 'b.barracudacentral.org' ? 'Barracuda RBL' :
            server.trim() === 'dnsbl.httpbl.org' ? 'Project Honey Pot' :
              server.trim() === 'bl.score.senderscore.com' ? 'SenderScore' : server.trim();
        return { listName: name, clean, details: clean ? `IP limpia en ${name}.` : `IP detectada en ${name}.` };
      })),
      new Promise<any[]>((_, rej) => setTimeout(() => rej(new Error('DNSBL timeout')), 8000))
    ]);
    reputation = dnsblResults;

    const abuse = await Promise.race([
      checkAbuseIPDB(ip),
      new Promise((_, rej) => setTimeout(() => rej(new Error('AbuseIPDB timeout')), 5000))
    ]);
    reputation.push({ listName: 'AbuseIPDB', clean: (abuse as any).clean, unverified: (abuse as any).unverified, details: (abuse as any).details, score: (abuse as any).score });
  } catch (err) {
    console.log('[REPUTATION] Partial:', err);
    if (reputation.length === 0) {
      reputation = [{ listName: 'Spamhaus ZEN', clean: true, unverified: true, details: 'Consulta no disponible.' }, { listName: 'AbuseIPDB', clean: true, unverified: true, details: 'Consulta no disponible.' }];
    }
  }

  const vt = await checkVirusTotal(ip);
  reputation.push({ listName: 'VirusTotal', clean: vt.clean, unverified: vt.unverified, details: vt.details, malicious: vt.malicious });

  // --- SSL ---
  let sslInfo: any = null;
  try { sslInfo = await checkSSL(ip); } catch (err) { console.log('[SSL] Error:', err); }

  // --- SCORE: Separate port risk from reputation risk ---
  let score: 'green' | 'yellow' | 'red' = 'green';
  let scoreReason = '';

  const openHighRisk = enrichedPorts.filter(p => p.status === 'open' && p.risk === 'high').length;
  const openMedRisk = enrichedPorts.filter(p => p.status === 'open' && p.risk === 'medium').length;
  const unknownPorts = enrichedPorts.filter(p => p.status === 'unknown').length;
  const blacklisted = reputation.filter(r => !r.clean).length;

  if (openHighRisk > 0) {
    score = 'red';
    scoreReason = `${openHighRisk} puerto(s) de alto riesgo expuesto(s) al internet público.`;
  } else if (blacklisted > 0) {
    score = 'yellow';
    scoreReason = `IP aparece en ${blacklisted} lista(s) negras de reputación. Los puertos están protegidos, pero la reputación de la IP necesita atención.`;
  } else if (openMedRisk > 0) {
    score = 'yellow';
    scoreReason = `${openMedRisk} puerto(s) de riesgo medio expuesto(s). Se recomienda revisar la configuración.`;
  } else if (unknownPorts > 0 && openHighRisk === 0 && openMedRisk === 0) {
    // All ports unknown — honest status
    score = 'yellow';
    scoreReason = `${unknownPorts} puerto(s) no pudieron verificarse. Sin datos reales de escaneo no se puede confirmar el estado de seguridad.`;
  } else {
    score = 'green';
    scoreReason = 'Todos los puertos verificados están protegidos. No se detectaron problemas de exposición.';
  }

  // --- SCORE NUMERICO 0-100 (mismas señales que el score categorico) ---
  let scoreNumeric = 100;
  scoreNumeric -= openHighRisk * 40;
  scoreNumeric -= openMedRisk * 15;
  scoreNumeric -= blacklisted * 20;
  scoreNumeric -= unknownPorts * 5;
  scoreNumeric = Math.max(0, Math.min(100, scoreNumeric));

  // --- GEO ---
  const geo = await getGeoForIp(ip);

  // --- ANALYSIS: Static analysis only (Gemini quota exceeded, removed) ---
  let analysisText = '';
  let grokReport = '';
  const portBullets = enrichedPorts.map(p => {
    const icon = p.status === 'open' ? '🔓 ABIERTO' : p.status === 'unknown' ? '❓ SIN VERIFICAR' : '🔒 CERRADO';
    return `* **Puerto ${p.port} (${p.service})**: ${icon}. ${p.explanation}`;
  }).join('\n');
  const blackBullets = reputation.map(r => `* **${r.listName}**: ${r.unverified ? '⚪ Sin verificar' : r.clean ? '✅ Limpia' : '❌ ' + r.details}`).join('\n');

  analysisText = `
### 1. Resumen de la IP
- **IP**: ${ip}
- **Ubicación**: ${geo.city}, ${geo.region}, ${geo.country}
- **ISP**: ${geo.isp}
- **Estado**: ${score.toUpperCase()} — ${scoreReason}
- **Fuente**: ${portScanSource || 'Escaneo directo con nmap'}

### 2. Estado de Puertos
${portBullets}

### 3. Reputación de la IP
${blackBullets}
${sslInfo ? `\n### 4. Certificado SSL\n- **Estado**: ${sslInfo.valid ? 'Válido' : 'Inválido'}\n- **Emisor**: ${sslInfo.issuer}\n- **Expira**: ${sslInfo.validTo} (${sslInfo.daysToExpiry} días)\n${sslInfo.alert ? '- **Alerta**: ' + sslInfo.alert : ''}` : ''}

### 4. Recomendaciones
${openHighRisk > 0 ? '- **URGENTE**: Cierra los puertos de alto riesgo expuestos en tu firewall inmediatamente.' : ''}
${blacklisted > 0 ? '- **Reputación**: Investiga por qué tu IP aparece en listas negras. Verifica que ningún malware use tu conexión.' : ''}
${openMedRisk > 0 ? '- **Precaución**: Revisa los puertos de riesgo medio expuestos y asegúralos con autenticación fuerte.' : ''}
${score === 'green' ? '- **Mantenimiento**: Realiza escaneos periódicos para verificar que la configuración se mantiene segura.' : ''}
- **General**: Mantén tu router y firmware actualizados. Usa contraseñas robustas en todos los servicios expuestos.
`;

  const now = Date.now();
  if (user) {
    user.lastScanTime = now; user.scanCount += 1;


    // Email del primer scan
    if (user.scanCount === 1) {
      sendEmail({
        to: user.email,
        subject: `MyIP — Tu primer análisis de ${ip} está listo`,
        text: `Tu primer análisis de la IP ${ip} ha completado. Estado: ${score.toUpperCase()}. Inicia sesión en MyIP para ver los detalles completos.`,
        html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #4338ca;">Tu primer análisis está listo</h2>
          <p><strong>IP analizada:</strong> ${ip}</p>
          <p><strong>Estado:</strong> ${score.toUpperCase()} — ${scoreReason}</p>
          ${analysisText ? `<div style="background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 13px; line-height: 1.6; margin-top: 12px;">${analysisText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.*)/g, '<h4 style="margin: 12px 0 4px; color: #4338ca;">$1</h4>').replace(/\n/g, '<br>')}</div>` : ''}
          <p style="text-align: center; margin-top: 24px;">
            <a href="${process.env.APP_URL || 'https://myip.viajeinteligencia.com'}" style="display: inline-block; background: #4338ca; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600;">Ver análisis completo</a>
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">MyIP &copy; 2026 SIEG — Herramienta de auditoría de seguridad</p>
        </div>`,
      });
    }
  }

  // Save to scan history for logged-in users
  let noChanges = false;
  let daysSinceLastScan: number | null = null;
  let detectedChanges: string[] = [];
  if (user) {
    try {
      const prevHistory = authDb.getScanHistory(user.email, 1);
      if (prevHistory.length > 0) {
        const prev = prevHistory[0] as any;
        const cmp = compareScans(prev, {
          score_numeric: scoreNumeric,
          ports_json: JSON.stringify(enrichedPorts),
          reputation_json: JSON.stringify(reputation),
        });
        noChanges = !cmp.hasChanges;
        daysSinceLastScan = Math.floor((now - prev.created_at) / (1000 * 60 * 60 * 24));
        detectedChanges = cmp.changes;
      }
      authDb.saveScanRecord(user.email, {
        targetIp: ip, score, scoreReason,
        ports: enrichedPorts, reputation, analysisText,
        scanSource: portScanSource, geo, scoreNumeric,
      });
    } catch (err) { console.log('[HISTORY] Save error:', err); }
  }

  res.json({
    ip, timestamp: now, score, scoreReason, scoreNumeric, ports: enrichedPorts, reputation, sslInfo,
    analysisText, grokReport: grokReport || undefined, scanSource: portScanSource, geo,
    noChanges, daysSinceLastScan, changes: detectedChanges,
    communityAverage: authDb.getCommunityStats().avgScore,
  });
});

// Scan History
app.get('/api/security/kpis', (req, res) => {
  try {
    const kpis = getSecurityKpis();
    res.json(kpis);
  } catch (e: any) {
    console.error('Error fetching security KPIs:', e);
    res.status(500).json({ error: 'No se pudieron obtener los KPIs de seguridad' });
  }
});

// ──────────────────────────────────────────────
// Threat Map SSE + snapshots (fail2ban en tiempo real)
// ──────────────────────────────────────────────
const THREAT_NOTIFY_SECRET = process.env.THREAT_NOTIFY_SECRET || 'gen-fail2ban-secret';
const sseClients: Set<import('express').Response> = new Set();

// SSE endpoint — clientes se conectan y reciben eventos en tiempo real
app.get('/api/threat/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('data: {"connected":true}\n\n');
  sseClients.add(res);
  console.log(`[SSE] Cliente conectado (total: ${sseClients.size})`);
  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[SSE] Cliente desconectado (total: ${sseClients.size})`);
  });
});

// Notify — el script gen-fail2ban-geo.sh llama aquí tras generar nuevo JSON
app.post('/api/threat/notify', (req, res) => {
  const { secret, total_ips, total_bans } = req.body;
  if (secret !== THREAT_NOTIFY_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  const payload = JSON.stringify({ updated: true, total_ips, total_bans, timestamp: Date.now() });
  let count = 0;
  sseClients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
      count++;
    } catch { sseClients.delete(client); }
  });
  console.log(`[NOTIFY] broadcast a ${count} clientes: ${total_ips} IPs, ${total_bans} bans`);
  res.json({ ok: true, clients: count });
});

// Lista de snapshots disponibles para el timeline
app.get('/api/threat/timeline', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const snapDir = process.env.SNAP_DIR || '/app/data/snapshots';
  try {
    if (!fs.existsSync(snapDir)) return res.json({ snapshots: [] });
    const files = fs.readdirSync(snapDir)
      .filter((f: string) => f.endsWith('.json'))
      .sort()
      .map((f: string) => ({
        file: f,
        data: JSON.parse(fs.readFileSync(path.join(snapDir, f), 'utf-8')),
        mtime: fs.statSync(path.join(snapDir, f)).mtimeMs
      }));
    res.json({ snapshots: files });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats/community', (req, res) => {
  const stats = authDb.getSystemStats();
  const community = authDb.getCommunityStats();
  const distribution = authDb.getScoreDistribution();
  res.json({
    totalScans: stats.totalScans,
    totalUsers: stats.totalUsers,
    avgScore: community.avgScore,
    totalScored: community.totalScored,
    distribution,
  });
});

// User Specific Stats
app.get('/api/stats/user', (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: 'Email requerido.' });
  const userStats = authDb.getUserScoreDistribution(email.toLowerCase().trim());
  res.json(userStats);
});

// Estadísticas anonimizadas (GDPR Art. 89 — sin PII)
app.get('/api/stats/anonymized', (req, res) => {
  try {
    const stats = authDb.getAnonymizedStats();
    res.json(stats);
  } catch (e) {
    console.error('Error fetching anonymized stats:', e);
    res.status(500).json({ error: 'No se pudieron obtener las estadísticas anonimizadas' });
  }
});

app.get('/api/stats/trends', (req, res) => {
  try {
    const trends = authDb.getWeeklyTrends();
    res.json({ trends });
  } catch (e) {
    console.error('Error fetching weekly trends:', e);
    res.status(500).json({ error: 'No se pudieron obtener las tendencias semanales' });
  }
});

// Advanced Tools: DNS Leak Test
app.get('/api/tools/dns-leak', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  res.json({
    ip: clientIp,
    isLeaking: false,
    resolver: clientIp,
    org: 'MyIP Server Detection'
  });
});

// Advanced Tools: SSL Auditor
app.get('/api/tools/ssl-check', (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Dominio requerido.' });
  
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  
  // Configuración explícita de SNI para evitar falsos positivos en subdominios
  const socket = tls.connect({ 
    port: 443, 
    host: cleanDomain, 
    servername: cleanDomain, 
    rejectUnauthorized: false 
  }, () => {
    const cert = socket.getPeerCertificate();
    const cipher = socket.getCipher();
    const now = new Date();
    const expiry = new Date(cert.valid_to);
    const daysLeft = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    socket.end();

    // Si hay error de autorización, lo reportamos como advertencia, no como fallo de conexión
    const isValid = socket.authorized;
    const reason = socket.authorizationError;

    res.json({
      valid: isValid,
      issuer: cert.issuer?.O || cert.issuer?.CN || 'Desconocido',
      daysLeft,
      cipher: cipher?.name || 'Unknown',
      validTo: cert.valid_to,
      reason: isValid ? undefined : reason
    });
  });
  
  socket.on('error', (err) => {
    res.json({ error: `No se pudo conectar: ${err.message}` });
  });
  
  socket.setTimeout(5000, () => {
    socket.destroy();
    res.json({ error: 'Tiempo de espera agotado.' });
  });
});

// Advanced Tools: URL Threat Scanner (VirusTotal)
app.post('/api/tools/url-scan', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida.' });
  
  const vtApiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!vtApiKey) return res.status(500).json({ error: 'Servicio no configurado.' });

  try {
    // 1. Calcular ID de la URL (SHA256 sin el path, según docs de VT)
    // Nota: VT v3 usa el hash de la URL completa codificada en base64 sin padding para el ID
    const urlId = Buffer.from(url).toString('base64url');

    // 2. Intentar obtener reporte
    const vtRes = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': vtApiKey }
    });

    if (vtRes.status === 404) {
      // 3. Si no existe, enviar para análisis
      const submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: { 'x-apikey': vtApiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}`
      });
      
      if (!submitRes.ok) throw new Error('Error al enviar URL a VirusTotal');
      return res.json({ status: 'submitted', message: 'URL enviada para análisis. Resultados en unos minutos.' });
    }

    if (!vtRes.ok) throw new Error('Error consultando VirusTotal');

    const data = await vtRes.json();
    const stats = data.data.attributes.last_analysis_stats;
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;

    res.json({
      status: 'analyzed',
      malicious,
      suspicious,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      lastAnalysisDate: new Date(data.data.attributes.last_analysis_date * 1000).toLocaleDateString()
    });

  } catch (e: any) {
    res.json({ error: e.message || 'Error escaneando URL.' });
  }
});

// Advanced Tools: IP Info & VPN Check
app.get('/api/tools/ip-info', (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
  
  // Reverse DNS para ver si es un datacenter/VPN conocido
  dns.reverse(clientIp, (err, hostnames) => {
    const isSuspicious = hostnames?.some(h => /vpn|proxy|cloud|aws|azure|digitalocean|hetzner|ovh|server/i.test(h)) || false;
    
    res.json({
      ip: clientIp,
      hostnames: hostnames || [],
      isLikelyVpn: isSuspicious
    });
  });
});

// Advanced Tools: External Port Tester
app.post('/api/tools/port-test', (req, res) => {
  const { port } = req.body;
  if (!port) return res.status(400).json({ error: 'Puerto requerido.' });
  
  // SECURITY: nunca aceptar un target IP externo del body (patron canyouseeme.org).
  // Solo se permite auto-escaneo del propio solicitante.
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
  const ipToTest = clientIp;
  
  const socket = net.connect({ host: ipToTest, port: parseInt(port), timeout: 5000 }, () => {
    socket.end();
    res.json({ status: 'open', ip: ipToTest, port: parseInt(port) });
  });
  
  socket.on('error', (err: any) => {
    if (err.code === 'ECONNREFUSED') {
      res.json({ status: 'closed', ip: ipToTest, port: parseInt(port) });
    } else if (err.code === 'ETIMEDOUT') {
      res.json({ status: 'filtered', ip: ipToTest, port: parseInt(port) });
    } else {
      res.json({ status: 'error', message: err.message });
    }
  });
  
  socket.setTimeout(5000, () => {
    socket.destroy();
    res.json({ status: 'filtered', ip: ipToTest, port: parseInt(port) });
  });
});

// Advanced Tools: IP Reputation (VirusTotal)
app.get('/api/tools/ip-reputation', async (req, res) => {
  const ip = req.query.ip as string;
  const vtApiKey = process.env.VIRUSTOTAL_API_KEY;
  
  if (!ip) return res.status(400).json({ error: 'IP requerida.' });
  if (!vtApiKey) return res.status(500).json({ error: 'Servicio no configurado.' });

  try {
    const vtRes = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
      headers: { 'x-apikey': vtApiKey }
    });

    if (!vtRes.ok) throw new Error('Error consultando VirusTotal');

    const data = await vtRes.json();
    const stats = data.data.attributes.last_analysis_stats;
    const reputation = data.data.attributes.reputation;
    const country = data.data.attributes.country || 'Desconocido';
    const asOwner = data.data.attributes.as_owner || 'Desconocido';
    
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    
    res.json({
      ip,
      malicious,
      suspicious,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      reputation,
      country,
      asOwner,
      lastAnalysisDate: new Date(data.data.attributes.last_analysis_date * 1000).toLocaleDateString()
    });
  } catch (e: any) {
    res.json({ error: e.message || 'Error verificando reputación.' });
  }
});

// Advanced Tools: Security Header Analyzer
app.get('/api/tools/header-check', async (req, res) => {
  let url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'URL requerida.' });
  if (!url.startsWith('http')) url = 'https://' + url;
  
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Analysis
    const checks = {
      hsts: !!headers['strict-transport-security'],
      csp: !!headers['content-security-policy'],
      xFrameOptions: !!headers['x-frame-options'],
      xContentType: headers['x-content-type-options'] === 'nosniff',
      referrerPolicy: !!headers['referrer-policy'],
      permissionsPolicy: !!headers['permissions-policy'],
      server: headers['server'] || 'Hidden',
    };
    
    // Simple Grading
    let score = 0;
    if (checks.hsts) score++;
    if (checks.csp) score++;
    if (checks.xFrameOptions) score++;
    if (checks.xContentType) score++;
    if (checks.referrerPolicy) score++;
    if (checks.permissionsPolicy) score++;
    
    let grade = 'F';
    if (score === 6) grade = 'A';
    else if (score >= 4) grade = 'B';
    else if (score >= 2) grade = 'C';
    else grade = 'D';
    
    res.json({ grade, checks, headers });
  } catch (e: any) {
    res.json({ error: `No se pudo acceder: ${e.message}` });
  }
});

// Advanced Tools: CVE Lookup (NVD API + Vulners fallback)
app.post('/api/tools/cve-lookup', async (req, res) => {
  const { service, version, port } = req.body;
  if (!service || !version) return res.status(400).json({ error: 'Service y version requeridos.' });

  try {
    // Check cache first
    const cached = authDb.getCveFromCache(service, version);
    if (cached) {
      return res.json({ source: 'cache', service: cached.service, version: cached.version, port: cached.port, cves: cached.cves, cvssMax: cached.cvssMax, cveCount: cached.cveCount, cachedAt: cached.fetchedAt });
    }

    // Try NVD API first
    let cves: authDb.CveEntry[] = [];
    let source = 'nvd';
    try {
      cves = await fetchFromNVD(service, version);
    } catch (e) {
      console.log(`[CVE] NVD failed for ${service} ${version}, trying Vulners...`);
    }

    // Fallback to Vulners if NVD returned nothing
    if (cves.length === 0) {
      try {
        cves = await fetchFromVulners(service, version);
        source = 'vulners';
      } catch (e) {
        console.log(`[CVE] Vulners also failed for ${service} ${version}`);
      }
    }

    // Filter: only CVSS >= 5.0 (medium+)
    cves = cves.filter(c => c.cvssScore >= 5.0);

    // Sort by CVSS descending
    cves.sort((a, b) => b.cvssScore - a.cvssScore);

    // Cache results
    authDb.saveCveToCache(service, version, port || 0, cves);

    const cvssMax = cves.length > 0 ? Math.max(...cves.map(c => c.cvssScore)) : 0;

    res.json({ source, service, version, port, cves, cvssMax, cveCount: cves.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error buscando CVEs.' });
  }
});

async function fetchFromNVD(service: string, version: string): Promise<authDb.CveEntry[]> {
  // Map common service names to CPE product names
  const cpeMap: Record<string, string> = {
    'openssh': 'openbsd:openssh',
    'ssh': 'openbsd:openssh',
    'apache': 'apache:http_server',
    'apache_http': 'apache:http_server',
    'nginx': 'nginx:nginx',
    'mysql': 'oracle:mysql',
    'postgresql': 'postgresql:postgresql',
    'redis': 'redis:redis',
    'mongodb': 'mongodb:mongodb',
    'ftp': 'proftpd:proftpd',
    'vsftpd': 'vsftpd:vsftpd',
    'proftpd': 'proftpd:proftpd',
    'dovecot': 'dovecot:dovecot',
    'exim': 'exim:exim',
    'postfix': 'postfix:postfix',
    'smb': 'microsoft:smb',
    'samba': 'samba:samba',
    'openssl': 'openssl:openssl',
    'php': 'php:php',
    'python': 'python:python',
    'wordpress': 'wordpress:wordpress',
    'joomla': 'joomla:joomla',
    'tomcat': 'apache:tomcat',
    'elasticsearch': 'elastic:elasticsearch',
  };

  const cpeProduct = cpeMap[service.toLowerCase()] || `${service}:${service}`;
  const cpeName = `cpe:2.3:a:${cpeProduct}:${version}:*:*:*:*:*:*:*`;
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName=${encodeURIComponent(cpeName)}`;
  
  const headers: Record<string, string> = { 'User-Agent': 'MyIP-Security-Scanner/1.0' };
  const nvdApiKey = process.env.NVD_API_KEY;
  if (nvdApiKey) headers['apiKey'] = nvdApiKey;
  
  const res = await fetch(url, { headers });
  
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log(`[CVE] NVD HTTP ${res.status}: ${body.substring(0, 200)}`);
    throw new Error(`NVD API error: ${res.status}`);
  }
  
  const data = await res.json();
  const vulnerabilities = data.vulnerabilities || [];
  
  console.log(`[CVE] NVD returned ${vulnerabilities.length} results for ${cpeName}`);
  
  return vulnerabilities.map((v: any) => {
    const cve = v.cve;
    const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];
    const cvss = metrics?.cvssData;
    const desc = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || cve.descriptions?.[0]?.value || '';
    
    return {
      id: cve.id,
      sourceIdentifier: cve.sourceIdentifier,
      published: cve.published,
      modified: cve.lastModified,
      description: desc.substring(0, 300),
      cvssScore: cvss?.baseScore || 0,
      cvssVector: cvss?.versionString,
      severity: cvss?.baseSeverity || 'UNKNOWN',
      url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
    };
  });
}

async function fetchFromVulners(service: string, version: string): Promise<authDb.CveEntry[]> {
  const url = 'https://vulners.com/api/v3/search/lucene/';
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `${service} ${version}`,
      size: 50
    })
  });
  
  if (!res.ok) throw new Error(`Vulners API error: ${res.status}`);
  
  const data = await res.json();
  if (!data.data?.search) return [];
  
  return data.data.search.map((item: any) => {
    const cvss = item.cvss?.score || item.vulnersScore || 0;
    let severity = 'LOW';
    if (cvss >= 9.0) severity = 'CRITICAL';
    else if (cvss >= 7.0) severity = 'HIGH';
    else if (cvss >= 5.0) severity = 'MEDIUM';
    
    return {
      id: item.id,
      published: item.published || item.modified || '',
      modified: item.modified || '',
      description: (item.description || '').substring(0, 300),
      cvssScore: cvss,
      severity,
      url: `https://vulners.com/${item.type}/${item.id}`,
    };
  });
}

app.get('/api/scan/history', optionalAuth, async (req: any, res) => {
  const email = req.authUser || req.query.email;
  if (!email) return res.status(401).json({ error: 'No autenticado.' });
  const user = authDb.getUserByEmail(email.toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const history = authDb.getScanHistory(user.email, 100);
  res.json({ history: history.map((h: any) => ({
    id: h.id, targetIp: h.target_ip, score: h.score, scoreReason: h.score_reason,
    scanSource: h.scan_source, createdAt: h.created_at,
    portCount: JSON.parse(h.ports_json || '[]').length,
  })) });
});

// Get single scan record
app.get('/api/scan/history/:id', optionalAuth, async (req: any, res) => {
  const email = req.authUser || req.query.email;
  if (!email) return res.status(401).json({ error: 'No autenticado.' });
  const user = authDb.getUserByEmail(email.toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const record = authDb.getScanRecord(parseInt(req.params.id), user.email);
  if (!record) return res.status(404).json({ error: 'Escaneo no encontrado.' });
  const r = record as any;
  res.json({
    id: r.id, targetIp: r.target_ip, score: r.score,
    scoreReason: r.score_reason, ports: JSON.parse(r.ports_json || '[]'),
    reputation: JSON.parse(r.reputation_json || '[]'),
    analysisText: r.analysis_text, scanSource: r.scan_source,
    geo: JSON.parse(r.geo_json || '{}'), createdAt: r.created_at,
  });
});

// Scan History Dashboard (all authenticated users, not just premium)
app.get('/api/scan/dashboard', optionalAuth, async (req: any, res) => {
  const email = req.authUser || req.query.email;
  if (!email) return res.status(401).json({ error: 'No autenticado.' });
  const user = authDb.getUserByEmail(email.toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const history = authDb.getScanHistory(user.email, 100);
  res.json({ history: history.map((h: any) => ({
    id: h.id, targetIp: h.target_ip, score: h.score, scoreReason: h.score_reason,
    scanSource: h.scan_source, createdAt: h.created_at,
    portCount: JSON.parse(h.ports_json || '[]').length,
    scoreNumeric: h.score_numeric ?? null,
  })) });
});

// API: Export scan report as PDF (Sprint 6)
app.post('/api/export/pdf', optionalAuth, async (req: any, res) => {
  const email = req.authUser || req.body?.email;
  if (!email) return res.status(401).json({ error: 'No autenticado.' });
  const user = authDb.getUserByEmail(email.toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const scanId = req.body?.scanId;
  const record = scanId
    ? authDb.getScanRecord(parseInt(scanId), user.email)
    : (authDb.getScanHistory(user.email, 1)[0] || null);
  if (!record) return res.status(404).json({ error: 'No hay escaneos para exportar.' });

  const rec = record as any;
  const scoreToNum = (sc: string) => sc === 'green' ? 85 : sc === 'yellow' ? 50 : sc === 'red' ? 20 : 50;
  let ports: any[] = [], reputation: any[] = [];
  try { ports = JSON.parse(rec.ports_json || '[]'); } catch {}
  try { reputation = JSON.parse(rec.reputation_json || '[]'); } catch {}
  const scoreNumeric = rec.score_numeric ?? scoreToNum(rec.score);
  const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const scanDate = new Date(rec.created_at).toLocaleString('es-ES');
  const stripMd = (t: string) => (t || '').replace(/^#{1,4}\s*/gm, '').replace(/\*\*/g, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/`/g, '');

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Disposition', `attachment; filename="Informe_MyIP_${rec.target_ip}.pdf"`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  const primary = '#4338ca', dark = '#0f172a', text = '#334155', light = '#f8fafc';
  const scoreColor = rec.score === 'green' ? '#059669' : rec.score === 'yellow' ? '#d97706' : '#dc2626';

  const drawSection = (title: string) => {
    doc.moveDown(1.2);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(primary).text(title);
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(0.4);
  };

  // Header
  doc.fontSize(22).font('Helvetica-Bold').fillColor(dark).text('Informe de Seguridad MyIP', { align: 'center' });
  doc.fontSize(11).fillColor(primary).text('Análisis de tu conexión · myip.viajeinteligencia.com', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#64748b').text(`Fecha: ${date} | Generado por MyIP`, { align: 'center' });
  doc.moveDown(0.8);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primary).lineWidth(2).stroke();
  doc.moveDown(1);

  // Score card
  const scoreY = doc.y;
  doc.rect(50, scoreY, 495, 64).fill(scoreColor);
  doc.fillColor('#ffffff').fontSize(30).font('Helvetica-Bold').text(String(scoreNumeric) + '/100', 70, scoreY + 8);
  doc.fontSize(11).font('Helvetica').text('Puntuación de seguridad de tu conexión', 70, scoreY + 42, { width: 460 });
  doc.y = scoreY + 68;

  // Datos
  drawSection('Datos del análisis');
  doc.fillColor(text).fontSize(10).font('Helvetica').text(
    'IP analizada: ' + (rec.target_ip || '—') + '\n' +
    'Fecha del escaneo: ' + scanDate + '\n' +
    'Fuente: ' + (rec.scan_source || '—') + '\n' +
    'Motivo: ' + stripMd(rec.score_reason || '—'),
    { width: 495, lineGap: 3 }
  );

  // Puertos
  drawSection('Puertos analizados');
  const openPorts = ports.filter((p: any) => p.status !== 'closed');
  if (openPorts.length === 0) {
    doc.fillColor(text).fontSize(10).font('Helvetica').text('No se detectaron puertos expuestos. Todos los puertos verificados están protegidos.');
  } else {
    openPorts.forEach((p: any) => {
      if (doc.y > 740) { doc.addPage(); }
      const startY = doc.y;
      doc.rect(50, startY, 495, 60).fillAndStroke(light, '#e2e8f0');
      const riskColor = p.risk === 'high' ? '#dc2626' : p.risk === 'medium' ? '#d97706' : '#059669';
      doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text('Puerto ' + (p.port ?? '?') + ' · ' + (p.service || ''), 60, startY + 8, { width: 380 });
      doc.fillColor(riskColor).fontSize(9).font('Helvetica-Bold').text(String(p.status || '').toUpperCase(), 440, startY + 8, { width: 95, align: 'right' });
      doc.fillColor(text).fontSize(8.5).font('Helvetica').text(stripMd(p.explanation || ''), 60, startY + 24, { width: 475 });
      if (p.recommendation) doc.fillColor(text).fontSize(8.5).font('Helvetica-Oblique').text('→ ' + stripMd(p.recommendation), 60, startY + 38, { width: 475 });
      doc.y = startY + 64;
    });
  }

  // Blacklist
  drawSection('Reputación (listas negras)');
  if (reputation.length === 0) {
    doc.fillColor(text).fontSize(10).text('Sin datos de reputación para esta IP.');
  } else {
    reputation.forEach((r: any) => {
      if (doc.y > 750) { doc.addPage(); }
      const startY = doc.y;
      doc.rect(50, startY, 495, 26).fillAndStroke(light, '#e2e8f0');
      doc.fillColor(dark).fontSize(9.5).font('Helvetica-Bold').text(r.listName || 'Lista', 60, startY + 7, { width: 330 });
      doc.fillColor(r.clean ? '#059669' : '#dc2626').fontSize(9).font('Helvetica-Bold').text(r.clean ? 'LIMPIA' : 'LISTADA', 440, startY + 7, { width: 95, align: 'right' });
      doc.y = startY + 28;
    });
  }

  // Resumen ejecutivo
  drawSection('Resumen ejecutivo');
  doc.fillColor(text).fontSize(9.5).font('Helvetica').text(stripMd(rec.analysis_text || 'Sin resumen disponible.'), { width: 495, lineGap: 3 });

  // Footer
  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Oblique').text(
    'Generado por MyIP · myip.viajeinteligencia.com · MyIP es gratuito, apoyable en Ko-fi · Este informe analiza únicamente tu propia IP pública.',
    { align: 'center', width: 495 }
  );

  doc.end();
});

// Security: Check password breach via HaveIBeenPwned (Server-side proxy to avoid CORS)
app.post('/api/security/check-password', async (req, res) => {
  const { hash } = req.body;
  if (!hash || typeof hash !== 'string' || hash.length !== 40) {
    return res.status(400).json({ error: 'Hash SHA-1 inválido.' });
  }
  
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5).toUpperCase();
  
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) {
      return res.json({ count: null, error: 'API externa no disponible.' });
    }
    
    const text = await response.text();
    // Validar formato
    if (!text.includes(':')) {
      return res.json({ count: null, error: 'Respuesta de API inválida.' });
    }

    const line = text.split('\n').find(l => l.startsWith(suffix));
    if (line) {
      const count = parseInt(line.split(':')[1], 10);
      res.json({ count: isNaN(count) ? 0 : count });
    } else {
      res.json({ count: 0 });
    }
  } catch (e) {
    res.json({ count: null, error: 'Error de red al consultar la API.' });
  }
});

// WiFi Audit — real detection via nmcli/iwconfig/ping
app.post('/api/wifi/audit', async (req, res) => {
  // Este audit ejecuta nmcli/iwconfig/ping contra la interfaz de red del
  // PROCESO que corre el servidor. En produccion (Hetzner/Vercel) eso seria
  // la red del servidor, no la del usuario -> inutil y fuga de topologia
  // interna. Solo tiene sentido en localhost/dev.
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'WiFi audit no disponible en modo servidor remoto. Requiere ejecucion local.',
      available: false
    });
  }
  try {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const proc = spawn(pythonPath, ['./scripts/wifi_audit.py'], { timeout: 15000 });
    let output = '';
    let errOut = '';
    proc.stdout.on('data', (chunk) => output += chunk);
    proc.stderr.on('data', (chunk) => errOut += chunk);
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          // Alias: el frontend espera "gateway", el script Python devuelve "gateway_ip"
          data.gateway = data.gateway_ip || 'No detectado';
          res.json(data);
        } catch {
          res.status(500).json({ error: 'Invalid JSON from wifi audit', raw: output, stderr: errOut });
        }
      } else {
        res.status(500).json({ error: `WiFi audit failed (code ${code})`, stderr: errOut });
      }
    });
    proc.on('error', (err) => res.status(500).json({ error: err.message }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// Vite / Production
// ============================================================================
async function startServer() {
  // API: Download Cybersecurity Manual as PDF (must be before catch-all)
  app.get('/api/manual/download', (req, res) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    
    res.setHeader('Content-Disposition', 'attachment; filename="Manual_Ciberseguridad_MyIP.pdf"');
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const primaryColor = '#4338ca';
    const darkColor = '#0f172a';
    const textColor = '#334155';
    const lightBg = '#f8fafc';

    const drawHeader = () => {
      doc.fontSize(24).font('Helvetica-Bold').fillColor(darkColor).text('Manual de Ciberseguridad', { align: 'center' });
      doc.fontSize(12).fillColor(primaryColor).text('SIEG · MyIP Platform', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#64748b').text(`Fecha: ${date} | Versión: 1.0.0 | myip.viajeinteligencia.com`, { align: 'center' });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primaryColor).lineWidth(2).stroke();
      doc.moveDown(1);
    };

    const drawSection = (title: string) => {
      doc.moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor).text(title);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
      doc.moveDown(0.5);
    };

    const drawCard = (title: string, body: string) => {
      const startY = doc.y;
      doc.rect(50, startY, 495, 60).fillAndStroke(lightBg, '#e2e8f0');
      doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text(title, 60, startY + 10, { width: 475 });
      doc.fillColor(textColor).fontSize(10).font('Helvetica').text(body, 60, startY + 28, { width: 475 });
      doc.moveDown(4);
    };

    const drawBullet = (text: string) => {
      const x = 60;
      doc.fillColor(primaryColor).circle(x, doc.y + 4, 3).fill();
      doc.fillColor(textColor).fontSize(10).font('Helvetica').text(text, x + 10, doc.y - 2, { width: 475 });
      doc.moveDown(0.8);
    };

    drawHeader();
    
    doc.fontSize(11).font('Helvetica').fillColor(textColor).text(
      'Este manual ha sido diseñado para empoderar al usuario final en la protección de su red doméstica y profesional. ' +
      'En un mundo donde la hiperconectividad expone constantemente nuestros datos, MyIP ofrece una suite de herramientas ' +
      'de diagnóstico y monitoreo que democratizan el acceso a la seguridad informática.',
      { width: 495, lineGap: 4 }
    );
    doc.moveDown(0.5);
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Oblique').text(
      '"La verdadera seguridad no reside en la oscuridad tecnológica, sino en el faro del conocimiento compartido." — M.Castillo',
      { width: 495, align: 'right' }
    );

    drawSection('1. Los 3 Pilares de la Soberanía Digital');
    drawCard('Visibilidad', 'No puedes proteger lo que no ves. Conocer tu IP pública, tus puertos abiertos y tu reputación en internet es el primer paso.');
    drawCard('Control', 'Cerrar puertas innecesarias. Desactivar servicios obsoletos y asegurar que solo tú tienes la llave de tu red.');
    drawCard('Monitorización', 'La seguridad es un proceso. Vigilar cambios en tu red y recibir alertas ante nuevas amenazas es vital.');

    drawSection('2. Herramientas de la Plataforma MyIP');
    drawCard('Escaneo de IP Pública', 'Detecta tu IP externa y analiza los puertos TCP expuestos en tiempo real. Identifica vulnerabilidades antes que los atacantes.');
    drawCard('Radar de Amenazas', 'Visualización global de ataques bloqueados y hotspots de actividad maliciosa. Datos OSINT en tiempo real.');
    drawCard('Reputación de IP', 'Consulta si tu dirección aparece en listas negras (DNSBL) que podrían estar bloqueando tus correos o servicios.');
    drawCard('Análisis WiFi', 'Diagnóstico de la calidad y seguridad de tu conexión inalámbrica actual.');

    drawSection('3. Protocolos de Respuesta a Incidentes');
    drawCard('Puerto 22 (SSH) Abierto', 'Riesgo: Fuerza bruta. Solución: Cambia el puerto, usa llaves SSH y desactiva el login por contraseña.');
    drawCard('IP en Lista Negra', 'Riesgo: Emails a Spam. Solución: Escanea malware, reinicia router para nueva IP y solicita delisting.');
    drawCard('Intrusos en Red WiFi', 'Riesgo: Robo de ancho de banda. Solución: Cambia a WPA2/WPA3, desactiva WPS y oculta el SSID.');

    drawSection('4. Buenas Prácticas de Seguridad');
    drawBullet('Actualiza el firmware de tu Router periódicamente.');
    drawBullet('Desactiva WPS (vulnerable a fuerza bruta rápida).');
    drawBullet('Usa DNS Seguro (DoH/DoT) para cifrar tu historial.');
    drawBullet('Contraseñas únicas y 2FA en todos los servicios críticos.');
    drawBullet('Realiza un escaneo MyIP mensual para verificar tu postura.');
    drawBullet('Nunca expongas el puerto 3389 (RDP) a internet.');

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#64748b').text('MyIP © 2026 SIEG | Privacy Tools', { align: 'center' });
    doc.fontSize(8).text('https://myip.viajeinteligencia.com', { align: 'center' });

    doc.end();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    console.log('Vite middleware (dev mode).');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
    console.log('Serving production build.');
  }

  // Pre-create developer accounts in authDb real (SQLite+bcrypt), premium, no rate limits
  const devAccounts = ['miguel@dev.com', 'test_dev@example.com'];
  if (process.env.NODE_ENV !== 'production') {
    const DEV_PASSWORD = 'DevPass2026!';
    for (const devEmail of devAccounts) {
      let stored = authDb.getUserByEmail(devEmail);
      if (!stored) {
        stored = await authDb.createUserWithPassword(devEmail, DEV_PASSWORD, '127.0.0.1');
      }
      usersDb[devEmail] = {
        email: devEmail,
        ipAddress: '127.0.0.1', scanCount: stored.scanCount,
        verified: true, isGuest: false,
      };
    }

    // Aviso defensivo: si esto arranca en un servidor real (no localhost)
    // con NODE_ENV mal configurado, este bloque grita en los logs antes de
    // que sea un incidente. El guard real sigue siendo el `if` de arriba;
    // esto es solo visibilidad, no reemplaza el guard.
    console.warn('');
    console.warn('============================================================');
    console.warn('  ATENCION: SERVIDOR EN MODO DESARROLLO (NODE_ENV != production)');
    console.warn('============================================================');
    console.warn(`  NODE_ENV actual: "${process.env.NODE_ENV || '(vacio)'}"`);
    console.warn(`  Cuentas dev activas: ${devAccounts.join(', ')}`);
    console.warn('  Password dev hardcodeada en el codigo fuente: DevPass2026!');
    console.warn('  Rate limiting: DESACTIVADO POR COMPLETO (sin limite de escaneos)');
    console.warn('  Si esta maquina tiene IP publica o esta detras de PM2 en');
    console.warn('  produccion, corrige NODE_ENV=production INMEDIATAMENTE.');
    console.warn('============================================================');
    console.warn('');
  }
// [Extraido a alerts.ts: compareScans() + cron de alertas recurrentes -> startAlertsCron()]

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MyIP server running on http://0.0.0.0:${PORT}`);
    startAlertsCron(PORT);
  });

// ============================================================================
// Global Error Handlers — Prevent stack trace leaks
// ============================================================================
process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED REJECTION]', reason?.message || reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[UNCAUGHT EXCEPTION]', error.message);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// 500 Error Handler (must be last)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[SERVER ERROR]', err.message);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor. Intentalo de nuevo mas tarde.'
      : err.message || 'Error desconocido.'
  });
});
}

startServer();
