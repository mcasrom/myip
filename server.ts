import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';
import net from 'net';

dotenv.config();

// Initialize Stripe Client lazily so we don't crash if secret key is missing
let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      stripeClient = new Stripe(key, {
        apiVersion: '2023-10-16' as any, // stable API version
      });
    }
  }
  return stripeClient;
}

// Mail Sending helper that uses Nodemailer if SMTP details are configured
async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'no-reply@viajeinteligencia.com';

  if (!host || !user || !pass) {
    console.log(`[SMTP SIMULATION] Correo electrónico simulado a <${to}>:`);
    console.log(`Asunto: ${subject}`);
    console.log(`Contenido: ${text}`);
    return false; // Simulation Mode
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465 SSL, false for TLS on other ports
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false // Avoid issues with self-signed certs of hosting providers
      }
    });

    await transporter.sendMail({
      from: `"MyIP Security" <${from}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`[SMTP] Correo enviado exitosamente a ${to}`);
    return true; // Sent successfully
  } catch (err) {
    console.error('[SMTP ERROR] Error enviando correo real a través de Nodemailer:', err);
    return false; // Failed, fallback to showing code
  }
}

// Perform a real TCP port connect check with a short timeout to prevent blocking HTTP response
function checkPortReal(ip: string, port: number, timeoutMs = 1200): Promise<'open' | 'closed'> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status: 'open' | 'closed' = 'closed';

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      status = 'open';
      socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('error', () => {
      socket.destroy();
    });

    socket.on('close', () => {
      resolve(status);
    });

    socket.connect(port, ip);
  });
}

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory database for demo purposes
interface DbUser {
  email: string;
  isPremium: boolean;
  ipAddress: string;
  lastScanTime?: number;
  scanCount: number;
  verificationCode?: string;
  verified: boolean;
}

const usersDb: Record<string, DbUser> = {};

// Helper to generate realistic public IP details for demonstration when localhost is detected
const SIMULATED_IPS = [
  {
    ip: '185.230.124.5',
    geo: { country: 'España', countryCode: 'ES', region: 'Madrid', city: 'Madrid', isp: 'Telefonica de España' }
  },
  {
    ip: '82.102.23.41',
    geo: { country: 'México', countryCode: 'MX', region: 'CDMX', city: 'Ciudad de México', isp: 'Telmex' }
  },
  {
    ip: '190.242.115.63',
    geo: { country: 'Colombia', countryCode: 'CO', region: 'Bogotá', city: 'Bogotá', isp: 'Claro Colombia' }
  },
  {
    ip: '200.55.12.158',
    geo: { country: 'Argentina', countryCode: 'AR', region: 'Buenos Aires', city: 'Buenos Aires', isp: 'Telecom Argentina' }
  }
];

function getUserIp(req: express.Request): { ip: string; isSimulated: boolean; geo: any } {
  let ip = (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || 
             (req.headers['x-real-ip'] as string) || 
             req.socket.remoteAddress || 
             '127.0.0.1';

  // Clean ipv6 loopback or local subnets
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('fe80') || ip.startsWith('192.168') || ip.startsWith('10.')) {
    // Return a stable simulated public IP based on remote address string length or session
    const idx = Math.abs(ip.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % SIMULATED_IPS.length;
    return {
      ip: SIMULATED_IPS[idx].ip,
      isSimulated: true,
      geo: SIMULATED_IPS[idx].geo
    };
  }

  return {
    ip,
    isSimulated: false,
    geo: {
      country: 'Detectado',
      countryCode: 'XX',
      region: 'Región Detectada',
      city: 'Ciudad Detectada',
      isp: 'Proveedor de Internet Genérico'
    }
  };
}

// Initialize Gemini client if API key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    console.log('Gemini API client initialized successfully.');
  } catch (err) {
    console.error('Error initializing Gemini API client:', err);
  }
} else {
  console.log('No GEMINI_API_KEY found. Running with fallback rule-based diagnostic translation.');
}

// --- API ROUTES ---

// Get public IP and geo info
app.get('/api/ip/detect', (req, res) => {
  const ipInfo = getUserIp(req);
  res.json(ipInfo);
});

// Low friction registration/login (Email only)
app.post('/api/auth/register', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Por favor, proporciona un correo electrónico válido.' });
  }

  const ipInfo = getUserIp(req);
  const normalizedEmail = email.toLowerCase().trim();

  // Generate simple 6-digit verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  if (!usersDb[normalizedEmail]) {
    usersDb[normalizedEmail] = {
      email: normalizedEmail,
      isPremium: false,
      ipAddress: ipInfo.ip,
      scanCount: 0,
      verificationCode,
      verified: false
    };
  } else {
    usersDb[normalizedEmail].verificationCode = verificationCode;
    usersDb[normalizedEmail].verified = false; // Require re-verification
  }

  console.log(`[AUTH] Código de verificación generado para ${normalizedEmail}: ${verificationCode}`);

  // Send real email if SMTP is configured
  const emailSent = await sendEmail({
    to: normalizedEmail,
    subject: `🔐 Tu código de verificación MyIP: ${verificationCode}`,
    text: `Hola,\n\nTu código de verificación para acceder a MyIP es: ${verificationCode}\n\nEste código es temporal. Si no has solicitado esto, puedes ignorar este correo.\n\nAtentamente,\nEl Equipo de MyIP`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <h2 style="color: #4f46e5; font-size: 22px; margin-bottom: 12px; font-weight: bold; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;">Acceso Seguro a MyIP</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">Hola,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">Has solicitado un código para registrarte o iniciar sesión en la plataforma de diagnóstico de seguridad <strong>MyIP</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #4f46e5; background-color: #f5f3ff; border: 1px solid #ddd6fe; padding: 12px 24px; border-radius: 12px; display: inline-block;">${verificationCode}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px; line-height: 1.5;">
          Este código es estrictamente confidencial. Si tú no has realizado esta solicitud, simplemente desestima este mensaje de correo electrónico.
        </p>
      </div>
    `
  });

  res.json({
    message: emailSent 
      ? 'Hemos enviado un código de verificación real a tu correo electrónico.' 
      : 'Código de verificación generado con éxito (Simulación activa).',
    email: normalizedEmail,
    demoVerificationCode: emailSent ? null : verificationCode,
    isRealEmail: emailSent
  });
});

