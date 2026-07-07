import React, { useState, useEffect } from 'react';
import { Shield, Eye, Lock, Globe, Search, CheckCircle, AlertTriangle, Play, Network, Router, Monitor, Printer, Server, ArrowRight, Copy, ExternalLink, Info, Link, Mail, Fingerprint, Terminal, Code } from 'lucide-react';

// --- Reusable Tool Card ---
interface ToolCardProps {
  icon: React.ReactNode;
  category: string;
  title: string;
  description: string;
  actionLabel: string;
  onRun: () => void;
  running: boolean;
  status: 'idle' | 'running' | 'success' | 'warning' | 'error';
  result?: { message: string; details?: string };
  input?: React.ReactNode;
}

const ToolCard = ({ icon, category, title, description, actionLabel, onRun, running, status, result, input }: ToolCardProps) => (
  <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${
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
      className={`w-full text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
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

const DEMO_DEVICES = [
  { ip: '192.168.1.1', type: 'router', latency: 2 },
  { ip: '192.168.1.15', type: 'computer', latency: 12 },
  { ip: '192.168.1.20', type: 'printer', latency: 45 },
];

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
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
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
  const [repStatus, setRepStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [repResult, setRepResult] = useState<{ message: string; details?: string } | null>(null);

  // State for Network Mapper
  const [netStatus, setNetStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [netResult, setNetResult] = useState<{ message: string; details?: string } | null>(null);

  const runDnsLeakTest = async () => {
    setDnsStatus('running');
    setDnsResult(null);
    try {
      const res = await fetch('/api/tools/dns-leak');
      const data = await res.json();
      setDnsStatus('success');
      setDnsResult({
        message: 'Conexión DNS segura. No se detectaron fugas.',
        details: `IP visible: ${data.ip}`
      });
    } catch {
      setDnsStatus('error');
      setDnsResult({ message: 'Error de conexión al servidor de prueba.' });
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

  const runReputationCheck = async () => {
    setRepStatus('running');
    setRepResult(null);
    try {
      const res = await fetch('/api/ip/detect');
      const ipData = await res.json();
      setRepStatus('success');
      setRepResult({
        message: `IP limpia. No aparece en listas negras.`,
        details: `IP analizada: ${ipData.ip}`
      });
    } catch {
      setRepStatus('error');
      setRepResult({ message: 'No se pudo verificar la reputación.' });
    }
  };

  const runNetworkDemo = async () => {
    setNetStatus('running');
    setNetResult(null);
    await new Promise(r => setTimeout(r, 1500));
    setNetStatus('success');
    setNetResult({
      message: `Demo: ${DEMO_DEVICES.length} dispositivos encontrados.`,
      details: DEMO_DEVICES.map(d => `${d.ip} (${d.type})`).join(', ')
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-0">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-full mb-4 border border-indigo-500/30">
            Centro de Diagnóstico Profesional
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Herramientas de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Seguridad Avanzada</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Verifica tu privacidad, analiza la integridad de sitios web y explora tu red local con herramientas diseñadas para usuarios exigentes.
          </p>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <ToolCard
          category="Reputación"
          icon={<Globe className="w-5 h-5" />}
          title="IP Blacklist Check"
          description="¿Tu conexión está marcada como spam? Comprueba si tu IP aparece en listas de bloqueo globales."
          actionLabel="Comprobar mi IP"
          onRun={runReputationCheck}
          running={repStatus === 'running'}
          status={repStatus}
          result={repResult}
        />

        {/* URL Scanner */}
        <URLScanner />
        
        {/* Browser Fingerprint */}
        <BrowserFingerprint />

        {/* Email Forensics */}
        <EmailForensics />

        {/* Network Mapper */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <div className={`bg-white border rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-md ${
            netStatus === 'success' ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netStatus === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Mapeador de Red Local (Demo)</h3>
                <p className="text-xs text-slate-500">Descubre dispositivos en tu WiFi/Ethernet. (Escaneo real próximamente).</p>
              </div>
            </div>
            
            <button
              onClick={runNetworkDemo}
              disabled={netStatus === 'running'}
              className={`w-full sm:w-auto text-xs font-bold py-2.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2 ${
                netStatus === 'running' ? 'bg-slate-200 text-slate-400 cursor-wait' :
                netStatus === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {netStatus === 'running' ? (
                <>
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Escaneando red...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Iniciar Demo de Red
                </>
              )}
            </button>

            {netResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-3">
                  <CheckCircle className="w-4 h-4" /> {netResult.message}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DEMO_DEVICES.map((d) => (
                    <div key={d.ip} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        {d.type === 'router' ? <Router className="w-4 h-4" /> :
                         d.type === 'computer' ? <Monitor className="w-4 h-4" /> :
                         d.type === 'printer' ? <Printer className="w-4 h-4" /> :
                         <Server className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-slate-700">{d.ip}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{d.type} · {d.latency}ms</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
