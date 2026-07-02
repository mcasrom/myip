import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import crypto from 'crypto';
import https from 'https';
import tls from 'tls';
import dns from 'dns';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import cookieParser from 'cookie-parser';
import * as authDb from './db';
import { startAlertsCron } from './alerts';
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
async function getPortsFromNmap(ip: string, profile: string = 'quick'): Promise<any[]> {
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
            resolve(data.ports.map((p: any) => ({
              port: p.port,
              protocol: 'tcp',
              service: p.service || 'unknown',
              status: p.state === 'open' ? 'open' : p.state === 'closed' ? 'closed' : p.state === 'filtered' ? 'closed' : 'unknown',
              banner: p.banner || '',
            })));
            return;
          }
        } catch { /* fall through */ }
      }
      resolve([]);
    });
    proc.on('error', () => { clearTimeout(timer); resolve([]); });
  });
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
  try {
    const data = await fetchJson(`https://ipapi.co/${ip}/json/`);
    if (data && !data.error) {
      return {
        country: data.country_name || 'N/A',
        countryCode: data.country_code || 'XX',
        region: data.region || 'N/A',
        city: data.city || 'N/A',
        isp: data.org || 'N/A',
      };
    }
  } catch (err) { console.log('[GEO] Error:', err); }
  return { country: 'N/A', countryCode: 'XX', region: 'N/A', city: 'N/A', isp: 'N/A' };
}

// ============================================================================
// Stripe Client
// ============================================================================
let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) { stripeClient = new Stripe(key, { apiVersion: '2023-10-16' as any }); }
  }
  return stripeClient;
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
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// In-memory database
interface DbUser {
  email: string; isPremium: boolean; ipAddress: string;
  lastScanTime?: number; scanCount: number;
  verified: boolean; isGuest?: boolean; premiumCode?: string;
}
const usersDb: Record<string, DbUser> = {};
// Hidratar cache en memoria desde SQLite al arrancar (sobrevive a reinicios)
for (const u of authDb.getAllUsers()) {
  usersDb[u.email] = {
    email: u.email, isPremium: u.isPremium, ipAddress: u.ipAddress,
    lastScanTime: u.lastScanTime, scanCount: u.scanCount,
    verified: u.verified, isGuest: u.isGuest, premiumCode: u.premiumCode
  };
}
console.log(`[DB] ${authDb.getAllUsers().length} usuario(s) cargado(s) desde SQLite.`);
// Middleware de sesion: lee cookie, resuelve usuario real (no confia en el body)
function optionalAuth(req: any, res: any, next: any) {
  const token = req.cookies?.myip_session;
  if (token) {
    const su = authDb.getSessionUser(token);
    if (su) req.authUser = su.email;
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
// - Same IP: 1 scan per 24h (free), unlimited (premium)
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

function checkRateLimit(ip: string, fingerprint: string, isPremium: boolean, isGuest: boolean): { allowed: boolean; error?: string; hoursRemaining?: number } {
  const now = Date.now();

  // Premium: no limits
  if (isPremium) return { allowed: true };

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

  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (r.ok) {
      const data = await r.json() as any;
      if (!data.error) {
        return res.json({
          country: data.country_name || 'Desconocido',
          countryCode: data.country_code || 'XX',
          region: data.region || 'Region desconocida',
          city: data.city || 'Ciudad desconocida',
          isp: data.org || 'ISP desconocido',
        });
      }
    }
  } catch (e) {
    console.warn('[GEO LOOKUP] ipapi.co fallo:', e);
  }

  try {
    const r2 = await fetch('https://ipinfo.io/json');
    if (r2.ok) {
      const data2 = await r2.json() as any;
      return res.json({
        country: data2.country || 'Desconocido',
        countryCode: data2.country || 'XX',
        region: data2.region || 'Region desconocida',
        city: data2.city || 'Ciudad desconocida',
        isp: data2.org || 'ISP desconocido',
      });
    }
  } catch (e) {
    console.warn('[GEO LOOKUP] ipinfo.io fallo:', e);
  }

  res.status(502).json({ country: 'N/A', countryCode: 'XX', region: 'N/A', city: 'N/A', isp: 'N/A' });
});

