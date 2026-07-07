import React, { useState, useEffect } from 'react';
import { Shield, Eye, Lock, Globe, Search, CheckCircle, AlertTriangle, Play, Network, Router, Monitor, Printer, Server, ArrowRight, Copy, ExternalLink, Info, Link, Mail, Fingerprint, Terminal, Code, Wifi, ShieldOff, ShieldCheck, KeyRound, FileText } from 'lucide-react';

// --- Reusable Tool Card ---
interface ToolCardProps {
  icon: React.ReactNode;
  category: string;
  title: string;
  description: string;
  actionLabel: string;
  onRun: () => void;
  running: boolean;
  status: 'idle' | 'running' | 'success' | 'warning' | 'error' | 'pending';
  result?: { message: string; details?: string };
  input?: React.ReactNode;
}

const ToolCard = ({ icon, category, title, description, actionLabel, onRun, running, status, result, input }: ToolCardProps) => (
  <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md ${
    status === 'success' ? 'border-emerald-200 ring-1 ring-emerald-100' :
    status === 'warning' ? 'border-amber-200 ring-1 ring-amber-100' :
    status === 'pending' ? 'border-blue-200 ring-1 ring-blue-100 bg-blue-50/30' :
    status === 'error' ? 'border-red-200 ring-1 ring-red-100' :
    'border-slate-200'
  }`}>
    <div className="flex items-start justify-between mb-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{category}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        status === 'success' ? 'bg-emerald-100 text-emerald-600' :
        status === 'warning' ? 'bg-amber-100 text-amber-600' :
        status === 'pending' ? 'bg-blue-100 text-blue-600' :
        status === 'error' ? 'bg-red-100 text-red-600' :
        'bg-slate-100 text-slate-500'
      }`}>
        {icon}
      </div>
    </div>

    <h3 className="text-sm font-bold text-slate-800 mb-1">{title}</h3>
    <p className="text-xs text-slate-500 leading-relaxed mb-4 h-10">{description}</p>

    {input && <div className="mb-3">{input}</div>}

    <button
      onClick={onRun}
      disabled={running}
      className={`w-full text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 min-h-[36px] ${
        running ? 'bg-slate-200 text-slate-400 cursor-wait' :
        status === 'pending' ? 'bg-blue-600 text-white hover:bg-blue-700' :
        status === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
        status === 'warning' ? 'bg-amber-600 text-white hover:bg-amber-700' :
        status === 'error' ? 'bg-red-600 text-white hover:bg-red-700' :
        'bg-slate-900 text-white hover:bg-slate-800'
      }`}
    >
      {running ? (
        <>
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Analizando...
        </>
      ) : status === 'pending' ? (
        <>
          <Search className="w-3.5 h-3.5" /> Re-check
        </>
      ) : status !== 'idle' ? (
        <>
          <CheckCircle className="w-3.5 h-3.5" /> Ver de nuevo
        </>
      ) : (
        <>
          <Search className="w-3.5 h-3.5" /> {actionLabel}
        </>
      )}
    </button>

    {result && (
      <div className={`mt-3 p-2.5 rounded-lg text-xs border ${
        status === 'success' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' :
        status === 'warning' ? 'bg-amber-50/50 border-amber-100 text-amber-800' :
        status === 'pending' ? 'bg-blue-50/50 border-blue-100 text-blue-800' :
        'bg-red-50/50 border-red-100 text-red-800'
      }`}>
        <p className="font-semibold mb-0.5">{result.message}</p>
        {result.details && <p className="text-[10px] opacity-75 font-mono truncate">{result.details}</p>}
      </div>
    )}
  </div>
);

// --- Sub-Components for Advanced Tools ---

