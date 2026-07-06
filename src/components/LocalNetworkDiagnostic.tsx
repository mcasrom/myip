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
  Monitor,
  Globe,
  Activity,
  Zap,
  MapPin
} from 'lucide-react';
import { motion } from 'motion/react';

interface NetworkAuditResult {
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  measuredLatency: number;
  measuredJitter: number;
  measuredSpeed: number;
  dnsLatency: number;
  score: number;
  rating: string;
  context: string;
  contextIcon: string;
  issues: string[];
  raw: any;
}

// Medición de latencia real via nuestro servidor
async function measureLatency(samples = 10): Promise<{ avg: number; jitter: number }> {
  const url = '/api/speedtest/ping';
  const times: number[] = [];
  
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      await fetch(url, { cache: 'no-store' });
      const elapsed = performance.now() - start;
      times.push(elapsed);
    } catch {
      // Ignorar fallos individuales
    }
  }
  
  if (times.length < 3) return { avg: 0, jitter: 0 };
  
  const stable = times.slice(1);
  const avg = stable.reduce((a, b) => a + b, 0) / stable.length;
  
  let jitterSum = 0;
  for (let i = 1; i < stable.length; i++) {
    jitterSum += Math.abs(stable[i] - stable[i - 1]);
  }
  const jitter = jitterSum / (stable.length - 1);
  
  return { avg: Math.round(avg), jitter: Math.round(jitter) };
}

// Velocidad de descarga via nuestro servidor (10MB)
async function measureSpeed(): Promise<number> {
  const url = '/api/speedtest/download';
  const start = performance.now();
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const blob = await response.blob();
    const elapsed = (performance.now() - start) / 1000;
    const bytes = blob.size;
    const mbps = (bytes * 8) / (elapsed * 1_000_000);
    return Math.round(mbps * 10) / 10;
  } catch {
    return 0;
  }
}

// Latencia via nuestro servidor
async function measureDNSLatency(): Promise<number> {
  const url = '/api/speedtest/dns';
  const start = performance.now();
  try {
    await fetch(url, { cache: 'no-store' });
    return Math.round(performance.now() - start);
  } catch {
    return 0;
  }
}

// Clasificar contexto de red basado en métricas
function classifyContext(
  latency: number,
  jitter: number,
  speed: number,
  connType: string,
  effectiveType: string
): { context: string; icon: string } {
  // Red móvil
  if (connType === 'cellular' || effectiveType === '3g') {
    return { context: 'Red Móvil (3G/4G/5G)', icon: '📱' };
  }
  
  // Alta calidad: baja latencia, jitter bajo, alta velocidad
  if (latency < 30 && jitter < 10 && speed > 50) {
    return { context: 'Red Doméstica / Fibra Óptica', icon: '🏠' };
  }
  
  // Calidad media: podría ser WiFi doméstico o cable
  if (latency < 50 && jitter < 20) {
    return { context: 'Red Fija (Cable/ADSL)', icon: '🖥️' };
  }
  
  // Alta latencia + jitter alto = red pública congestionada
  if (jitter > 30 || latency > 100) {
    if (latency > 150) {
      return { context: 'Red Pública Congestionada (Aeropuerto/Café)', icon: '✈️' };
    }
    return { context: 'Red Compartida (Hotel/Biblioteca)', icon: '🏢' };
  }
  
  // Default
  if (speed > 20) {
    return { context: 'Red de Alta Velocidad', icon: '⚡' };
  }
  
  return { context: 'Red Estándar', icon: '🌐' };
}