// Auth: Registro real con contrasena (bcrypt). Rechaza si el email ya tiene cuenta.
app.post('/api/auth/register', async (req, res) => {
  const { email, password, clientIp } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Por favor, proporciona un correo electrónico válido.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (authDb.getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email. Inicia sesion en su lugar.' });
  }
  const stored = await authDb.createUserWithPassword(normalizedEmail, password, clientIp || 'pending');
  usersDb[normalizedEmail] = {
    email: stored.email, isPremium: stored.isPremium, ipAddress: stored.ipAddress,
    scanCount: stored.scanCount, verified: stored.verified, isGuest: stored.isGuest
  };
  const token = authDb.createSession(normalizedEmail);
  res.cookie('myip_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
  console.log(`[AUTH] Nueva cuenta: ${normalizedEmail}`);
  res.json({
    message: 'Cuenta creada. Tus escaneos se guardarán en esta cuenta.',
    user: { email: stored.email, isPremium: stored.isPremium, ipAddress: stored.ipAddress, scanCount: stored.scanCount, isGuest: stored.isGuest }
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
    user: { email: stored.email, isPremium: stored.isPremium, ipAddress: stored.ipAddress, scanCount: stored.scanCount, isGuest: stored.isGuest }
  });
});
// Auth: Logout, borra la sesion de la BD (no solo la cookie)
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.myip_session;
  if (token) authDb.deleteSession(token);
  res.clearCookie('myip_session');
  res.json({ message: 'Sesion cerrada.' });
});

// Acceso invitado: inmediato, sin datos personales
app.post('/api/auth/guest', async (req, res) => {
  const { clientIp } = req.body;
  const randomId = crypto.randomBytes(4).toString('hex');
  const guestEmail = `invitado_${randomId}@myip.local`;

  usersDb[guestEmail] = {
    email: guestEmail, isPremium: false, ipAddress: clientIp || 'pending',
    scanCount: 0, verified: true, isGuest: true
  };

  res.json({
    message: 'Sesión de invitado iniciada. 3 escaneos gratuitos.',
    user: { email: guestEmail, isPremium: false, ipAddress: clientIp || 'pending', scanCount: 0, isGuest: true }
  });
});

// Premium upgrade (fallback when Stripe not configured)
app.post('/api/premium/upgrade', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Se requiere email.' });
  const user = usersDb[email.toLowerCase().trim()];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  user.isPremium = true;
  res.json({ message: '¡Premium activado!', user: { email: user.email, isPremium: true, ipAddress: user.ipAddress, scanCount: user.scanCount } });
});

// Dev premium code redemption (codes stored server-side only, never exposed to frontend)
const DEV_PREMIUM_CODES: Record<string, { label: string; uses: number }> = {
  'MYIP-DEV-2026-ALPHA': { label: 'Alpha', uses: 0 },
  'MYIP-DEV-2026-BETA': { label: 'Beta', uses: 0 },
};

app.post('/api/premium/redeem-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Se requiere email y código.' });
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedCode = code.trim().toUpperCase();
  const devCode = DEV_PREMIUM_CODES[trimmedCode];
  if (!devCode) return res.status(400).json({ error: 'Código inválido.' });
  if (!usersDb[normalizedEmail]) {
    usersDb[normalizedEmail] = { email: normalizedEmail, isPremium: true, ipAddress: '0.0.0.0', scanCount: 0, verified: true, isGuest: false, premiumCode: trimmedCode };
  } else {
    usersDb[normalizedEmail].isPremium = true;
    usersDb[normalizedEmail].premiumCode = trimmedCode;
  }
  devCode.uses++;
  console.log(`[PREMIUM CODE] ${trimmedCode} usado por ${normalizedEmail} (uso #${devCode.uses})`);
  res.json({ message: '¡Premium activado!', user: { email: normalizedEmail, isPremium: true, scanCount: usersDb[normalizedEmail].scanCount } });
});

// Stripe Checkout Session
app.post('/api/premium/create-checkout-session', async (req, res) => {
  const { email, tier } = req.body;
  if (!email) return res.status(400).json({ error: 'Se requiere email.' });
  const normalizedEmail = email.toLowerCase().trim();
  const stripe = getStripe();
  if (!stripe) return res.json({ isDemo: true });

  let productName = 'MyIP Premium - Acceso de por Vida';
  let amount = 999;
  let mode: 'payment' | 'subscription' = 'payment';
  if (tier === 'monthly') { productName = 'MyIP Pro SysAdmin - Mensual'; amount = 499; mode = 'subscription'; }
  else if (tier === 'whitelabel') { productName = 'MyIP Corporativo & Whitelabel'; amount = 2499; }

  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: productName }, unit_amount: amount }, quantity: 1 } as any],
      mode, metadata: { email: normalizedEmail, tier: tier || 'lifetime' },
      success_url: `${appUrl}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?payment_cancel=true`,
    });
    res.json({ checkoutUrl: session.url, isDemo: false });
  } catch (err: any) {
    console.error('[STRIPE ERROR]', err);
    res.status(500).json({ error: 'Error con Stripe.' });
  }
});