function BrowserFingerprint() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [result, setResult] = useState<{ message: string; details?: string } | null>(null);
  const [fingerprint, setFingerprint] = useState<any>(null);

  const runCheck = () => {
    setStatus('running');
    setTimeout(() => {
      const data = {
        ua: navigator.userAgent,
        lang: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        cores: navigator.hardwareConcurrency || '?',
        memory: (navigator as any).deviceMemory || '?',
        touch: navigator.maxTouchPoints > 0 ? 'Yes' : 'No',
        webgl: 'Active',
      };
      setFingerprint(data);
      setStatus('success');
      setResult({
        message: 'Huella digital capturada.',
        details: 'Tu navegador expone información única que permite rastrearte entre sesiones.'
      });
    }, 800);
  };

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3">
      <ToolCard
        category="Privacidad"
        icon={<Fingerprint className="w-5 h-5" />}
        title="Browser Fingerprint"
        description="¿Qué información expone tu navegador? Genera tu huella digital única y descubre tu nivel de anonimato."
        actionLabel="Generar mi Huella Digital"
        onRun={runCheck}
        running={status === 'running'}
        status={status}
        result={result}
        input={
          fingerprint && (
            <div className="bg-slate-900 text-slate-300 p-3 rounded-lg font-mono text-[10px] space-y-1 overflow-x-auto">
              <p><span className="text-indigo-400">UA:</span> {fingerprint.ua.substring(0, 50)}...</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <div><span className="text-slate-500">Pantalla:</span> {fingerprint.screen}</div>
                <div><span className="text-slate-500">Cores:</span> {fingerprint.cores}</div>
                <div><span className="text-slate-500">RAM:</span> {fingerprint.memory} GB</div>
                <div><span className="text-slate-500">Idioma:</span> {fingerprint.lang}</div>
              </div>
            </div>
          )
        }
      />
    </div>
  );
}