export default function LocalNetworkDiagnostic({ 
  onToast 
}: { 
  onToast: (msg: string, type: 'success' | 'warning' | 'info') => void 
}) {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [result, setResult] = useState<NetworkAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    
    try {
      // Step 1: Detectar tipo de conexión
      setCurrentStep(1);
      setStepMessage('Detectando tipo de conexión...');
      
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const connectionType = conn?.type || 'unknown';
      const effectiveType = conn?.effectiveType || 'unknown';
      const downlink = conn?.downlink || 0;
      const apiRtt = conn?.rtt || 0;
      const saveData = conn?.saveData || false;
      
      // Step 2: Medir latencia real
      setCurrentStep(2);
      setStepMessage('Midiendo latencia de red...');
      const { avg: measuredLatency, jitter: measuredJitter } = await measureLatency(10);
      
      // Step 3: Medir velocidad
      setCurrentStep(3);
      setStepMessage('Midiendo velocidad de descarga...');
      const measuredSpeed = await measureSpeed();
      
      // Step 4: Medir DNS
      setCurrentStep(4);
      setStepMessage('Midiendo resolución DNS...');
      const dnsLatency = await measureDNSLatency();
      
      // Clasificar contexto
      const { context, icon: contextIcon } = classifyContext(
        measuredLatency, measuredJitter, measuredSpeed, connectionType, effectiveType
      );
      
      // Scoring
      let score = 100;
      const issues: string[] = [];
      
      // Latencia
      if (measuredLatency > 200) {
        score -= 30;
        issues.push(`Latencia muy alta (${measuredLatency}ms). Posible congestión o distancia al servidor.`);
      } else if (measuredLatency > 100) {
        score -= 15;
        issues.push(`Latencia elevada (${measuredLatency}ms). Puede afectar videollamadas y juegos.`);
      } else if (measuredLatency > 50) {
        score -= 5;
        issues.push(`Latencia moderada (${measuredLatency}ms). Aceptable para la mayoría de usos.`);
      }
      
      // Jitter (estabilidad)
      if (measuredJitter > 50) {
        score -= 25;
        issues.push(`Jitter muy alto (${measuredJitter}ms). Red inestable, típica de redes públicas congestionadas.`);
      } else if (measuredJitter > 20) {
        score -= 15;
        issues.push(`Jitter elevado (${measuredJitter}ms). Posible variabilidad en videollamadas.`);
      }
      
      // Velocidad
      if (measuredSpeed > 0 && measuredSpeed < 5) {
        score -= 20;
        issues.push(`Velocidad muy baja (${measuredSpeed} Mbps).`);
      } else if (measuredSpeed > 0 && measuredSpeed < 20) {
        score -= 10;
        issues.push(`Velocidad limitada (${measuredSpeed} Mbps).`);
      }
      
      // DNS
      if (dnsLatency > 100) {
        score -= 15;
        issues.push(`DNS lento (${dnsLatency}ms). Considera Cloudflare (1.1.1.1) o Google (8.8.8.8).`);
      }
      
      // Save Data
      if (saveData) {
        score -= 5;
        issues.push('Modo ahorro de datos activado. Tu navegador está limitando el consumo.');
      }
      
      score = Math.max(5, score);
      
      let rating = 'Excelente';
      if (score >= 90) rating = 'Excelente';
      else if (score >= 75) rating = 'Bueno';
      else if (score >= 50) rating = 'Regular';
      else rating = 'Crítico';
      
      if (issues.length === 0) {
        issues.push('Tu conexión es estable y rápida. Ideal para trabajo remoto, streaming y videollamadas.');
      }
      
      setResult({
        connectionType,
        effectiveType,
        downlink,
        rtt: apiRtt,
        saveData,
        measuredLatency,
        measuredJitter,
        measuredSpeed,
        dnsLatency,
        score,
        rating,
        context,
        contextIcon,
        issues,
        raw: { conn }
      });
      
      setRunning(false);
      setCurrentStep(0);
      onToast('¡Auditoría de red completada con datos reales!', 'success');
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
      setRunning(false);
      setCurrentStep(0);
      onToast('Error en la auditoría de red', 'warning');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-slate-900 border border-slate-700 p-4 sm:p-5 rounded-2xl flex items-start gap-3 text-white">
        <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-indigo-300">Auditoría de Calidad de Enlace</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Este diagnóstico mide latencia real, jitter (estabilidad), velocidad de descarga y resolución DNS directamente desde tu navegador. Sin suposiciones, sin acceso a tu router.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 sm:p-8 rounded-3xl shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Diagnóstico de Red en Tiempo Real</span>
            <h2 className="text-lg sm:text-2xl font-bold font-sans">Auditoría de Calidad de Enlace</h2>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          Detecta si estás en una red doméstica, móvil, pública o congestionada. Mide latencia, jitter, velocidad y DNS para evaluar la calidad real de tu conexión.
        </p>

        <div className="pt-2">
          <button
            onClick={runDiagnostic}
            disabled={running}
            className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Auditando...' : 'Ejecutar Auditoría de Red'}
          </button>
        </div>
      </div>

      {running && (
        <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col items-center justify-center space-y-4 sm:space-y-6 text-center text-slate-800">
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Radio className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-slate-800 text-base sm:text-lg">Auditando tu conexión...</p>
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-indigo-600 font-semibold font-mono bg-indigo-50 px-3 sm:px-4 py-1.5 rounded-full border border-indigo-100">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              Paso {currentStep} de 4: {stepMessage}
            </div>
          </div>
          <div className="max-w-sm sm:max-w-md w-full grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${currentStep >= s ? 'bg-indigo-600' : 'bg-slate-100'}`} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 sm:p-6 rounded-2xl text-center">
          <ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {result && !running && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8">
          {/* Context Card */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-5 sm:p-8 rounded-3xl shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="text-3xl sm:text-4xl">{result.contextIcon}</span>
              <div>
                <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Contexto Detectado</span>
                <h3 className="text-lg sm:text-xl font-bold">{result.context}</h3>
              </div>
            </div>
          </div>

          {/* Score + Metrics */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-8 shadow-sm text-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-2 border-b md:border-b-0 md:border-r border-slate-100 pb-4 sm:pb-6 md:pb-0 md:pr-8">
                <span className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold">Valoración de Red</span>
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
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
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-slate-800 font-mono">{result.score}</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">de 100 pts</span>
                  </div>
                </div>
                <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider px-2 sm:px-3 py-1 rounded-full ${
                  result.rating === 'Excelente' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                  result.rating === 'Bueno' ? 'bg-indigo-50 text-indigo-800 border border-indigo-100' :
                  result.rating === 'Regular' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                  'bg-red-50 text-red-800 border border-red-100'
                }`}>
                  {result.rating}
                </span>
              </div>

              <div className="md:col-span-8 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider font-mono">Métricas Reales de tu Conexión</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                      <span className="text-[8px] sm:text-[9px] uppercase font-mono text-slate-400 font-bold">Tipo de Conexión</span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-slate-800 font-mono capitalize">{result.connectionType}</p>
                    {result.effectiveType !== 'unknown' && (
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Efectiva: {result.effectiveType.toUpperCase()}</p>
                    )}
                  </div>
                  <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                      <span className="text-[8px] sm:text-[9px] uppercase font-mono text-slate-400 font-bold">Latencia (RTT)</span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-slate-800 font-mono">{result.measuredLatency} ms</p>
                    {result.rtt > 0 && (
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">API: {result.rtt} ms</p>
                    )}
                  </div>
                  <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
                      <span className="text-[8px] sm:text-[9px] uppercase font-mono text-slate-400 font-bold">Jitter (Estabilidad)</span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-slate-800 font-mono">{result.measuredJitter} ms</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{result.measuredJitter < 10 ? 'Muy estable' : result.measuredJitter < 30 ? 'Estable' : 'Inestable'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500" />
                      <span className="text-[8px] sm:text-[9px] uppercase font-mono text-slate-400 font-bold">Velocidad Descarga</span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-slate-800 font-mono">{result.measuredSpeed > 0 ? `${result.measuredSpeed} Mbps` : 'N/A'}</p>
                    {result.downlink > 0 && (
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">API: ~{result.downlink} Mbps</p>
                    )}
                  </div>
                  <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                      <span className="text-[8px] sm:text-[9px] uppercase font-mono text-slate-400 font-bold">Resolución DNS</span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-slate-800 font-mono">{result.dnsLatency > 0 ? `${result.dnsLatency} ms` : 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                      <span className="text-[8px] sm:text-[9px] uppercase font-mono text-slate-400 font-bold">Ahorro de Datos</span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-slate-800 font-mono">{result.saveData ? 'Activado' : 'Desactivado'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Findings */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-8 shadow-sm text-slate-800 space-y-4 sm:space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-indigo-600" />
              Hallazgos
            </h3>
            {result.issues.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-100 p-4 sm:p-5 rounded-2xl flex items-start gap-3">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900">Conexión óptima</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Tu conexión es estable y rápida. Ideal para trabajo remoto, streaming y videollamadas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {result.issues.map((issue, idx) => {
                  const isWarning = issue.includes('⚠️') || issue.includes('muy') || issue.includes('inestable');
                  return (
                    <div key={idx} className={`${isWarning ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'} p-3 sm:p-4 rounded-xl flex items-start gap-2 sm:gap-3 border`}>
                      {isWarning ? (
                        <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
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