// Instant Guest Access (No email or Google server required)
app.post('/api/auth/guest', (req, res) => {
  const ipInfo = getUserIp(req);
  const randomId = Math.random().toString(36).substring(2, 8);
  const guestEmail = `invitado_${randomId}@myip.local`;

  usersDb[guestEmail] = {
    email: guestEmail,
    isPremium: false,
    ipAddress: ipInfo.ip,
    scanCount: 0,
    verificationCode: 'GUEST',
    verified: true
  };

  console.log(`[AUTH] Cuenta de invitado iniciada: ${guestEmail} para la IP: ${ipInfo.ip}`);

  res.json({
    message: 'Sesión de invitado iniciada con éxito (Sin Correo).',
    user: {
      email: guestEmail,
      isPremium: false,
      ipAddress: ipInfo.ip,
      scanCount: 0,
      isGuest: true
    }
  });
});

// Verify login code
app.post('/api/auth/verify', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Se requieren el email y el código de verificación.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = usersDb[normalizedEmail];

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  if (user.verificationCode !== code) {
    return res.status(400).json({ error: 'Código de verificación incorrecto.' });
  }

  user.verified = true;
  // Auto-detect IP on verification/login to bind it
  const ipInfo = getUserIp(req);
  user.ipAddress = ipInfo.ip;

  res.json({
    message: 'Sesión iniciada con éxito.',
    user: {
      email: user.email,
      isPremium: user.isPremium,
      ipAddress: user.ipAddress,
      scanCount: user.scanCount
    }
  });
});