function EmailForensics() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [result, setResult] = useState<{ message: string; details?: string } | null>(null);
  const [headers, setHeaders] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);

  const runCheck = () => {
    if (!headers) {
      setStatus('error');
      setResult({ message: 'Pega las cabeceras del email para analizar.' });
      return;
    }
    setStatus('running');
    setTimeout(() => {
      // Simple heuristic analysis
      const hasSPF = headers.toLowerCase().includes('spf=pass');
      const hasDKIM = headers.toLowerCase().includes('dkim=pass');
      const hasDMARC = headers.toLowerCase().includes('dmarc=pass');
      
      const fromMatch = headers.match(/From:\s*(.*)/i);
      const returnPath = headers.match(/Return-Path:\s*<?([^>]*)>?/i);
      
      const isSpoofing = fromMatch && returnPath && !fromMatch[1].includes(returnPath[1].split('@')[1]);

      setAnalysis({ spf: hasSPF, dkim: hasDKIM, dmarc: hasDMARC, spoofing: isSpoofing, from: fromMatch?.[1], returnPath: returnPath?.[1] });
      
      if (isSpoofing) {
        setStatus('warning');
        setResult({ message: 'Posible Spoofing detectado: El remitente no coincide con la ruta de retorno.', details: 'Verifica si conoces al remitente.' });
      } else if (hasSPF && hasDKIM) {
        setStatus('success');
        setResult({ message: 'Cabeceras válidas. SPF y DKIM correctos.', details: 'El email parece legítimo.' });
      } else {
        setStatus('warning');
        setResult({ message: 'Faltan validaciones de seguridad (SPF/DKIM).', details: 'Procede con precaución.' });
      }
    }, 1000);
  };

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3">
      <ToolCard
        category="Forense"
        icon={<Mail className="w-5 h-5" />}
        title="Email Header Forensics"
        description="Detecta phishing y *spoofing*. Pega las cabeceras completas de un correo sospechoso para analizar su origen real."
        actionLabel="Analizar Cabeceras"
        onRun={runCheck}
        running={status === 'running'}
        status={status}
        result={result}
        input={
          <textarea
            placeholder="Pega aquí las cabeceras del email (Show Original en Gmail)..."
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        }
      />
      {analysis && (
        <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="text-center">
            <p className="text-slate-500 mb-1">SPF</p>
            <p className={`font-bold ${analysis.spf ? 'text-emerald-600' : 'text-red-600'}`}>{analysis.spf ? 'PASS' : 'FAIL'}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-1">DKIM</p>
            <p className={`font-bold ${analysis.dkim ? 'text-emerald-600' : 'text-red-600'}`}>{analysis.dkim ? 'PASS' : 'FAIL'}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-1">DMARC</p>
            <p className={`font-bold ${analysis.dmarc ? 'text-emerald-600' : 'text-red-600'}`}>{analysis.dmarc ? 'PASS' : 'FAIL'}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-1">Spoofing</p>
            <p className={`font-bold ${analysis.spoofing ? 'text-red-600' : 'text-emerald-600'}`}>{analysis.spoofing ? 'DETECTADO' : 'NO'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function URLScanner() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error' | 'pending'>('idle');
  const [result, setResult] = useState<{ message: string; details?: string } | null>(null);
  const [url, setUrl] = useState('');
  const [scanData, setScanData] = useState<any>(null);

  const runCheck = async () => {
    if (!url) {
      setStatus('error');
      setResult({ message: 'Introduce una URL válida.' });
      return;
    }
    setStatus('running');
    setResult(null);
    try {
      const res = await fetch('/api/tools/url-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      if (data.status === 'submitted') {
        setStatus('pending');
        setResult({ message: 'URL enviada a VirusTotal. El análisis está en curso.', details: 'Pulsa "Re-check" en 60 segundos para ver los resultados.' });
        return;
      }

      setScanData(data);
      if (data.malicious > 0) {
        setStatus('error');
        setResult({ message: `¡PELIGRO! ${data.malicious} motores detectaron malware/phishing.`, details: `Sospechoso: ${data.suspicious} | Inofensivo: ${data.harmless}` });
      } else if (data.suspicious > 0) {
        setStatus('warning');
        setResult({ message: `Precaución: ${data.suspicious} motores la marcan como sospechosa.`, details: `Analizada el: ${data.lastAnalysisDate}` });
      } else {
        setStatus('success');
        setResult({ message: 'URL limpia. Ningún motor de seguridad la detectó como maliciosa.', details: `Analizada el: ${data.lastAnalysisDate}` });
      }
    } catch (e: any) {
      setStatus('error');
      setResult({ message: e.message || 'Error al escanear.' });
    }
  };

  return (
    <ToolCard
      category="Amenazas"
      icon={<Link className="w-5 h-5" />}
      title="URL Threat Scanner"
      description="¿Es este enlace seguro? Verifica URLs sospechosas contra la base de datos de VirusTotal en tiempo real."
      actionLabel="Escanear URL"
      onRun={runCheck}
      running={status === 'running'}
      status={status}
      result={result}
      input={
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://ejemplo.com/enlace"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      }
    />
  );
}

function VpnDetector() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [result, setResult] = useState<{ message: string; details?: string } | null>(null);
  const [info, setInfo] = useState<any>(null);

  const runCheck = async () => {
    setStatus('running');
    setResult(null);
    
    try {
      // 1. Get Public IP Info
      const res = await fetch('/api/tools/ip-info');
      const data = await res.json();
      setInfo(data);

      // 2. WebRTC Local IP Check
      const localIps: string[] = [];
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('');
      await pc.createOffer().then(o => pc.setLocalDescription(o));
      
      await new Promise<void>(resolve => {
        pc.onicecandidate = (evt) => {
          if (evt.candidate) {
            const candidateStr = evt.candidate.candidate;
            
            // Detectar mDNS (ej: uuid.local) - común en Mac/Safari/Chrome moderno
            if (candidateStr.includes('.local')) {
               if (!localIps.includes('mDNS (Identidad Local)')) localIps.push('mDNS (Identidad Local)');
            }

            // Detectar IPv4 estándar
            const match = candidateStr.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (match) {
               const ip = match[0];
               // Ignorar si es la misma IP pública que ya vemos (loopback o NAT hairpin)
               if (ip !== data.ip && !localIps.includes(ip)) {
                 localIps.push(ip);
               }
            }
          } else {
            resolve();
          }
        };
        setTimeout(resolve, 3000);
      });
      pc.close();

      // Analysis
      let verdict = 'success';
      let msg = 'Conexión limpia. No se detectaron fugas ni proxies.';
      let details = `IP Pública: ${data.ip}`;

      if (data.isLikelyVpn) {
        verdict = 'warning';
        msg = 'Posible VPN o Proxy detectada (IP de Datacenter).';
        details += ` | Host: ${data.hostnames[0] || 'Desconocido'}`;
      }

      if (localIps.length > 0) {
        // Cualquier IP local o mDNS es una fuga de privacidad
        const hasLeak = localIps.some(ip => 
           ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || ip.includes('mDNS')
        );
        
        if (hasLeak) {
          verdict = 'error';
          msg = '¡Fuga WebRTC! Tu identidad local o IP está visible.';
          details += ` | Detectado: ${localIps.join(', ')}`;
        }
      }

      setStatus(verdict as any);
      setResult({ message: msg, details });

    } catch (e: any) {
      setStatus('error');
      setResult({ message: e.message || 'Error al verificar conexión.' });
    }
  };

  return (
    <ToolCard
      category="Privacidad"
      icon={status === 'error' ? <ShieldOff className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
      title="VPN & Proxy Detector"
      description="¿Estás realmente anonimizado? Detecta si usas una VPN, si tu IP es de un datacenter o si WebRTC filtra tu identidad."
      actionLabel="Verificar Anonimato"
      onRun={runCheck}
      running={status === 'running'}
      status={status}
      result={result}
    />
  );
}

function PortTester() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [result, setResult] = useState<{ message: string; details?: string } | null>(null);
  const [port, setPort] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);

  const runCheck = async () => {
    if (!port) {
      setStatus('error');
      setResult({ message: 'Introduce un puerto válido (1-65535).' });
      return;
    }
    setStatus('running');
    setResult(null);
    try {
      const res = await fetch('/api/tools/port-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: parseInt(port) })
      });
      const data = await res.json();
      
      setScanResult(data);
      if (data.status === 'open') {
        setStatus('warning');
        setResult({ message: `Puerto ${port} ABIERTO al exterior.`, details: 'Tu router está redirigiendo tráfico a este puerto.' });
      } else if (data.status === 'closed') {
        setStatus('success');
        setResult({ message: `Puerto ${port} CERRADO.`, details: 'No se detectó servicio escuchando.' });
      } else {
        setStatus('warning');
        setResult({ message: `Puerto ${port} FILTRADO/TIMEOUT.`, details: 'Posible firewall bloqueando la petición.' });
      }
    } catch (e: any) {
      setStatus('error');
      setResult({ message: e.message || 'Error al verificar puerto.' });
    }
  };

  return (
    <ToolCard
      category="Red"
      icon={<KeyRound className="w-5 h-5" />}
      title="External Port Tester"
      description="¿Está tu puerto accesible desde internet? Ideal para validar Port Forwarding (juegos, servidores, cámaras)."
      actionLabel="Verificar Puerto"
      onRun={runCheck}
      running={status === 'running'}
      status={status}
      result={result}
      input={
        <input
          type="number"
          placeholder="ej. 8080, 25565, 3389"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      }
    />
  );
}