app.post('/api/premium/verify-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Se requiere sessionId.' });
  const stripe = getStripe();
  if (!stripe) return res.status(400).json({ error: 'Stripe no configurado.' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid' && session.metadata?.email) {
      const normalizedEmail = session.metadata.email.toLowerCase().trim();
      if (!usersDb[normalizedEmail]) {
        usersDb[normalizedEmail] = { email: normalizedEmail, isPremium: true, ipAddress: '0.0.0.0', scanCount: 0, verified: true };
      } else {
        usersDb[normalizedEmail].isPremium = true;
        usersDb[normalizedEmail].verified = true;
      }
      return res.json({ success: true, message: '¡Premium activado!', user: { email: usersDb[normalizedEmail].email, isPremium: true, ipAddress: usersDb[normalizedEmail].ipAddress, scanCount: usersDb[normalizedEmail].scanCount } });
    }
    res.status(400).json({ error: 'Pago no completado.' });
  } catch (err: any) { res.status(500).json({ error: 'Error verificando Stripe.' }); }
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
  const isPremium = user?.isPremium ?? false;
  const isGuest = user?.isGuest ?? false;

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

  if (isGuest && user && user.scanCount >= 3) {
    return res.status(429).json({ error: 'Límite de invitado alcanzado (3/3). Crea una cuenta con email.', rateLimited: true, isGuestLimit: true });
  }

  // Development mode: NO rate limits at all
  if (process.env.NODE_ENV !== 'production') {
    // skip all rate limiting in dev
  } else if (!isPremium) {
    // Production non-premium: check IP + fingerprint rate limits
    const fingerprint = req.headers['x-device-fingerprint'] || '';
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const limit = checkRateLimit(clientIp, fingerprint, false, isGuest);
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
    try { nmapPorts = await Promise.race([getPortsFromNmap(ip, 'quick'), new Promise<any[]>((r) => setTimeout(() => r([]), 30000))]); } catch { nmapPorts = []; }
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

    return { port: p.port, service, status: isUnknown ? 'unknown' : (isOpen ? 'open' : 'closed'), risk, explanation, recommendation };
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

  if (isPremium) {
    const vt = await checkVirusTotal(ip);
    reputation.push({ listName: 'VirusTotal', clean: vt.clean, unverified: vt.unverified, details: vt.details, malicious: vt.malicious });
  }

  // --- SSL ---
  let sslInfo: any = null;
  if (isPremium) {
    try { sslInfo = await checkSSL(ip); } catch (err) { console.log('[SSL] Error:', err); }
  }

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

  // --- GEO ---
  const geo = await getGeoForIp(ip);

  // --- ANALYSIS: Static analysis only (Gemini quota exceeded, removed) ---
  let analysisText = '';
  let grokReport = '';
  const portBullets = enrichedPorts.map(p => {
    const icon = p.status === 'open' ? '🔓 ABIERTO' : p.status === 'unknown' ? '❓ SIN VERIFICAR' : '🔒 CERRADO';
    return `* **Puerto ${p.port} (${p.service})**: ${icon}. ${p.explanation}`;
  }).join('\n');
  const blackBullets = reputation.map(r => `* **${r.listName}**: ${r.clean ? '✅ Limpia' : '❌ ' + r.details}`).join('\n');

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
  if (user) { user.lastScanTime = now; user.scanCount += 1; }

  // Save to scan history for logged-in users
  if (user) {
    try {
      authDb.saveScanRecord(user.email, {
        targetIp: ip, score, scoreReason,
        ports: enrichedPorts, reputation, analysisText,
        scanSource: portScanSource, geo,
      });
    } catch (err) { console.log('[HISTORY] Save error:', err); }
  }

  res.json({
    ip, timestamp: now, score, scoreReason, ports: enrichedPorts, reputation, sslInfo,
    analysisText, grokReport: grokReport || undefined, scanSource: portScanSource, geo,
  });
});

