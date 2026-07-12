// securityKpis.ts — KPIs de seguridad agregados desde fail2ban_history.db (sieg-security)
// Conexion de solo lectura, independiente de myip.sqlite3
import Database from 'better-sqlite3';

const SIEG_DB_PATH = process.env.SIEG_SECURITY_DB_PATH || '/data/sieg-security/fail2ban_history.db';

let siegDb: Database.Database | null = null;

function getSiegDb(): Database.Database {
  if (!siegDb) {
    siegDb = new Database(SIEG_DB_PATH, { readonly: true, fileMustExist: true });
  }
  return siegDb;
}

function maskSubnet(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  return ip;
}

export interface SecurityKpis {
  generated: string;
  total_events: number;
  total_bans: number;
  unique_ips: number;
  date_range: { oldest: string; newest: string };
  top_countries: { country_code: string; country: string; attacks: number }[];
  weekly: { week: string; attacks: number }[];
  monthly: { month: string; attacks: number }[];
  hourly: { hour: string; attacks: number }[];
  avg_ban_duration_minutes: { jail: string; minutes: number }[];
  top_subnets: { subnet: string; attacks: number; unique_ips: number }[];
  data_gaps: { from: string; to: string; note: string }[];
}

export function getSecurityKpis(): SecurityKpis {
  const db = getSiegDb();

  const totals = db.prepare(`
    SELECT COUNT(*) AS total_events,
           SUM(CASE WHEN event='ban' THEN 1 ELSE 0 END) AS total_bans,
           COUNT(DISTINCT ip) AS unique_ips
    FROM events
  `).get() as any;

  const range = db.prepare(`SELECT MIN(timestamp) AS oldest, MAX(timestamp) AS newest FROM events`).get() as any;

  const top_countries = db.prepare(`
    SELECT g.country_code AS country_code, MAX(g.country) AS country, COUNT(*) AS attacks
    FROM events e
    JOIN geo_cache g ON e.ip = g.ip
    WHERE e.event = 'ban'
    GROUP BY g.country_code
    ORDER BY attacks DESC
    LIMIT 10
  `).all() as any[];

  const weekly = db.prepare(`
    SELECT strftime('%Y-W%W', timestamp) AS week, COUNT(*) AS attacks
    FROM events WHERE event='ban'
    GROUP BY week ORDER BY week
  `).all() as any[];

  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', timestamp) AS month, COUNT(*) AS attacks
    FROM events WHERE event='ban'
    GROUP BY month ORDER BY month
  `).all() as any[];

  const hourly = db.prepare(`
    SELECT strftime('%H', timestamp) AS hour, COUNT(*) AS attacks
    FROM events WHERE event='ban'
    GROUP BY hour ORDER BY hour
  `).all() as any[];

  const avg_ban_duration_minutes = db.prepare(`
    SELECT b.jail AS jail, ROUND(AVG(
      (julianday(u.timestamp) - julianday(b.timestamp)) * 24 * 60
    ), 1) AS minutes
    FROM events b
    JOIN events u ON b.ip = u.ip AND b.jail = u.jail AND u.timestamp > b.timestamp AND u.event='unban'
    WHERE b.event = 'ban'
    GROUP BY b.jail
  `).all() as any[];

  // Clustering por subred /24 (calculado en JS, SQLite no parsea IPs nativamente)
  const allBans = db.prepare(`SELECT ip FROM events WHERE event='ban'`).all() as { ip: string }[];
  const subnetMap = new Map<string, { attacks: number; ips: Set<string> }>();
  for (const row of allBans) {
    const subnet = maskSubnet(row.ip);
    if (!subnetMap.has(subnet)) subnetMap.set(subnet, { attacks: 0, ips: new Set() });
    const entry = subnetMap.get(subnet)!;
    entry.attacks += 1;
    entry.ips.add(row.ip);
  }
  const top_subnets = Array.from(subnetMap.entries())
    .map(([subnet, v]) => ({ subnet, attacks: v.attacks, unique_ips: v.ips.size }))
    .sort((a, b) => b.attacks - a.attacks)
    .slice(0, 10);

  return {
    generated: new Date().toISOString(),
    total_events: totals.total_events,
    total_bans: totals.total_bans,
    unique_ips: totals.unique_ips,
    date_range: { oldest: range.oldest, newest: range.newest },
    top_countries: top_countries.map(c => ({ country_code: c.country_code, country: c.country, attacks: c.attacks })),
    weekly,
    monthly,
    hourly,
    avg_ban_duration_minutes,
    top_subnets,
    // Documentado manualmente: hueco de recoleccion causado por dependencia del dashboard,
    // resuelto con collect_fail2ban_events.py via cron (12 jul 2026). No indica ausencia real de ataques.
    data_gaps: [
      { from: '2026-05-30', to: '2026-06-25', note: 'Corte de recoleccion de datos (monitor dependiente del dashboard); no representa ausencia real de ataques.' }
    ]
  };
}