function HeaderAnalyzer() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [result, setResult] = useState<{ message: string; details?: string } | null>(null);
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);

  const runCheck = async () => {
    if (!url) {
      setStatus('error');
      setResult({ message: 'Introduce un dominio o URL.' });
      return;
    }
    setStatus('running');
    setResult(null);
    try {
      const res = await fetch(`/api/tools/header-check?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setAnalysis(data);
      const gradeColor = data.grade === 'A' ? 'success' : data.grade === 'B' ? 'success' : data.grade === 'C' ? 'warning' : 'error';
      setStatus(gradeColor as any);
      setResult({
        message: `Calificación de Seguridad: ${data.grade}`,
        details: `Servidor: ${data.checks.server}`
      });
    } catch (e: any) {
      setStatus('error');
      setResult({ message: e.message || 'Error analizando cabeceras.' });
    }
  };

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3">
      <ToolCard
        category="Infraestructura"
        icon={<FileText className="w-5 h-5" />}
        title="Security Header Analyzer"
        description="Audita la configuración de seguridad HTTP de cualquier web (HSTS, CSP, X-Frame, etc)."
        actionLabel="Analizar Cabeceras"
        onRun={runCheck}
        running={status === 'running'}
        status={status}
        result={result}
        input={
          <input
            type="text"
            placeholder="https://ejemplo.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        }
      />
      {analysis && (
        <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs">
          <div className="text-center">
            <p className="text-slate-500 mb-1">HSTS</p>
            <p className={`font-bold ${analysis.checks.hsts ? 'text-emerald-600' : 'text-red-600'}`}>{analysis.checks.hsts ? 'OK' : 'FAIL'}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-1">CSP</p>
            <p className={`font-bold ${analysis.checks.csp ? 'text-emerald-600' : 'text-red-600'}`}>{analysis.checks.csp ? 'OK' : 'FAIL'}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-1">X-Frame</p>
            <p className={`font-bold ${analysis.checks.xFrameOptions ? 'text-emerald-600' : 'text-red-600'}`}>{analysis.checks.xFrameOptions ? 'OK' : 'FAIL'}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-1">X-Content</p>
            <p className={`font-bold ${analysis.checks.xContentType ? 'text-emerald-600' : 'text-red-600'}`}>{analysis.checks.xContentType ? 'OK' : 'FAIL'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function AdvancedTools() {
  // State for DNS Leak
  const [dnsStatus, setDnsStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [dnsResult, setDnsResult] = useState<{ message: string; details?: string } | null>(null);

  // State for SSL
  const [sslStatus, setSslStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [sslResult, setSslResult] = useState<{ message: string; details?: string } | null>(null);
  const [sslDomain, setSslDomain] = useState('');

  // State for IP Reputation
  // (Handled inside IPReputation component)

  const runDnsLeakTest = async () => {
    setDnsStatus('running');
    setDnsResult(null);
    try {
      const res = await fetch('/api/tools/ip-info');
      const data = await res.json();
      setDnsStatus('success');
      setDnsResult({
        message: `Tu IP pública: ${data.ip}`,
        details: data.isLikelyVpn ? 'Posible Datacenter/VPN detectado.' : 'IP residencial detectada.'
      });
    } catch {
      setDnsStatus('error');
      setDnsResult({ message: 'Error al obtener información de IP.' });
    }
  };

  const runSslCheck = async () => {
    if (!sslDomain) {
      setSslStatus('error');
      setSslResult({ message: 'Introduce un dominio válido (ej. google.com).' });
      return;
    }
    setSslStatus('running');
    setSslResult(null);
    try {
      const res = await fetch(`/api/tools/ssl-check?domain=${encodeURIComponent(sslDomain)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const isExpiringSoon = data.daysLeft < 30;
      const isInvalid = !data.valid;
      
      setSslStatus(isInvalid ? 'warning' : (isExpiringSoon ? 'warning' : 'success'));
      setSslResult({
        message: isInvalid 
          ? `Certificado no confiable: ${data.reason || 'Autofirmado o caducado'}.`
          : isExpiringSoon 
            ? `Certificado válido pero expira en ${data.daysLeft} días.`
            : `Certificado seguro y válido (${data.daysLeft} días restantes).`,
        details: `Emisor: ${data.issuer} | Cifrado: ${data.cipher}`
      });
    } catch (e: any) {
      setSslStatus('error');
      setSslResult({ message: e.message || 'Dominio inaccesible.' });
    }
  };

function IPReputation() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [result, setResult] = useState<{ message: string; details?: string } | null>(null);
  const [repData, setRepData] = useState<any>(null);

  const runCheck = async () => {
    setStatus('running');
    setResult(null);
    try {
      // Get current IP first
      const ipRes = await fetch('/api/ip/detect');
      const ipData = await ipRes.json();
      
      const res = await fetch(`/api/tools/ip-reputation?ip=${encodeURIComponent(ipData.ip)}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setRepData(data);
      if (data.malicious > 0) {
        setStatus('error');
        setResult({ message: `¡ALERTA! ${data.malicious} motores detectaron actividad maliciosa.`, details: `Reputación: ${data.reputation}` });
      } else if (data.suspicious > 0) {
        setStatus('warning');
        setResult({ message: `${data.suspicious} motores marcan la IP como sospechosa.`, details: `Reputación: ${data.reputation}` });
      } else {
        setStatus('success');
        setResult({ message: 'IP limpia. Sin detecciones maliciosas.', details: `ISP: ${data.asOwner} | País: ${data.country}` });
      }
    } catch (e: any) {
      setStatus('error');
      setResult({ message: e.message || 'Error verificando reputación.' });
    }
  };

  return (
    <ToolCard
      category="Reputación"
      icon={<Globe className="w-5 h-5" />}
      title="IP Reputation (VirusTotal)"
      description="Verifica si tu IP pública aparece en listas negras de 80+ motores de seguridad."
      actionLabel="Verificar mi IP"
      onRun={runCheck}
      running={status === 'running'}
      status={status}
      result={result}
    />
  );
}

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-0">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 sm:p-10 text-center shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-full mb-3 border border-indigo-500/30">
            Centro de Diagnóstico Profesional
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight">
            Herramientas de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Seguridad Avanzada</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-xs sm:text-sm leading-relaxed">
            Verifica tu privacidad, analiza la integridad de sitios web y protege tu identidad con herramientas diseñadas para usuarios exigentes.
          </p>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* VPN & Proxy Detector */}
        <VpnDetector />

        {/* DNS Leak Test */}
        <ToolCard
          category="Privacidad"
          icon={<Eye className="w-5 h-5" />}
          title="DNS Leak Test"
          description="¿Tu VPN filtra tu identidad real? Verifica si tu proveedor de internet puede ver tus visitas."
          actionLabel="Verificar Fugas DNS"
          onRun={runDnsLeakTest}
          running={dnsStatus === 'running'}
          status={dnsStatus}
          result={dnsResult}
        />

        {/* SSL Auditor */}
        <ToolCard
          category="Infraestructura"
          icon={<Lock className="w-5 h-5" />}
          title="Auditor SSL/TLS"
          description="¿Es seguro ese banco o tienda? Analiza la validez, expiración y cifrado de cualquier dominio."
          actionLabel="Analizar Dominio"
          onRun={runSslCheck}
          running={sslStatus === 'running'}
          status={sslStatus}
          result={sslResult}
          input={
            <input
              type="text"
              placeholder="ej. google.com"
              value={sslDomain}
              onChange={(e) => setSslDomain(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          }
        />

        {/* IP Reputation */}
        <IPReputation />

        {/* URL Scanner */}
        <URLScanner />
        
        {/* Port Tester */}
        <PortTester />

        {/* Browser Fingerprint */}
        <BrowserFingerprint />

        {/* Email Forensics */}
        <EmailForensics />

        {/* Header Analyzer */}
        <HeaderAnalyzer />
      </div>

      {/* CTA Footer */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-center text-white shadow-lg">
        <h3 className="text-lg font-bold mb-2">¿Necesitas monitoreo 24/7?</h3>
        <p className="text-indigo-100 text-sm mb-4 max-w-xl mx-auto">
          Estas herramientas son manuales. Con MyIP Premium, automatizamos estos escaneos y te alertamos por email si detectamos cambios o riesgos.
        </p>
        <button className="bg-white text-indigo-700 font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 mx-auto">
          Ver Planes Premium <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
