import https from 'https';
import cron from 'node-cron';
import * as authDb from './db';

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
      authDb.incrementEmailsSent();
      return true;
    }
    console.log(`[RESEND] Error enviando email:`, data);
    return false;
  } catch (err) {
    console.error('[RESEND ERROR]', err);
    return false;
  }
}

export function compareScans(prev: any, curr: any): { hasChanges: boolean; changes: string[]; severity: 'low' | 'medium' | 'critical' } {
  const changes: string[] = [];
  let severity: 'low' | 'medium' | 'critical' = 'low';
  try {
    // 1. Score drop
    const prevScore = prev.score_numeric ?? scoreToNumeric(prev.score);
    const currScore = curr.score_numeric ?? scoreToNumeric(curr.score);
    if (currScore < prevScore - 10) {
      changes.push(`⚠️ Tu score de seguridad ha bajado de ${prevScore} a ${currScore}. Revisa los detalles.`);
      severity = currScore < 50 ? 'critical' : 'medium';
    }

    // 2. New open ports
    const prevPorts = JSON.parse(prev.ports_json || '[]');
    const currPorts = JSON.parse(curr.ports_json || '[]');
    for (const cp of currPorts) {
      const pp = prevPorts.find((p: any) => p.port === cp.port);
      if (pp && pp.status === 'closed' && cp.status === 'open') {
        const risk = cp.risk || 'medium';
        changes.push(`🔓 El puerto ${cp.port} (${cp.service}) se ha ABIERTO. Riesgo: ${risk.toUpperCase()}.`);
        if (risk === 'high') severity = 'critical';
        else if (severity !== 'critical') severity = 'medium';
      }
    }

    // 3. New blacklist entries
    const prevRep = JSON.parse(prev.reputation_json || '[]');
    const currRep = JSON.parse(curr.reputation_json || '[]');
    for (const cr of currRep) {
      const pr = prevRep.find((r: any) => r.listName === cr.listName);
      if (pr && pr.clean === true && cr.clean === false) {
        changes.push(`🚫 Tu IP ha entrado en la lista negra ${cr.listName}.`);
        severity = 'critical';
      }
    }
  } catch (e) {
    console.error('[COMPARE SCANS] Error:', e);
  }
  return { hasChanges: changes.length > 0, changes, severity };
}

function scoreToNumeric(score: string): number {
  switch (score?.toLowerCase()) {
    case 'green': return 85;
    case 'yellow': return 50;
    case 'red': return 20;
    default: return 50;
  }
}

export function startAlertsCron(port: number): void {
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Ejecutando chequeo de alertas premium...');
    authDb.cleanOldAlertLogs(); // Limpieza mensual
    
    const users = authDb.getAllUsers().filter(u =>
      u.isPremium && u.ipAddress && u.ipAddress !== 'pending' && u.ipAddress !== '0.0.0.0'
    );
    
    for (const u of users) {
      try {
        // 1. Detectar IP actual (puede haber cambiado)
        const currentIpRes = await fetch(`http://localhost:${port}/api/ip/detect`);
        const currentIpData = await currentIpRes.json();
        const currentIp = currentIpData.ip;
        
        // Si la IP cambio significativamente, alertar y saltar escaneo detallado
        if (currentIp !== u.ipAddress) {
          const lastIpAlert = authDb.getLastAlertTime(u.email, 'ip_change');
          if (!lastIpAlert || Date.now() - lastIpAlert > 24 * 60 * 60 * 1000) {
            await sendEmail({
              to: u.email,
              subject: 'MyIP: Tu IP pública ha cambiado',
              text: `Tu IP pública ha cambiado de ${u.ipAddress} a ${currentIp}. MyIP actualizará tu registro automáticamente.`,
              html: `<p>Tu IP pública ha cambiado de <strong>${u.ipAddress}</strong> a <strong>${currentIp}</strong>.</p>`
            });
            authDb.logAlert(u.email, 'ip_change', `IP changed from ${u.ipAddress} to ${currentIp}`);
            authDb.updateUserFields(u.email, { ipAddress: currentIp });
          }
          continue;
        }

        // 2. Escanear IP actual
        const res = await fetch(`http://localhost:${port}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetIp: u.ipAddress, email: u.email }),
        });
        if (!res.ok) {
          console.log(`[CRON] Scan fallido para ${u.email}: ${res.status}`);
          continue;
        }
        await res.json();
        
        // 3. Comparar ultimos 2 escaneos
        const history = authDb.getScanHistory(u.email, 2);
        if (history.length >= 2) {
          const [curr, prev] = history;
          const { hasChanges, changes, severity } = compareScans(prev, curr);
          
          if (hasChanges) {
            // 4. Verificar spam
            const lastAlert = authDb.getLastAlertTime(u.email, 'security_alert');
            if (lastAlert && Date.now() - lastAlert < 24 * 60 * 60 * 1000) {
              console.log(`[CRON] Alerta omitida para ${u.email} (enviada hace menos de 24h)`);
              continue;
            }

            // 5. Enviar email
            const emailSent = await sendEmail({
              to: u.email,
              subject: severity === 'critical' ? '🚨 MyIP: ALERTA CRÍTICA de seguridad' : 'MyIP: Cambios detectados en tu red',
              text: changes.join('\n'),
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                  <div style="background: ${severity === 'critical' ? '#dc2626' : '#111827'}; padding: 20px 24px;">
                    <span style="color: #ffffff; font-size: 18px; font-weight: bold;">SIEG &middot; myip</span>
                  </div>
                  <div style="padding: 24px; color: #1f2937;">
                    <h2 style="font-size: 18px; margin: 0 0 12px 0; color: ${severity === 'critical' ? '#dc2626' : '#111827'};">
                      ${severity === 'critical' ? '⚠️ ALERTA CRÍTICA' : 'Cambios detectados'}
                    </h2>
                    <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
                      Se detectaron cambios en <strong>${curr.targetIp}</strong>:
                    </p>
                    <ul style="font-size: 14px; line-height: 1.6; padding-left: 20px; margin: 0 0 24px 0;">
                      ${changes.map(c => `<li style="margin-bottom: 8px;">${c}</li>`).join('')}
                    </ul>
                    <div style="text-align: center;">
                      <a href="${process.env.APP_URL || 'https://myip.viajeinteligencia.com'}"
                         style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none;
                                padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                        Ver detalles en mi panel
                      </a>
                    </div>
                  </div>
                  <div style="background: #f3f4f6; padding: 16px 24px; text-align: center;">
                    <p style="font-size: 11px; color: #9ca3af; margin: 0;">
                      SIEG &middot; myip.viajeinteligencia.com
                    </p>
                  </div>
                </div>
              `,
            });
            
            if (emailSent) {
              authDb.logAlert(u.email, 'security_alert', changes.join('; '));
              console.log(`[CRON] Alerta enviada a ${u.email}: ${changes.length} cambio(s)`);
            } else {
              console.error(`[CRON] FALLO al enviar alerta a ${u.email}`);
            }
          } else {
            console.log(`[CRON] Sin cambios para ${u.email}`);
          }
        }
      } catch (e) {
        console.error(`[CRON] Error procesando ${u.email}:`, e);
      }
    }
  });
}
