export type RiskLevel = 'low' | 'medium' | 'high';
export type ScanScore = 'green' | 'yellow' | 'red';

export interface PortScanItem {
  port: number;
  service: string;
  status: 'open' | 'closed';
  risk: RiskLevel;
  explanation: string;
  recommendation: string;
}

export interface ReputationItem {
  listName: string;
  clean: boolean;
  details: string;
}

export interface SslInfo {
  valid: boolean;
  issuer: string;
  validTo: string;
  daysToExpiry: number;
  alert?: string;
}

export interface ScanResult {
  ip: string;
  timestamp: number;
  score: ScanScore;
  ports: PortScanItem[];
  reputation: ReputationItem[];
  sslInfo: SslInfo | null;
  analysisText: string;
  geo?: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    isp: string;
  };
}

export interface UserSession {
  email: string;
  isPremium: boolean;
  ipAddress: string;
  lastScanTime?: number;
  scanCount: number;
  isGuest?: boolean;
}

export interface SecurityGuide {
  id: string;
  title: string;
  category: string;
  description: string;
  steps: string[];
  recommendation: string;
  difficulty: 'Fácil' | 'Medio' | 'Avanzado';
}