// Scan History (Premium)
app.get('/api/scan/history', optionalAuth, async (req: any, res) => {
  const email = req.authUser || req.query.email;
  if (!email) return res.status(401).json({ error: 'No autenticado.' });
  const user = authDb.getUserByEmail(email.toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (!user.isPremium) return res.status(403).json({ error: 'Requiere Premium.' });
  const history = authDb.getScanHistory(user.email, 100);
  res.json({ history: history.map((h: any) => ({
    id: h.id, targetIp: h.target_ip, score: h.score, scoreReason: h.score_reason,
    scanSource: h.scan_source, createdAt: h.created_at,
    portCount: JSON.parse(h.ports_json || '[]').length,
  })) });
});

// Get single scan record (Premium)
app.get('/api/scan/history/:id', optionalAuth, async (req: any, res) => {
  const email = req.authUser || req.query.email;
  if (!email) return res.status(401).json({ error: 'No autenticado.' });
  const user = authDb.getUserByEmail(email.toLowerCase().trim());
  if (!user || !user.isPremium) return res.status(403).json({ error: 'Requiere Premium.' });
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

// Send report — Full HTML email with analysis
app.post('/api/premium/send-report', async (req, res) => {
  const { email, reportType, scanData } = req.body;
  if (!email) return res.status(400).json({ error: 'Se requiere email.' });

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">MyIP — ${reportType || 'Reporte de Seguridad'}</h1>
        <p style="margin: 8px 0 0; opacity: 0.8; font-size: 13px;">Generado el ${new Date().toLocaleString('es-ES')}</p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        ${scanData ? `
          <div style="margin-bottom: 20px;">
            <h2 style="font-size: 16px; color: #4338ca; margin: 0 0 8px;">IP Analizada: ${scanData.ip || 'N/A'}</h2>
            <p style="margin: 0; font-size: 14px;">Estado: <strong style="color: ${scanData.score === 'green' ? '#059669' : scanData.score === 'yellow' ? '#d97706' : '#dc2626'};">${(scanData.score || 'unknown').toUpperCase()}</strong></p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${scanData.scoreReason || ''}</p>
          </div>
          <h3 style="font-size: 14px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Puertos Escaneados</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <tr style="background: #f1f5f9;"><th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Puerto</th><th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Servicio</th><th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">Estado</th></tr>
            ${(scanData.ports || []).map((p: any) => `<tr><td style="padding: 4px 8px; border-bottom: 1px solid #f1f5f9; font-family: monospace;">${p.port}</td><td style="padding: 4px 8px; border-bottom: 1px solid #f1f5f9;">${p.service}</td><td style="padding: 4px 8px; border-bottom: 1px solid #f1f5f9; color: ${p.status === 'open' ? '#dc2626' : '#059669'};">${p.status === 'open' ? '🔓 Abierto' : '🔒 Cerrado'}</td></tr>`).join('')}
          </table>
          <h3 style="font-size: 14px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Análisis</h3>
          <div style="font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${(scanData.analysisText || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.*)/g, '<h4 style="margin: 12px 0 4px; color: #4338ca;">$1</h4>')}</div>
        ` : '<p style="color: #64748b;">Tu reporte está listo. Inicia sesión en MyIP para ver los detalles completos.</p>'}
      </div>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; font-size: 11px; color: #94a3b8;">
        MyIP &copy; 2026 M. Castillo — Herramienta de auditoría de seguridad
      </div>
    </div>
  `;

  const sent = await sendEmail({
    to: email,
    subject: `MyIP — ${reportType || 'Reporte de Seguridad'} — ${new Date().toLocaleDateString('es-ES')}`,
    text: `Tu reporte MyIP (${reportType || 'seguridad'}) está listo. Inicia sesión en MyIP para ver los detalles completos.`,
    html,
  });
  res.json({ message: sent ? `Reporte enviado a ${email}.` : `Reporte generado, pero no se pudo enviar el email. Inténtalo de nuevo más tarde.`, sentAt: new Date().toISOString() });
});

// ============================================================================
// Vite / Production
// ============================================================================
async function startServer() {
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
      if (!stored.isPremium) {
        authDb.updateUserFields(devEmail, { isPremium: true, premiumCode: 'DEV-OWNER' });
      }
      usersDb[devEmail] = {
        email: devEmail, isPremium: true,
        ipAddress: '127.0.0.1', scanCount: stored.scanCount,
        verified: true, isGuest: false, premiumCode: 'DEV-OWNER'
      };
    }
  }
// [Extraido a alerts.ts: compareScans() + cron de alertas recurrentes -> startAlertsCron()]

  console.log(`[DEV] Accounts created: ${devAccounts.join(', ')} — all premium, no rate limits.`);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MyIP server running on http://0.0.0.0:${PORT}`);
    startAlertsCron(PORT);
  });
}

startServer();
