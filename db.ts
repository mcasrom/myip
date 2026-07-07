// db.ts — Persistencia de usuarios y sesiones. SQLite sincrono, sin JWT.
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'myip.sqlite3');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// Checkpoint automatico mas frecuente (cada 100 paginas ~400KB en vez de
// las 1000 paginas ~4MB por defecto) para evitar que el .wal crezca sin
// control entre reinicios del server durante desarrollo.
db.pragma('wal_autocheckpoint = 100');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  is_premium INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  last_scan_time INTEGER,
  scan_count INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 1,
  is_guest INTEGER NOT NULL DEFAULT 0,
  premium_code TEXT,
  tier TEXT,
  monthly_scan_count INTEGER NOT NULL DEFAULT 0,
  monthly_scan_reset TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS geo_cache (
  ip TEXT PRIMARY KEY,
  country TEXT,
  countryCode TEXT,
  region TEXT,
  city TEXT,
  isp TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  target_ip TEXT NOT NULL,
  score TEXT NOT NULL,
  score_reason TEXT,
  ports_json TEXT,
  reputation_json TEXT,
  analysis_text TEXT,
  scan_source TEXT,
  geo_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (email) REFERENCES users(email)
);
`);

// Migracion para bases de datos YA EXISTENTES (SQLite no soporta
// "ADD COLUMN IF NOT EXISTS"; se intenta añadir y se ignora el error
// si la columna ya existe, p.ej. en un CREATE TABLE nuevo).
try { db.exec('ALTER TABLE users ADD COLUMN tier TEXT'); } catch (e) { /* columna ya existe */ }
try { db.exec('ALTER TABLE users ADD COLUMN monthly_scan_count INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* columna ya existe */ }
try { db.exec('ALTER TABLE users ADD COLUMN monthly_scan_reset TEXT'); } catch (e) { /* columna ya existe */ }
try { db.exec('ALTER TABLE scan_history ADD COLUMN score_numeric INTEGER'); } catch (e) { /* columna ya existe */ }

// Tabla de estadísticas del sistema (una sola fila)
db.exec(`
CREATE TABLE IF NOT EXISTS system_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  emails_sent INTEGER NOT NULL DEFAULT 0,
  last_cron_run INTEGER,
  last_cron_alerts INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO system_stats (id, updated_at) VALUES (1, strftime('%s', 'now') * 1000);