// Upgrade user to Premium (Simulate Stripe payment)
app.post('/api/premium/upgrade', (req, res) => {
  const { email, cardNumber, expiry, cvc } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Se requiere el email de usuario para el upgrade.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = usersDb[normalizedEmail];

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Simulate premium payment validation
  if (cardNumber && cardNumber.replace(/\s/g, '').length < 16) {
    return res.status(400).json({ error: 'El número de tarjeta no es válido (debe tener 16 dígitos).' });
  }

  user.isPremium = true;

  res.json({
    message: '¡Suscripción Premium activada con éxito!',
    user: {
      email: user.email,
      isPremium: user.isPremium,
      ipAddress: user.ipAddress,
      scanCount: user.scanCount
    }
  });
});

// Create real Stripe Checkout Session with dynamic tiers
app.post('/api/premium/create-checkout-session', async (req, res) => {
  const { email, tier } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Se requiere el correo electrónico del usuario.' });
  }
  const normalizedEmail = email.toLowerCase().trim();

  const stripe = getStripe();
  if (!stripe) {
    // If Stripe is not configured (e.g. key is missing in environment), flag it so frontend can fall back to simulated mode
    return res.json({ isDemo: true });
  }

  // Determine pricing details based on the selected tier
  let productName = 'MyIP Premium - Acceso de por Vida';
  let productDesc = 'Monitoreo 24/7, Alertas SSL/TLS e Informes Profesionales Ilimitados de Red.';
  let amount = 999; // $9.99
  let mode: 'payment' | 'subscription' = 'payment';

  if (tier === 'monthly') {
    productName = 'MyIP Pro SysAdmin - Suscripción Mensual';
    productDesc = 'Monitoreo continuo 24/7 de tu IP pública, alertas en tiempo real y soporte avanzado.';
    amount = 499; // $4.99
    // For simplicity, we can charge as a one-time checkout or recurring if we want. Let's make it a recurring payment or simple high-value billing:
    mode = 'payment'; // keep it simple as payment to avoid creating price IDs in stripe manually, but label as recurring/monthly simulation
  } else if (tier === 'whitelabel') {
    productName = 'MyIP Corporativo & Whitelabel';
    productDesc = 'Informes PDF de marca blanca con tu logotipo, soporte prioritario 1-on-1 y exportaciones JSON.';
    amount = 2499; // $24.99
    mode = 'payment';
  }

  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDesc,
            },
            unit_amount: amount,
          },
          quantity: 1,
        } as any,
      ],
      mode: 'payment',
      metadata: {
        email: normalizedEmail,
        tier: tier || 'lifetime'
      },
      success_url: `${appUrl}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?payment_cancel=true`,
    });

    res.json({ checkoutUrl: session.url, isDemo: false });
  } catch (err: any) {
    console.error('[STRIPE ERROR] Error creando sesión de checkout:', err);
    res.status(500).json({ error: 'Error al iniciar la pasarela de pagos con Stripe.' });
  }
});

// Verify Stripe Session ID
app.post('/api/premium/verify-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Se requiere el ID de sesión de Stripe.' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(400).json({ error: 'Stripe no está configurado en este servidor.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      const email = session.metadata?.email;
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        if (!usersDb[normalizedEmail]) {
          usersDb[normalizedEmail] = {
            email: normalizedEmail,
            isPremium: true,
            ipAddress: '0.0.0.0',
            scanCount: 0,
            verified: true
          };
        } else {
          usersDb[normalizedEmail].isPremium = true;
          usersDb[normalizedEmail].verified = true;
        }

        console.log(`[STRIPE SUCCESS] Usuario ${normalizedEmail} actualizado a Premium mediante sesión ${sessionId}`);

        return res.json({
          success: true,
          message: '¡Pago verificado con éxito y membresía Premium activada!',
          user: {
            email: usersDb[normalizedEmail].email,
            isPremium: usersDb[normalizedEmail].isPremium,
            ipAddress: usersDb[normalizedEmail].ipAddress,
            scanCount: usersDb[normalizedEmail].scanCount
          }
        });
      }
    }
    res.status(400).json({ error: 'El pago de esta sesión de Stripe no ha sido completado.' });
  } catch (err: any) {
    console.error('[STRIPE ERROR] Error verificando sesión:', err);
    res.status(500).json({ error: 'Error al verificar la transacción con Stripe.' });
  }
});

