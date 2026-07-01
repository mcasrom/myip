import React, { useState } from 'react';
import { 
  Wifi, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Radio, 
  Gauge, 
  ShieldCheck,
  Router,
  Lock,
  Download,
  Clock,
  Monitor
} from 'lucide-react';
import { motion } from 'motion/react';

interface WifiAuditResult {
  ssid: string;
  encryption: string;
  local_ip: string;
  gateway: string;
  latency_ms: number;
  dns_latency_ms: number;
  speed_mbps: number;
  score: number;
  rating: string;
  issues: string[];
  raw: any;
}

export default function LocalNetworkDiagnostic({ 
  onToast 
}: { 
  onToast: (msg: string, type: 'success' | 'warning' | 'info') => void 
}) {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [result, setResult] = useState<WifiAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    
    setCurrentStep(1);
    setStepMessage('Detectando red WiFi y cifrado...');
    
    try {
      const res = await fetch('/api/wifi/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      setCurrentStep(2);
      setStepMessage('Midiendo latencia y velocidad...');

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error en el diagnóstico WiFi');
      }

      setCurrentStep(3);
      setStepMessage('Evaluando seguridad de la red...');
      await new Promise(r => setTimeout(r, 500));

      // Scoring
      let score = 100;
      const issues: string[] = [];

      // Encryption scoring
      const enc = (data.encryption || '').toLowerCase();
      if (enc === 'none' || enc === 'open' || enc === 'desconocido') {
        score -= 40;
        issues.push('⚠️ Tu WiFi NO tiene cifrado. Cualquiera puede interceptar tu tráfico.');
      } else if (enc.includes('wep')) {
        score -= 30;
        issues.push('⚠️ WEP es obsoleto e inseguro. Puede ser crackeado en minutos.');
      } else if (enc.includes('wpa') && !enc.includes('wpa3')) {
        score -= 5;
        issues.push('WPA2 es aceptable, pero WPA3 sería más seguro.');
      }

      // Latency scoring
      const lat = data.latency_ms || 0;
      if (lat > 100) {
        score -= 20;
        issues.push(`Latencia muy alta al gateway (${lat}ms). Posible congestión o señal débil.`);
      } else if (lat > 50) {
        score -= 10;
        issues.push(`Latencia elevada al gateway (${lat}ms).`);
      }

      // DNS scoring
      const dns = data.dns_latency_ms || 0;
      if (dns > 50) {
        score -= 15;
        issues.push(`DNS lento (${dns}ms). Considera usar Cloudflare (1.1.1.1) o Google (8.8.8.8).`);
      }

      // Speed scoring
      const speed = data.speed_mbps || 0;
      if (speed > 0 && speed < 5) {
        score -= 20;
        issues.push(`Velocidad muy baja (${speed} Mbps).`);
      } else if (speed > 0 && speed < 20) {
        score -= 10;
        issues.push(`Velocidad limitada (${speed} Mbps).`);
      }

      score = Math.max(5, score);

      let rating = 'Excelente';
      if (score >= 90) rating = 'Excelente';
      else if (score >= 75) rating = 'Bueno';
      else if (score >= 50) rating = 'Regular';
      else rating = 'Crítico';

      if (issues.length === 0) {
        issues.push('Tu red WiFi está bien configurada. Cifrado adecuado y latencia baja.');
      }

      setResult({
        ssid: data.ssid || 'No detectado',
        encryption: data.encryption || 'Desconocido',
        local_ip: data.local_ip || 'No detectado',
        gateway: data.gateway || 'No detectado',
        latency_ms: lat,
        dns_latency_ms: dns,
        speed_mbps: speed,
        score,
        rating,
        issues,
        raw: data
      });

      setRunning(false);
      setCurrentStep(0);
      onToast('¡Diagnóstico WiFi completado con datos reales!', 'success');
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
      setRunning(false);
      setCurrentStep(0);
      onToast('Error en el diagnóstico WiFi', 'warning');
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex items-start gap-3.5 text-white">
        <ShieldCheck className="w-5.5 h-5.5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-indigo-300">Datos reales del sistema</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Este diagnóstico ejecuta comandos reales en tu sistema (<code className="bg-slate-800 px-1 rounded">nmcli</code>, <code className="bg-slate-800 px-1 rounded">ping</code>) para detectar cifrado WiFi, gateway, latencia y velocidad. Sin suposiciones.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
            <Wifi className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Diagnóstico de Red Local</span>
            <h2 className="text-xl sm:text-2xl font-bold font-sans">Auditoría WiFi Real</h2>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
          Detecta cifrado (WPA2/WPA3/Abierta), gateway, latencia al router, velocidad DNS y evalúa la seguridad de tu red WiFi.
        </p>

        <div className="pt-2">
          <button
            onClick={runDiagnostic}
            disabled={running}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Auditando...' : 'Ejecutar Auditoría WiFi'}
          </button>
        </div>
      </div>

      {running && (
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col items-center justify-center space-y-6 text-center text-slate-800">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Radio className="w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-slate-800 text-lg">Auditando WiFi...</p>
            <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 font-semibold font-mono bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              Paso {currentStep} de 3: {stepMessage}
            </div>
          </div>
          <div className="max-w-md w-full grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${currentStep >= s ? 'bg-indigo-600' : 'bg-slate-100'}`} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center">
          <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
          <p className="text-xs text-red-600 mt-1">Asegúrate de estar conectado a WiFi y que nmcli esté disponible.</p>
        </div>
      )}

      {result && !running && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-2 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-8">
                <span className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold">Valoración de Red</span>
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="72" cy="72" r="64" strokeWidth="8" stroke="#f1f5f9" fill="transparent" />
                    <circle 
                      cx="72" cy="72" r="64" strokeWidth="8" 
                      stroke={result.score >= 90 ? '#10b981' : result.score >= 75 ? '#6366f1' : result.score >= 50 ? '#f59e0b' : '#ef4444'} 
                      fill="transparent" strokeDasharray="402"
                      strokeDashoffset={402 - (402 * result.score) / 100}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-extrabold tracking-tighter text-slate-800 font-mono">{result.score}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">de 100 pts</span>
                  </div>
                </div>
                <span className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                  result.rating === 'Excelente' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                  result.rating === 'Bueno' ? 'bg-indigo-50 text-indigo-800 border border-indigo-100' :
                  result.rating === 'Regular' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                  'bg-red-50 text-red-800 border border-red-100'
                }`}>
                  {result.rating}
                </span>
              </div>

              <div className="md:col-span-8 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider font-mono">Datos Reales de tu WiFi</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Wifi className="w-4 h-4 text-indigo-500" />
                      <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Red (SSID)</span>
                    </div>
                    <p className="text-base font-bold text-slate-800 font-mono">{result.ssid}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="w-4 h-4 text-emerald-500" />
                      <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Cifrado</span>
                    </div>
                    <p className="text-base font-bold text-slate-800 font-mono">{result.encryption}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Monitor className="w-4 h-4 text-blue-500" />
                      <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">IP Local</span>
                    </div>
                    <p className="text-base font-bold text-slate-800 font-mono">{result.local_ip}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Router className="w-4 h-4 text-purple-500" />
                      <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Gateway</span>
                    </div>
                    <p className="text-base font-bold text-slate-800 font-mono">{result.gateway}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Latencia</span>
                    </div>
                    <p className="text-base font-bold text-slate-800 font-mono">{result.latency_ms} ms</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Download className="w-4 h-4 text-cyan-500" />
                      <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Velocidad</span>
                    </div>
                    <p className="text-base font-bold text-slate-800 font-mono">{result.speed_mbps} Mbps</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-slate-800 space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-indigo-600" />
              Hallazgos
            </h3>
            {result.issues.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-start gap-3.5">
                <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900">Red WiFi segura</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Cifrado adecuado y latencia baja. Tu red está bien configurada.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {result.issues.map((issue, idx) => {
                  const isWarning = issue.includes('⚠️');
                  return (
                    <div key={idx} className={`${isWarning ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'} p-4 rounded-xl flex items-start gap-3 border`}>
                      {isWarning ? (
                        <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                      <p className={`text-xs ${isWarning ? 'text-red-800' : 'text-amber-800'} leading-relaxed font-medium`}>{issue}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
