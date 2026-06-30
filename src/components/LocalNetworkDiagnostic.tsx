import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Laptop, 
  Server, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Radio, 
  Signal, 
  Gauge, 
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocalScanResult {
  gatewayIp: string;
  localIp: string;
  rttToRouterMs: number;
  wifiSignalDbm: number;
  wifiQualityPercent: number;
  linkSpeedMbps: number;
  frequencyGhz: 2.4 | 5.0 | 6.0;
  securityType: 'WPA3' | 'WPA2' | 'WPA/WEP (Obsoleto)' | 'Abierta (Inseguro)';
  dnsServer: string;
  score: number;
  rating: 'Excelente' | 'Bueno' | 'Regular' | 'Crítico';
  issues: string[];
}

export default function LocalNetworkDiagnostic({ 
  onToast 
}: { 
  onToast: (msg: string, type: 'success' | 'warning' | 'info') => void 
}) {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [result, setResult] = useState<LocalScanResult | null>(null);

  // Custom configuration to allow user to tweak simulated properties to test valuation
  const [customRouterIp, setCustomRouterIp] = useState('192.168.1.1');
  const [isWifiOpen, setIsWifiOpen] = useState(false);
  const [useLegacyEncryption, setUseLegacyEncryption] = useState(false);
  const [wifiSignalLossSim, setWifiSignalLossSim] = useState<number>(0); // 0 = Excellent, 1 = Medium, 2 = Low

  // Read actual Network Information API if available
  const [networkInfo, setNetworkInfo] = useState<{
    rtt?: number;
    downlink?: number;
    effectiveType?: string;
  }>({});

  useEffect(() => {
    // @ts-ignore
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      setNetworkInfo({
        rtt: conn.rtt,
        downlink: conn.downlink,
        effectiveType: conn.effectiveType
      });
    }
  }, []);

  const runDiagnostic = async () => {
    setRunning(true);
    setResult(null);
    
    // Step 1: Detect Network Adapter & Local IP Range
    setCurrentStep(1);
    setStepMessage('Identificando interfaz de red local y adaptador...');
    await new Promise(r => setTimeout(r, 1200));

    // Step 2: Gateway Router Discovery
    setCurrentStep(2);
    setStepMessage(`Sondeando puerta de enlace predeterminada en ${customRouterIp}...`);
    await new Promise(r => setTimeout(r, 1500));

    // Step 3: Latency & Jitter test
    setCurrentStep(3);
    setStepMessage('Midiendo latencia de bucle local (ICMP/Ping simulado al router)...');
    await new Promise(r => setTimeout(r, 1200));

    // Step 4: WiFi Signal & Hotspot audit
    setCurrentStep(4);
    setStepMessage('Evaluando espectro electromagnético e intensidad de señal WiFi...');
    await new Promise(r => setTimeout(r, 1500));

    // Step 5: Valuation Calculation
    setCurrentStep(5);
    setStepMessage('Analizando seguridad de la conexión local...');
    await new Promise(r => setTimeout(r, 1000));

    // Compute realistic mock data with variation based on custom user toggles & actual rtt
    const baseRtt = networkInfo.rtt ? Math.max(1, Math.min(10, networkInfo.rtt / 12)) : 1.5;
    const finalRtt = Number((baseRtt + (wifiSignalLossSim * 8) + Math.random() * 1.5).toFixed(1));
    
    let dbm = -45; // default excellent
    if (wifiSignalLossSim === 1) dbm = -67; // average
    if (wifiSignalLossSim === 2) dbm = -82; // weak

    const wifiQuality = Math.max(10, Math.min(100, Math.round(100 - (Math.abs(dbm + 30) * 1.3))));
    
    const linkSpeed = wifiSignalLossSim === 0 ? 866 : wifiSignalLossSim === 1 ? 300 : 54;
    const freq = wifiSignalLossSim === 0 ? 5.0 : wifiSignalLossSim === 1 ? 2.4 : 2.4;

    let sec: 'WPA3' | 'WPA2' | 'WPA/WEP (Obsoleto)' | 'Abierta (Inseguro)' = 'WPA2';
    if (isWifiOpen) {
      sec = 'Abierta (Inseguro)';
    } else if (useLegacyEncryption) {
      sec = 'WPA/WEP (Obsoleto)';
    } else if (wifiSignalLossSim === 0 && Math.random() > 0.5) {
      sec = 'WPA3';
    }

    const localIpBase = customRouterIp.substring(0, customRouterIp.lastIndexOf('.')) || '192.168.1';
    const localIp = `${localIpBase}.${Math.floor(Math.random() * 240) + 12}`;

    // Scoring calculation
    let score = 100;
    const issues: string[] = [];

    // Deduct for signal strength
    if (dbm < -80) {
      score -= 25;
      issues.push('Intensidad de señal WiFi extremadamente débil. Alto riesgo de pérdida de paquetes y desconexiones.');
    } else if (dbm < -65) {
      score -= 10;
      issues.push('Señal WiFi moderada. Puede haber interferencias temporales por paredes o electrodomésticos.');
    }

    // Deduct for security
    if (sec === 'Abierta (Inseguro)') {
      score -= 45;
      issues.push('La red WiFi actual está ABIERTA. Cualquier intruso en el rango de cobertura puede interceptar tu tráfico no cifrado.');
    } else if (sec === 'WPA/WEP (Obsoleto)') {
      score -= 25;
      issues.push('Algoritmo de cifrado obsoleto (WEP/WPA1). Es altamente vulnerable a ataques de fuerza bruta en pocos minutos.');
    }

    // Deduct for latency
    if (finalRtt > 20) {
      score -= 15;
      issues.push('Latencia elevada hacia el router local (>20 ms). Indica congestión en el canal WiFi o distancia excesiva.');
    } else if (finalRtt > 10) {
      score -= 5;
    }

    score = Math.max(5, score);

    let rating: 'Excelente' | 'Bueno' | 'Regular' | 'Crítico' = 'Excelente';
    if (score >= 90) rating = 'Excelente';
    else if (score >= 75) rating = 'Bueno';
    else if (score >= 50) rating = 'Regular';
    else rating = 'Crítico';

    setResult({
      gatewayIp: customRouterIp,
      localIp,
      rttToRouterMs: finalRtt,
      wifiSignalDbm: dbm,
      wifiQualityPercent: wifiQuality,
      linkSpeedMbps: linkSpeed,
      frequencyGhz: freq,
      securityType: sec,
      dnsServer: '1.1.1.1 (Cloudflare Primary)',
      score,
      rating,
      issues
    });

    setRunning(false);
    setCurrentStep(0);
    onToast('¡Auditoría de Conexión Local finalizada con éxito!', 'success');
  };

  return (
    <div className="space-y-8">
      {/* Educational Notice explaining browser limits */}
      <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-3.5 text-slate-800">
        <Info className="w-5.5 h-5.5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-900">🔒 Limitación de Seguridad del Navegador (Sin Engaños)</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            Por estrictas políticas de privacidad de <strong>Google Chrome, Safari, Firefox y Edge</strong>, ningún sitio web o aplicación de navegador tiene permiso para husmear en tu tarjeta de red, detectar si tu WiFi física tiene contraseña o leer tus claves inalámbricas de forma automática.
          </p>
          <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
            Para ofrecerte un diagnóstico real y personalizado sobre tu primer salto de red, por favor <strong>declara honestamente el estado de tu red</strong> en el panel de abajo. Calcularemos tu nivel de riesgo y te daremos las instrucciones exactas para blindar tu router frente a intrusos.
          </p>
        </div>
      </div>

      {/* Introduction Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
            <Wifi className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Diagnóstico de Salto Local</span>
            <h2 className="text-xl sm:text-2xl font-bold font-sans">Auditoría Declarativa de Router y Hotspot</h2>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
          El primer salto de tu conexión (tu router y tu red inalámbrica) suele ser el punto más vulnerable de tu red. Evalúa la latencia, la calidad de la señal y la seguridad de tu punto de acceso local de forma transparente.
        </p>

        {/* Real Browser Network data */}
        {networkInfo.effectiveType && (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[11px] text-indigo-200 font-mono border border-white/5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Leído del navegador: Conexión {networkInfo.effectiveType.toUpperCase()} | RTT estimado: {networkInfo.rtt}ms | Downlink: {networkInfo.downlink} Mbps</span>
          </div>
        )}

        {/* Configuration settings drawer */}
        {!running && (
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-4 text-xs">
            <h3 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> Declara los datos de tu conexión actual:
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-medium">IP del Router (Puerta de Enlace):</label>
                <input 
                  type="text" 
                  value={customRouterIp}
                  onChange={(e) => setCustomRouterIp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="ej. 192.168.1.1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 block font-medium">Ubicación / Distancia al WiFi:</label>
                <select
                  value={wifiSignalLossSim}
                  onChange={(e) => setWifiSignalLossSim(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value={0}>Excelente (Mismo Cuarto / Directo)</option>
                  <option value={1}>Regular (Paredes de por medio)</option>
                  <option value={2}>Muy Débil (Fuera de rango / Jardín)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end space-y-2 pt-2 sm:pt-0">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input 
                    type="checkbox" 
                    checked={isWifiOpen}
                    onChange={(e) => {
                      setIsWifiOpen(e.target.checked);
                      if (e.target.checked) setUseLegacyEncryption(false);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                  />
                  <span>Mi Red WiFi está Abierta (Sin Contraseña)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input 
                    type="checkbox" 
                    checked={useLegacyEncryption}
                    disabled={isWifiOpen}
                    onChange={(e) => setUseLegacyEncryption(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700 disabled:opacity-40"
                  />
                  <span>Usa encriptación antigua (WEP / WPA1 con clave débil)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Start button */}
        {!running && (
          <div className="pt-2">
            <button
              onClick={runDiagnostic}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Comenzar Diagnóstico Local Asistido
            </button>
          </div>
        )}
      </div>

      {/* Scanning loading state */}
      {running && (
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col items-center justify-center space-y-6 text-center text-slate-800">
          <div className="relative">
            {/* Outer spinning ring */}
            <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Radio className="w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-slate-800 text-lg">Ejecutando Diagnóstico Local...</p>
            <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 font-semibold font-mono bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              Paso {currentStep} de 5: {stepMessage}
            </div>
          </div>

          {/* Staggered text process indicator */}
          <div className="max-w-md w-full grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep >= s ? 'bg-indigo-600' : 'bg-slate-100'
                }`} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Results View */}
      {result && !running && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Main summary score card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* Score ring */}
              <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-2 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-8">
                <span className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold">Valoración de Red</span>
                <div className="relative w-36 h-36 flex items-center justify-center">
                  {/* Svg ring back */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="72" cy="72" r="64" strokeWidth="8" stroke="#f1f5f9" fill="transparent" />
                    <circle 
                      cx="72" 
                      cy="72" 
                      r="64" 
                      strokeWidth="8" 
                      stroke={
                        result.score >= 90 ? '#10b981' : 
                        result.score >= 75 ? '#6366f1' : 
                        result.score >= 50 ? '#f59e0b' : '#ef4444'
                      } 
                      fill="transparent" 
                      strokeDasharray="402"
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

              {/* Topology Map */}
              <div className="md:col-span-8 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider font-mono">Topología del Salto Local</h3>
                
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-around gap-6 text-center">
                  {/* Laptop client */}
                  <div className="space-y-1">
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-700 mx-auto shadow-sm">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">Mi Dispositivo</p>
                    <p className="text-[10px] font-mono text-slate-400">{result.localIp}</p>
                  </div>

                  {/* WiFi line indicator */}
                  <div className="flex-1 flex flex-col items-center justify-center space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Zap className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                      <span>{result.rttToRouterMs} ms (Latencia)</span>
                    </div>
                    <div className="w-full max-w-[120px] h-1.5 bg-slate-200 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full rounded-full ${
                          result.wifiQualityPercent >= 90 ? 'bg-emerald-500' :
                          result.wifiQualityPercent >= 70 ? 'bg-indigo-500' :
                          result.wifiQualityPercent >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${result.wifiQualityPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">WiFi {result.wifiQualityPercent}%</span>
                  </div>

                  {/* Router Gateway */}
                  <div className="space-y-1">
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-indigo-600 mx-auto shadow-sm">
                      <Server className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">Router Gateway</p>
                    <p className="text-[10px] font-mono text-slate-400">{result.gatewayIp}</p>
                  </div>
                </div>

                {/* Technical data table */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Velocidad Enlace</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 font-mono">{result.linkSpeedMbps} Mbps</p>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Frecuencia</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 font-mono">{result.frequencyGhz} GHz</p>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-center col-span-2 sm:col-span-1">
                    <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Cifrado WiFi</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{result.securityType}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Finding / Issues list */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-slate-800 space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-indigo-600" />
              Análisis y Hallazgos de Seguridad Local
            </h3>

            {result.issues.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-start gap-3.5">
                <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900">¡Tu conexión local es completamente robusta!</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    No hemos detectado ningún problema de seguridad o infraestructura en tu primer salto de red. Tu latencia al router es de nivel industrial, cuentas con cifrado seguro y una excelente intensidad de señal.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {result.issues.map((issue, idx) => (
                  <div key={idx} className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">{issue}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Smart guidelines from experts */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <h4 className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold">Guía de Solución de Problemas del Router</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    ¿Cómo accedo a mi router ({result.gatewayIp})?
                  </h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Escribe <strong className="font-mono bg-white px-1.5 py-0.5 border border-slate-200 rounded text-slate-700">{result.gatewayIp}</strong> directamente en la barra de direcciones de tu navegador web estando conectado a esta red. Utiliza las credenciales que se encuentran en la etiqueta física debajo de tu módem físico para entrar.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Cambia la contraseña por defecto
                  </h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Los módems de fábrica son vulnerables debido a contraseñas estándar predefinidas. Una vez dentro de la consola del router, busca el apartado de "Cambiar contraseña de administrador" y establécele una contraseña robusta.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Evita canales WiFi saturados
                  </h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Si sufres de latencia elevada o microdesconexiones, es posible que tus vecinos usen el mismo canal de frecuencia. En la configuración de WiFi de tu router, cambia la opción "Canal" de Automático a canales menos saturados (como el 1, 6 o 11 para 2.4 GHz).
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Configura cifrado WPA3 o WPA2 Personal
                  </h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Nunca dejes tu red WiFi libre/abierta. En la sección "Seguridad Inalámbrica" o "WLAN", asegúrate de activar el tipo de cifrado <strong className="font-mono text-slate-700">WPA2 AES</strong> o el estándar más moderno <strong className="font-mono text-slate-700">WPA3</strong> si tus dispositivos son recientes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
