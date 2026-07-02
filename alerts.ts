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
      return true;
    }
    console.log(`[RESEND] Error enviando email:`, data);
    return false;
  } catch (err) {
    console.error('[RESEND ERROR]', err);
    return false;
  }
}

function compareScans(prev: any, curr: any): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];
  try {
    const prevPorts = JSON.parse(prev.ports_json || '[]');
    const currPorts = JSON.parse(curr.ports_json || '[]');
    for (const cp of currPorts) {
      const pp = prevPorts.find((p: any) => p.port === cp.port);
      if (pp && pp.status === 'closed' && cp.status === 'open') {
        changes.push(`El puerto ${cp.port} (${cp.service}) se ha ABIERTO desde el ultimo analisis.`);
      }
    }
    const prevRep = JSON.parse(prev.reputation_json || '[]');
    const currRep = JSON.parse(curr.reputation_json || '[]');
    for (const cr of currRep) {
      const pr = prevRep.find((r: any) => r.listName === cr.listName);
      if (pr && pr.clean === true && cr.clean === false) {
        changes.push(`Tu IP ha entrado en la lista negra ${cr.listName} desde el ultimo analisis.`);
      }
    }
  } catch (e) {
    console.error('[COMPARE SCANS] Error:', e);
  }
  return { hasChanges: changes.length > 0, changes };
}

export function startAlertsCron(port: number): void {
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Ejecutando chequeo de alertas premium...');
    const users = authDb.getAllUsers().filter(u =>
      u.isPremium && u.ipAddress && u.ipAddress !== 'pending' && u.ipAddress !== '0.0.0.0'
    );
    for (const u of users) {
      try {
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
        const history = authDb.getScanHistory(u.email, 2);
        if (history.length === 2) {
          const [curr, prev] = history;
          const { hasChanges, changes } = compareScans(prev, curr);
          if (hasChanges) {
            const emailSent = await sendEmail({
              to: u.email,
              subject: 'MyIP: Cambios detectados en tu red',
              text: changes.join('\n'),
              html: `<h2>Cambios detectados en tu IP ${curr.targetIp}</h2><ul>${changes.map(c => `<li>${c}</li>`).join('')}</ul>`,
            });
            if (emailSent) {
              console.log(`[CRON] Alerta enviada a ${u.email}: ${changes.length} cambio(s)`);
            } else {
              console.error(`[CRON] FALLO al enviar alerta a ${u.email} (${changes.length} cambio(s) detectados pero el email no se entrego)`);
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