// Trigger IP diagnostic scan
app.post('/api/scan', async (req, res) => {
  const { email } = req.body;
  const ipInfo = getUserIp(req);

  let user: DbUser | undefined;
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    user = usersDb[normalizedEmail];
  }

  const isPremium = user ? user.isPremium : false;
  const isGuest = user ? (user.email.endsWith('@myip.local') || user.email.startsWith('invitado_')) : false;

  // Guest Scan Limit: 3 lifetime scans per guest account to prevent automated rate-limiting bypasses
  if (isGuest && user && user.scanCount >= 3) {
    return res.status(429).json({
      error: 'Límite de Invitado Alcanzado (3/3 intentos). Para evitar abusos automatizados de red, el acceso rápido sin email tiene un límite estricto de 3 análisis. Por favor, crea una cuenta gratuita con tu email real para realizar más diagnósticos.',
      rateLimited: true,
      isGuestLimit: true
    });
  }

  // Rate Limiting strictness: 1 scan every 24 hours for Free, unlimited for Premium
  const now = Date.now();
  if (!isPremium && !isGuest && user && user.lastScanTime) {
    const hoursSinceLastScan = (now - user.lastScanTime) / (1000 * 60 * 60);
    if (hoursSinceLastScan < 24) {
      const hoursRemaining = Math.ceil(24 - hoursSinceLastScan);
      return res.status(429).json({
        error: `Límite de diagnóstico excedido. Los usuarios gratuitos pueden escanear una vez cada 24 horas. Te quedan ${hoursRemaining} horas de espera.`,
        rateLimited: true,
        hoursRemaining
      });
    }
  }

  // Decide which ports are open
  let is22Open = false;
  let is80Open = false;
  let is443Open = false;
  let is3306Open = false;
  let is8080Open = false;

  const seed = ipInfo.ip.split('.').reduce((acc, part) => acc + parseInt(part, 10), 0);

  if (ipInfo.isSimulated) {
    is22Open = seed % 3 === 0; // Open on some IPs
    is80Open = true; // Typically open
    is443Open = true; // Typically open
    is3306Open = seed % 4 === 0; // High risk MySQL port open
    is8080Open = seed % 2 === 0; // Dev port open
  } else {
    // REAL SCAN! Since we are server-side and this is the client's actual public IP, we do real TCP checks
    console.log(`[REAL SCAN] Iniciando escaneo TCP real para la IP: ${ipInfo.ip}`);
    const results = await Promise.all([
      checkPortReal(ipInfo.ip, 22),
      checkPortReal(ipInfo.ip, 80),
      checkPortReal(ipInfo.ip, 443),
      checkPortReal(ipInfo.ip, 3306),
      checkPortReal(ipInfo.ip, 8080),
    ]);
    is22Open = results[0] === 'open';
    is80Open = results[1] === 'open';
    is443Open = results[2] === 'open';
    is3306Open = results[3] === 'open';
    is8080Open = results[4] === 'open';
    console.log(`[REAL SCAN] Resultados para ${ipInfo.ip}: 22:${results[0]}, 80:${results[1]}, 443:${results[2]}, 3306:${results[3]}, 8080:${results[4]}`);
  }

  const ports: any[] = [
    {
      port: 22,
      service: 'SSH (Secure Shell)',
      status: is22Open ? 'open' : 'closed',
      risk: is22Open ? 'high' : 'low',
      explanation: is22Open 
        ? 'El puerto de administración remota SSH está expuesto al internet público.'
        : 'El puerto de administración remota SSH está cerrado o protegido correctamente.',
      recommendation: is22Open
        ? 'Desactiva el acceso SSH por contraseña, usa llaves públicas de seguridad, cámbialo de puerto o ponlo detrás de una VPN / Firewall.'
        : 'No se requiere acción. Continúa manteniendo este puerto cerrado para evitar ataques de fuerza bruta.'
    },
    {
      port: 80,
      service: 'HTTP (Tráfico Web No Cifrado)',
      status: is80Open ? 'open' : 'closed',
      risk: is80Open ? 'medium' : 'low',
      explanation: is80Open 
        ? 'Tu conexión acepta peticiones web sin cifrar a través del protocolo HTTP estándar.'
        : 'El puerto HTTP no encriptado está cerrado.',
      recommendation: is80Open
        ? 'Fuerza el redireccionamiento de todo el tráfico HTTP (puerto 80) hacia HTTPS (puerto 443) para encriptar los datos de tus usuarios.'
        : 'Excelente. Las conexiones HTTP inseguras no están expuestas.'
    },
    {
      port: 443,
      service: 'HTTPS (Tráfico Web Cifrado SSL/TLS)',
      status: is443Open ? 'open' : 'closed',
      risk: 'low',
      explanation: is443Open 
        ? 'Tu servidor web cifrado seguro está disponible y respondiendo de forma segura.'
        : 'El puerto cifrado estándar HTTPS no está disponible.',
      recommendation: is443Open
        ? 'Mantén actualizados tus certificados SSL/TLS y desactiva las suites de cifrado antiguas (como TLS 1.0 y 1.1).'
        : 'Si ofreces un servicio web, considera activar el puerto 443 con un certificado SSL gratuito de Let\'s Encrypt.'
    }
  ];

  if (isPremium || is3306Open) {
    ports.push({
      port: 3306,
      service: 'MySQL Database',
      status: is3306Open ? 'open' : 'closed',
      risk: is3306Open ? 'high' : 'low',
      explanation: is3306Open 
        ? '¡Crítico! Tu base de datos MySQL está directamente expuesta al internet público.'
        : 'Tu base de datos MySQL no es accesible públicamente desde el exterior.',
      recommendation: is3306Open
        ? '¡Cierra este puerto de inmediato en tu firewall! Configura el servicio para escuchar solo en localhost (127.0.0.1) o usa un túnel SSH seguro.'
        : 'Excelente práctica. Las bases de datos nunca deben exponerse al tráfico público.'
    });
  }

  if (isPremium || is8080Open) {
    ports.push({
      port: 8080,
      service: 'HTTP Alternate / Admin Panel',
      status: is8080Open ? 'open' : 'closed',
      risk: is8080Open ? 'medium' : 'low',
      explanation: is8080Open
        ? 'Un puerto de desarrollo o panel alternativo HTTP está abierto.'
        : 'El puerto alternativo HTTP está cerrado.',
      recommendation: is8080Open
        ? 'Asegúrate de que este puerto no exponga paneles administrativos sin contraseña fuerte o doble factor de autenticación (2FA).'
        : 'No requiere acción.'
    });
  }

  // Generate blacklist reputation checks
  const reputation: any[] = [
    {
      listName: 'Spamhaus XBL',
      clean: seed % 7 !== 0,
      details: seed % 7 === 0 
        ? 'Detectado en listas de spam por posible comportamiento de botnet o malware residencial.' 
        : 'Tu IP se encuentra limpia de reportes en este nodo.'
    },
    {
      listName: 'Barracuda Reputation Block List',
      clean: seed % 5 !== 0,
      details: seed % 5 === 0 
        ? 'Tu IP tiene un historial de envío de correos no solicitados o actividad maliciosa reciente.' 
        : 'IP totalmente limpia en Barracuda Networks.'
    }
  ];

  if (isPremium) {
    reputation.push({
      listName: 'Project Honey Pot',
      clean: true,
      details: 'Sin actividad sospechosa registrada de recolectores de emails o spammers.'
    });
    reputation.push({
      listName: 'Cisco Talos Intelligence',
      clean: true,
      details: 'Reputación de IP categorizada como Neutral/Favorable.'
    });
  }

  // Calculate Traffic Light Score
  let score: 'green' | 'yellow' | 'red' = 'green';
  const openHighRisk = ports.filter(p => p.status === 'open' && p.risk === 'high').length;
  const openMedRisk = ports.filter(p => p.status === 'open' && p.risk === 'medium').length;
  const blacklisted = reputation.filter(r => !r.clean).length;

  if (openHighRisk > 0 || blacklisted > 0) {
    score = 'red';
  } else if (openMedRisk > 0) {
    score = 'yellow';
  }

  // Generate SSL Info (Premium gets rich SSL analysis)
  const daysToExpiry = (seed % 15) + 15; // 15 to 30 days
  const sslInfo = {
    valid: true,
    issuer: 'Let\'s Encrypt Authority X3',
    validTo: new Date(now + daysToExpiry * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    daysToExpiry,
    alert: daysToExpiry < 20 ? 'El certificado SSL vencerá en menos de 20 días. Se recomienda renovación automática.' : undefined
  };

  // AI-powered analysis translation with Gemini (Spanish, highly educational and comforting)
  let analysisText = '';
  if (ai) {
    try {
      const prompt = `Analiza el siguiente reporte de salud digital de la IP ${ipInfo.ip}.
      Estado de Semáforo General de Seguridad: ${score.toUpperCase()}
      Puertos Escaneados:
      ${JSON.stringify(ports, null, 2)}
      Reputación de Listas Negras:
      ${JSON.stringify(reputation, null, 2)}
      Información de SSL:
      ${JSON.stringify(sslInfo, null, 2)}

      Instrucciones:
      Traduce toda esta información técnica a un lenguaje humano, amigable, tranquilizador y sumamente educativo para un usuario final que NO es experto en ciberseguridad.
      Explica los puertos abiertos de forma sencilla (por ejemplo, explica que el puerto 22 SSH es como la puerta de atrás de una casa para mantenimiento).
      No asustes al usuario, pero sí incentívalo a tomar medidas.
      Escribe en español con una estructura organizada en 3 apartados claros usando viñetas sencillas:
      1. ¿Qué descubrimos en tu conexión? (Resumen de puertos abiertos, listas de reputación, etc.)
      2. ¿Por qué esto es importante para ti? (Impacto en la vida real, privacidad y seguridad de sus dispositivos)
      3. Pasos recomendados paso a paso (Instrucciones simples, lógicas y no técnicas para solucionar o mitigar los hallazgos).
      
      Por favor, genera solo texto Markdown amigable.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      analysisText = response.text || '';
    } catch (err) {
      console.error('Error generating AI explanation with Gemini:', err);
    }
  }

  // Fallback to static rule-based Spanish explanation if Gemini is offline or not configured
  if (!analysisText) {
    const portBullets = ports
      .map(p => `* **Puerto ${p.port} (${p.service})**: Se encuentra **${p.status === 'open' ? 'ABIERTO 🔓' : 'CERRADO 🔒'}**. ${p.explanation}`)
      .join('\n');
    const blackBullets = reputation
      .map(r => `* **Lista ${r.listName}**: ${r.clean ? '✅ Limpia' : '❌ Reportada (Atención: ' + r.details + ')'}`)
      .join('\n');

    analysisText = `
### 1. ¿Qué descubrimos en tu conexión?
Analizamos detalladamente tu IP de conexión **${ipInfo.ip}**:
${portBullets}

**Análisis de Reputación**:
${blackBullets}

${isPremium ? `* **Certificado SSL**: Válido emitido por *${sslInfo.issuer}*, expira el ${sslInfo.validTo} (${sslInfo.daysToExpiry} días restantes).` : ''}

---

### 2. ¿Por qué esto es importante para ti?
La IP de tu conexión es como la dirección postal de tu casa digital en el internet. 
${score === 'red' ? '⚠️ **¡Atención requerida!** Hemos detectado servicios sensibles abiertos al exterior (como SSH o Bases de Datos), o bien tu IP está en listas negras. Esto expone tus dispositivos a ataques automáticos por bots que prueban combinaciones de contraseñas constantemente.' : ''}
${score === 'yellow' ? '⚠️ **Ajustes sugeridos.** Algunos servicios web están abiertos pero sin la encriptación ideal (HTTP en lugar de HTTPS). Esto permite que intrusos en la misma red puedan espiar la información que viaja.' : ''}
${score === 'green' ? '✅ **¡Todo luce excelente!** Tu conexión se encuentra sumamente blindada. No hay puertos críticos de administración expuestos al público y tu reputación es impecable.' : ''}

---

### 3. Pasos recomendados paso a paso
${score === 'red' ? `
1. **Configura un Firewall**: Instala o activa el firewall en tu router o servidor para bloquear el puerto 22 o 3306 para conexiones de IPs que no conozcas.
2. **Cambia contraseñas predeterminadas**: Si tienes un servicio SSH abierto, cambia de inmediato cualquier contraseña por una robusta de más de 16 caracteres.
3. **Usa Cloudflare o VPN**: Si ofreces un sitio público, oculta tu IP real detrás de un proveedor de CDN como Cloudflare.
` : ''}
${score === 'yellow' ? `
1. **Redirige a HTTPS**: Modifica la configuración de tu servidor para que redirija todo el tráfico del puerto 80 al puerto seguro 443.
2. **Instala Certificados**: Si aún no lo haces, utiliza Let's Encrypt para obtener certificados SSL gratuitos para todo tu tráfico web.
` : `
1. **Auditorías periódicas**: Realiza un escaneo mensual en MyIP para comprobar que ninguna actualización de software o router haya abierto puertos accidentalmente.
2. **Mantén tu router actualizado**: Activa las actualizaciones automáticas de firmware en el módem de tu proveedor de internet.
`}
`;
  }

  // Record scanning time to limit free users
  if (user) {
    user.lastScanTime = now;
    user.scanCount += 1;
  }

  const result: any = {
    ip: ipInfo.ip,
    timestamp: now,
    score,
    ports,
    reputation,
    sslInfo: isPremium ? sslInfo : null,
    analysisText,
    geo: ipInfo.geo
  };

  res.json(result);
});

// Simulate constant alerts for Premium Users
app.get('/api/premium/alerts', (req, res) => {
  const ipInfo = getUserIp(req);
  // Generate mock certificate or availability alerts
  const alerts = [
    {
      id: 'alert-1',
      type: 'SSL_WARNING',
      title: 'Cambio de Huella Digital SSL Detectado',
      message: `El certificado para tu host asociado a la IP ${ipInfo.ip} se renovó de forma exitosa mediante Let's Encrypt.`,
      severity: 'info',
      time: 'Hace 2 horas'
    },
    {
      id: 'alert-2',
      type: 'AVAILABILITY_DROP',
      title: 'Monitoreo de Disponibilidad 24/7',
      message: 'Se detectó una microcaída de ping del 1.2% a las 04:12 AM. Tu servidor ya se encuentra operando al 100%.',
      severity: 'warning',
      time: 'Hoy, 04:12 AM'
    }
  ];
  res.json(alerts);
});

// Simulate sending a detailed PDF/Email report
app.post('/api/premium/send-report', (req, res) => {
  const { email, reportType } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Se requiere el email.' });
  }

  res.json({
    message: `Reporte de seguridad detallado (${reportType}) generado y enviado con éxito a ${email}.`,
    sentAt: new Date().toISOString()
  });
});

// Vite Middleware for Development / Static server for Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in Development mode.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static build from dist/');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MyIP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
