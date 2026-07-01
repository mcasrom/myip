// db.ts — Persistencia de usuarios y sesiones. SQLite sincrono, sin JWT.
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'myip.sqlite3'));
db.pragma('journal_mode = WAL');

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
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
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

export function updateUserFields(email: string, fields: Partial<{ isPremium: boolean; ipAddress: string; lastScanTime: number; scanCount: number; premiumCode: string }>): void {
  const current = getUserByEmail(email);
  if (!current) return;
  const merged = { ...current, ...fields };
  db.prepare(`
    UPDATE users SET is_premium = ?, ip_address = ?, last_scan_time = ?, scan_count = ?, premium_code = ?
    WHERE email = ?
  `).run(merged.isPremium ? 1 : 0, merged.ipAddress, merged.lastScanTime ?? null, merged.scanCount, merged.premiumCode ?? null, email);
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
  scanSource: string; geo: any;
}): void {
  db.prepare(`
    INSERT INTO scan_history (email, target_ip, score, score_reason, ports_json, reputation_json, analysis_text, scan_source, geo_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    email, scanData.targetIp, scanData.score, scanData.scoreReason,
    JSON.stringify(scanData.ports), JSON.stringify(scanData.reputation),
    scanData.analysisText, scanData.scanSource, JSON.stringify(scanData.geo),
    Date.now()
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