`);

export function incrementEmailsSent(): void {
  db.prepare('UPDATE system_stats SET emails_sent = emails_sent + 1, updated_at = ? WHERE id = 1').run(Date.now());
}

export function updateLastCronRun(alertsCount: number): void {
  db.prepare('UPDATE system_stats SET last_cron_run = ?, last_cron_alerts = ?, updated_at = ? WHERE id = 1')
    .run(Date.now(), alertsCount, Date.now());
}

export function getSystemStats(): { totalUsers: number; premiumUsers: number; guestUsers: number; totalScans: number; emailsSent: number; lastCronRun: number | null; lastCronAlerts: number; serverStartTime: number } {
  const users = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_premium = 1 THEN 1 ELSE 0 END) as premium, SUM(CASE WHEN is_guest = 1 THEN 1 ELSE 0 END) as guest FROM users').get() as any;
  const scans = db.prepare('SELECT COUNT(*) as total FROM scan_history').get() as any;
  const stats = db.prepare('SELECT emails_sent, last_cron_run, last_cron_alerts FROM system_stats WHERE id = 1').get() as any;
  return {
    totalUsers: users?.total || 0,
    premiumUsers: users?.premium || 0,
    guestUsers: users?.guest || 0,
    totalScans: scans?.total || 0,
    emailsSent: stats?.emails_sent || 0,
    lastCronRun: stats?.last_cron_run || null,
    lastCronAlerts: stats?.last_cron_alerts || 0,
    serverStartTime: serverStartTimestamp,
  };
}

export function getCommunityStats(): { avgScore: number | null; totalScored: number } {
  const row = db.prepare('SELECT AVG(score_numeric) as avg, COUNT(*) as total FROM scan_history WHERE score_numeric IS NOT NULL').get() as any;
  return {
    avgScore: row?.avg !== null && row?.avg !== undefined ? Math.round(row.avg) : null,
    totalScored: row?.total || 0,
  };
}
const serverStartTimestamp = Date.now();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface StoredUser {
  email: string;
  passwordHash: string;
  isPremium: boolean;
  ipAddress: string;
  lastScanTime?: number;
  scanCount: number;
  verified: boolean;
  isGuest: boolean;
  premiumCode?: string;
  tier?: string;
  monthlyScanCount: number;
  monthlyScanReset?: string;
}

function rowToUser(row: any): StoredUser {
  return {
    email: row.email,
    passwordHash: row.password_hash,
    isPremium: !!row.is_premium,
    ipAddress: row.ip_address,
    lastScanTime: row.last_scan_time ?? undefined,
    scanCount: row.scan_count,
    verified: !!row.verified,
    isGuest: !!row.is_guest,
    premiumCode: row.premium_code ?? undefined,
    tier: row.tier ?? undefined,
    monthlyScanCount: row.monthly_scan_count ?? 0,
    monthlyScanReset: row.monthly_scan_reset ?? undefined,
  };
}

export function getAllUsers(): StoredUser[] {
  return (db.prepare('SELECT * FROM users').all() as any[]).map(rowToUser);
}

export function getUserByEmail(email: string): StoredUser | undefined {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  return row ? rowToUser(row as any) : undefined;
}

export async function createUserWithPassword(email: string, plainPassword: string, ipAddress: string): Promise<StoredUser> {
  const passwordHash = await bcrypt.hash(plainPassword, 12);
  db.prepare(`
    INSERT INTO users (email, password_hash, is_premium, ip_address, scan_count, verified, is_guest, created_at)
    VALUES (?, ?, 0, ?, 0, 1, 0, ?)
  `).run(email, passwordHash, ipAddress, Date.now());
  return getUserByEmail(email)!;
}

export async function verifyPassword(email: string, plainPassword: string): Promise<boolean> {
  const user = getUserByEmail(email);
  if (!user) return false;
  return bcrypt.compare(plainPassword, user.passwordHash);
}

export function updateUserFields(email: string, fields: Partial<{ isPremium: boolean; ipAddress: string; lastScanTime: number; scanCount: number; premiumCode: string; tier: string; monthlyScanCount: number; monthlyScanReset: string }>): void {
  const current = getUserByEmail(email);
  if (!current) return;
  const merged = { ...current, ...fields };
  db.prepare(`
    UPDATE users SET is_premium = ?, ip_address = ?, last_scan_time = ?, scan_count = ?, premium_code = ?, tier = ?, monthly_scan_count = ?, monthly_scan_reset = ?
    WHERE email = ?
  `).run(merged.isPremium ? 1 : 0, merged.ipAddress, merged.lastScanTime ?? null, merged.scanCount, merged.premiumCode ?? null, merged.tier ?? null, merged.monthlyScanCount ?? 0, merged.monthlyScanReset ?? null, email);
}

export function createSession(email: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, email, now, now + SESSION_TTL_MS);
  return token;
}

export function getSessionUser(token: string): StoredUser | undefined {
  const row = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, Date.now());
  if (!row) return undefined;
  return getUserByEmail((row as any).email);
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteUserAccount(email: string): void {
  db.prepare('DELETE FROM sessions WHERE email = ?').run(email);
  db.prepare('DELETE FROM scan_history WHERE email = ?').run(email);
  db.prepare('DELETE FROM users WHERE email = ?').run(email);
}

// Scan History
export interface ScanRecord {
  id: number;
  email: string;
  targetIp: string;
  score: string;
  scoreReason: string;
  portsJson: string;
  reputationJson: string;
  analysisText: string;
  scanSource: string;
  geoJson: string;
  createdAt: number;
}

export function saveScanRecord(email: string, scanData: {
  targetIp: string; score: string; scoreReason: string;
  ports: any[]; reputation: any[]; analysisText: string;
  scanSource: string; geo: any; scoreNumeric?: number;
}): void {
  db.prepare(`
    INSERT INTO scan_history (email, target_ip, score, score_reason, ports_json, reputation_json, analysis_text, scan_source, geo_json, created_at, score_numeric)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    email, scanData.targetIp, scanData.score, scanData.scoreReason,
    JSON.stringify(scanData.ports), JSON.stringify(scanData.reputation),
    scanData.analysisText, scanData.scanSource, JSON.stringify(scanData.geo),
    Date.now(), scanData.scoreNumeric ?? null
  );
}

export function getScanHistory(email: string, limit = 50): ScanRecord[] {
  return db.prepare(`
    SELECT * FROM scan_history WHERE email = ? ORDER BY created_at DESC LIMIT ?
  `).all(email, limit) as ScanRecord[];
}

export function getScanRecord(id: number, email: string): ScanRecord | undefined {
  const row = db.prepare('SELECT * FROM scan_history WHERE id = ? AND email = ?').get(id, email);
  return row as ScanRecord | undefined;
}

export default db;

// Geo Cache
export interface GeoData {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  updated_at: number;
}

export function getGeoFromCache(ip: string): GeoData | undefined {
  const row = db.prepare('SELECT * FROM geo_cache WHERE ip = ? AND updated_at > ?').get(ip, Date.now() - (24 * 60 * 60 * 1000));
  return row as GeoData | undefined;
}

export function saveGeoToCache(ip: string, data: { country: string; countryCode: string; region: string; city: string; isp: string }): void {
  db.prepare(
    'INSERT OR REPLACE INTO geo_cache (ip, country, countryCode, region, city, isp, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(ip, data.country, data.countryCode, data.region, data.city, data.isp, Date.now());
}
