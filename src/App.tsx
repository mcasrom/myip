import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  BookOpen, 
  User, 
  HelpCircle, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Cpu, 
  Globe, 
  Mail, 
  Bell, 
  ArrowRight, 
  Compass, 
  Sparkles, 
  Wifi, 
  Clock,
  LogOut,
  Info,
  RefreshCw
} from 'lucide-react';
import RadarScanner from './components/RadarScanner';
import TrafficLight from './components/TrafficLight';
import HowToGuides from './components/HowToGuides';
import AuthSection from './components/AuthSection';
import UpgradePanel from './components/UpgradePanel';
import MarkdownRenderer from './components/MarkdownRenderer';
import PWAInstallBanner from './components/PWAInstallBanner';
import LocalNetworkDiagnostic from './components/LocalNetworkDiagnostic';
import { ScanResult, UserSession } from './types';
import { castilloManifesto } from './data/guides';
// @ts-ignore
import socialPreviewImg from './assets/images/myip_social_preview_1782808165197.jpg';
// @ts-ignore
import socialIconImg from './assets/images/myip_social_icon_1782808235532.jpg';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'guides' | 'about' | 'profile' | 'legal'>('home');
  const [homeSubTab, setHomeSubTab] = useState<'public' | 'local'>('public');
  const [detectedIp, setDetectedIp] = useState<string>('');
  const [isSimulatedIp, setIsSimulatedIp] = useState<boolean>(false);
  const [ipGeo, setIpGeo] = useState<any | null>(null);
  
  const [user, setUser] = useState<UserSession | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [legalConsentAccepted, setLegalConsentAccepted] = useState<boolean>(false);
  
  // Premium simulations
  const [premiumAlerts, setPremiumAlerts] = useState<any[]>([]);
  const [reportSending, setReportSending] = useState<boolean>(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  // Notifications banner
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // Auto-detect IP on load
  useEffect(() => {
    async function detectIp() {
      try {
        const res = await fetch('/api/ip/detect');
        const data = await res.json();
        setDetectedIp(data.ip);
        setIsSimulatedIp(data.isSimulated);
        setIpGeo(data.geo);
      } catch (err) {
        console.error('Error detecting IP:', err);
        setDetectedIp('185.230.124.5'); // Stable fallback public IP for presentation
        setIpGeo({ country: 'España', countryCode: 'ES', region: 'Madrid', city: 'Madrid', isp: 'Telefonica de España' });
      }
    }
    detectIp();
  }, []);

  // Check for Stripe redirect parameters (payment_success or payment_cancel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('payment_success') === 'true';
    const paymentCancel = params.get('payment_cancel') === 'true';
    const sessionId = params.get('session_id');

    if (paymentSuccess && sessionId) {
      // Clear query params to make it clean
      window.history.replaceState({}, document.title, window.location.pathname);
      
      triggerToast('Verificando tu pago con Stripe...', 'info');
      
      fetch('/api/premium/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      .then(res => {
        if (!res.ok) throw new Error('Error al verificar el pago');
        return res.json();
      })
      .then(data => {
        if (data.user) {
          setUser(data.user);
          triggerToast('¡Pago verificado con éxito! Cuenta Premium activada.', 'success');
          setActiveTab('profile'); // go to profile/upgrade tab to see premium status
        }
      })
      .catch(err => {
        console.error('[STRIPE ERROR]', err);
        triggerToast('Error al verificar tu sesión de pago con Stripe.', 'warning');
      });
    } else if (paymentCancel) {
      window.history.replaceState({}, document.title, window.location.pathname);
      triggerToast('Pago cancelado. Si tuviste problemas, contáctanos.', 'warning');
    }
  }, []);

  // Sync premium alerts when user changes or becomes premium
  useEffect(() => {
    if (user && user.isPremium) {
      fetch('/api/premium/alerts')
        .then(res => res.json())
        .then(data => setPremiumAlerts(data))
        .catch(err => console.error(err));
    } else {
      setPremiumAlerts([]);
    }
  }, [user]);

  const triggerToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Perform IP scan
  const handlePerformScan = async () => {
    if (!legalConsentAccepted) {
      triggerToast('Por favor, acepta la Declaración de Consentimiento y Uso Autorizado de Red antes de escanear.', 'warning');
      return;
    }
    setScanning(true);
    setRateLimitError(null);
    setScanResult(null);

    // Dynamic sweep duration of 4.5 seconds for incredible immersive UX
    await new Promise((resolve) => setTimeout(resolve, 4500));

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user ? user.email : null })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setRateLimitError(data.error);
          triggerToast('Límite de escaneo gratuito alcanzado.', 'warning');
          setActiveTab('profile'); // Send them to upgrade or view details
        } else {
          throw new Error(data.error || 'Error durante el análisis.');
        }
        return;
      }

      setScanResult(data);
      triggerToast('¡Análisis de Salud Digital completado con éxito!', 'success');
      
      // Update local user scanning count if logged in
      if (user) {
        setUser(prev => prev ? { ...prev, scanCount: prev.scanCount + 1 } : null);
      }

      setActiveTab('dashboard');
    } catch (err: any) {
      triggerToast(err.message || 'Error de conexión con el motor de diagnóstico.', 'warning');
    } finally {
      setScanning(false);
    }
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setDetectedIp(loggedInUser.ipAddress);
    triggerToast(`Bienvenido de nuevo, ${loggedInUser.email}`, 'success');
  };

  const handleUpgradeSuccess = (updatedUser: any) => {
    setUser(updatedUser);
    triggerToast('¡Felicidades! Tu cuenta ha sido elevada a Premium 👑', 'success');
  };

  const handleLogout = () => {
    setUser(null);
    setScanResult(null);
    triggerToast('Sesión cerrada correctamente.', 'info');
  };

  // Simulate an alert trigger (Premium only)
  const handleSimulateAlert = () => {
    const newAlert = {
      id: `alert-${Date.now()}`,
      type: 'SECURITY_ALERT',
      title: '¡Alerta de Seguridad Crítica!',
      message: `Se detectó un cambio sospechoso en la firma del certificado SSL para el host principal de la IP ${detectedIp}. Posible interceptación de tráfico (Man-in-the-middle).`,
      severity: 'critical',
      time: 'Hace un momento'
    };
    setPremiumAlerts(prev => [newAlert, ...prev]);
    triggerToast('¡Alerta de monitoreo simulada de forma exitosa!', 'warning');
  };

  // Send email report trigger (Premium only)
  const handleSendReport = async (type: string) => {
    if (!user) return;
    setReportSending(true);
    setReportMessage(null);

    try {
      const res = await fetch('/api/premium/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, reportType: type })
      });
      const data = await res.json();
      setReportMessage(data.message);
      triggerToast('Reporte enviado a tu correo.', 'success');
    } catch (err) {
      console.error(err);
      triggerToast('Error enviando el reporte.', 'warning');
    } finally {
      setReportSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-900">
      
      {/* Background ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce bg-white border border-slate-200 p-4 rounded-xl shadow-xl flex items-center gap-3 max-w-sm">
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
          <p className="text-xs font-semibold text-slate-800">{toast.message}</p>
        </div>
      )}

      {/* Main Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white shadow-sm">
              <div className="w-4 h-4 bg-white rounded-full border-2 border-indigo-900"></div>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white font-sans flex items-center gap-1.5">
                MyIP
                <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase tracking-widest font-bold">
                  v2.6
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">Salud Digital para Usuarios Finales</p>
            </div>
          </div>

          {/* Desktop Nav menu */}
          <nav className="hidden md:flex items-center gap-1 h-full">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'home' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Analizar Conexión
            </button>
            <button
              onClick={() => {
                if (!scanResult) {
                  triggerToast('Realiza un análisis primero para ver tus resultados.', 'info');
                  return;
                }
                setActiveTab('dashboard');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                !scanResult ? 'opacity-50 cursor-not-allowed' : ''
              } ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              Salud Digital {scanResult && '●'}
            </button>
            <button
              onClick={() => setActiveTab('guides')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'guides' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Biblioteca How-To
            </button>
            <button
              onClick={() => setActiveTab('legal')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'legal' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Garantía Legal & Cumplimiento
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'about' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              About / Filosofía
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {user ? (user.isPremium ? 'Plan Premium 👑' : 'Mi Perfil') : 'Iniciar Sesión'}
            </button>
          </nav>

          {/* Connected state badge */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] font-mono text-slate-400">IP de Conexión</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{detectedIp || 'Cargando...'}</span>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
          </div>

        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="space-y-12 max-w-4xl mx-auto py-4">
            
            {/* PWA Installation Assistant Banner */}
            <PWAInstallBanner />
            
            {/* Hero / Pitch */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-full text-xs text-indigo-600 font-semibold font-mono">
                <Wifi className="w-3.5 h-3.5 text-indigo-500" />
                Tu Red en Tiempo Real: {detectedIp}
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-display">
                ¿Qué tan segura es tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-800">conexión actual</span>?
              </h2>
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Diagnostica vulnerabilidades de red, comprueba reputación de IP en listas negras y verifica el estado de tu router o conexión WiFi actual.
              </p>
            </div>

            {/* Conversion Funnel Progress Roadmap */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm max-w-3xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-650 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" /> Embudo de Diagnóstico Activo
                  </h3>
                  <p className="text-[11px] text-slate-500">Completa la ruta de seguridad para blindar tu dirección de red.</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-mono font-bold px-2.5 py-1 rounded-lg">
                  Progreso: {user?.isPremium ? '100% Completo 👑' : user ? '66% - Registrado' : scanResult ? '33% - Analizado' : '0% - Inicio'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Step 1: Action (Scan) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  scanResult 
                    ? 'bg-indigo-50/20 border-indigo-200 text-indigo-950 shadow-sm' 
                    : 'bg-slate-50 border-slate-150 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 font-bold">Paso 1: Acción</span>
                    {scanResult ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        ✓ Listo
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold">Diagnóstico en un clic</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Analiza tu IP pública o red local para ver vulnerabilidades en tiempo real.</p>
                  {!scanResult && (
                    <button 
                      onClick={() => {
                        setHomeSubTab('public');
                        handlePerformScan();
                      }}
                      className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-[10px] transition"
                    >
                      Escanear Ahora
                    </button>
                  )}
                </div>

                {/* Step 2: Register */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  user 
                    ? 'bg-indigo-50/20 border-indigo-200 text-indigo-950 shadow-sm' 
                    : 'bg-slate-50 border-slate-150 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 font-bold">Paso 2: Registro</span>
                    {user ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        ✓ Registrado
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold">Vincular Correo</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Guarda tus escaneos históricos y recibe alertas gratuitas de red.</p>
                  {!user && (
                    <button 
                      onClick={() => {
                        setActiveTab('profile');
                        triggerToast('Crea tu cuenta gratuita con un código temporal enviado a tu email.', 'info');
                      }}
                      className="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 rounded-lg text-[10px] transition"
                    >
                      Registrarme Gratis
                    </button>
                  )}
                </div>

                {/* Step 3: Premium */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  user?.isPremium 
                    ? 'bg-indigo-50/20 border-indigo-200 text-indigo-950 shadow-sm' 
                    : 'bg-slate-50 border-slate-150 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 font-bold">Paso 3: Premium</span>
                    {user?.isPremium ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        👑 Activo
                      </span>
                    ) : (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                        Opcional
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold">Monitoreo y Alertas</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Soporte prioritario, envío de reportes PDF detallados y marca blanca.</p>
                  {!user?.isPremium && (
                    <button 
                      onClick={() => {
                        setActiveTab('profile');
                        triggerToast('Elige un plan premium para desbloquear todo el potencial.', 'info');
                      }}
                      className="mt-3 w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-1.5 rounded-lg text-[10px] transition shadow-sm"
                    >
                      Ver Planes Premium
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Toggle Switch between Public and Local diagnostics */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/60 shadow-sm">
                <button
                  onClick={() => setHomeSubTab('public')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    homeSubTab === 'public'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  IP Pública (Cloud)
                </button>
                <button
                  onClick={() => setHomeSubTab('local')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    homeSubTab === 'local'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Wifi className="w-4 h-4" />
                  Red Local & WiFi
                </button>
              </div>
            </div>

            {homeSubTab === 'public' ? (
              <>
                {/* Radar scanner visual widget */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm max-w-2xl mx-auto">
                  <RadarScanner scanning={scanning} ip={detectedIp} />

                  {/* Legal and Compliance Consent Checkbox Card */}
                  <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-4.5 text-left max-w-lg mx-auto space-y-3 shadow-inner">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="legal-checkbox"
                        checked={legalConsentAccepted}
                        onChange={(e) => setLegalConsentAccepted(e.target.checked)}
                        className="mt-1 h-4 w-4 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="legal-checkbox" className="text-xs text-slate-700 leading-relaxed cursor-pointer font-medium">
                        <strong>Declaración de Consentimiento Autorizado:</strong> Confirmo bajo declaración de fe que soy el titular o administrador de la conexión actual (<span className="font-mono text-indigo-600 font-bold">{detectedIp}</span>) y otorgo consentimiento explícito para realizar este diagnóstico de puertos de conformidad con normativas internacionales.
                      </label>
                    </div>
                    <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" /> Cero Riesgo de Intrusión
                      </span>
                      <button 
                        onClick={() => setActiveTab('legal')}
                        className="text-indigo-600 hover:underline font-bold"
                      >
                        Garantías Legales & Regulación &rarr;
                      </button>
                    </div>
                  </div>

                  {/* Guest Session Attempts Indicator / Antifraude */}
                  {user && (user.isGuest || user.email.startsWith('invitado_') || user.email.endsWith('@myip.local')) && (
                    <div className="mt-5 bg-indigo-50/40 border border-indigo-100/80 rounded-2xl p-4.5 max-w-lg mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-left">
                        <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800">
                            🛡️ Sesión de Invitado Activa (Protección Antifraude)
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Acceso anónimo limitado para prevenir abuso automatizado del servidor.
                          </p>
                        </div>
                      </div>
                      <div className="bg-emerald-600 text-white font-mono font-bold px-3 py-1 rounded-xl text-[10px] tracking-wider uppercase shadow-sm flex-shrink-0 text-center sm:text-right">
                        {Math.max(0, 3 - (user.scanCount || 0))} de 3 intentos restantes
                      </div>
                    </div>
                  )}

                  {/* Big Scan Button */}
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={handlePerformScan}
                      className={`font-bold py-4 px-10 rounded-2xl text-base tracking-wide transition-all shadow-md flex items-center gap-3 uppercase font-mono ${
                        legalConsentAccepted 
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-80'
                      }`}
                    >
                      <Cpu className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
                      {scanning ? 'Ejecutando Diagnóstico...' : 'Analizar mi conexión ahora'}
                    </button>
                  </div>

                  {rateLimitError && (
                    <p className="text-center text-xs text-red-700 mt-4 bg-red-50 border border-red-100 p-3 rounded-xl">
                      {rateLimitError}
                    </p>
                  )}
                </div>

                {/* Geo details badge panel */}
                {ipGeo && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                    <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                      <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">País Detectado</span>
                      <p className="text-sm font-semibold text-slate-800 mt-1 flex items-center justify-center gap-1.5">
                        <Globe className="w-4 h-4 text-indigo-500" />
                        {ipGeo.country} ({ipGeo.countryCode})
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                      <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Región / Ciudad</span>
                      <p className="text-sm font-semibold text-slate-800 mt-1">{ipGeo.region}, {ipGeo.city}</p>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-xl text-center col-span-2 shadow-sm">
                      <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Proveedor ISP</span>
                      <p className="text-sm font-bold text-indigo-600 mt-1 font-mono truncate">{ipGeo.isp}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="animate-fade-in">
                <LocalNetworkDiagnostic onToast={triggerToast} />
              </div>
            )}

            {/* Disclaimer & Privacy Manifesto link */}
            <div className="text-center pt-4 border-t border-slate-200 max-w-xl mx-auto space-y-2">
              <p className="text-xs text-slate-500">
                Respeto total a la privacidad de tu red. Ningún dato técnico es recolectado con fines de comercialización.
              </p>
              <button 
                onClick={() => setActiveTab('about')}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                Conoce la filosofía de M. Castillo sobre educación en ciberseguridad accesible &rarr;
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: DASHBOARD RESULT */}
        {activeTab === 'dashboard' && scanResult && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header Result summary bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tracking-widest text-indigo-600 uppercase bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded font-bold">
                    Resultados del Diagnóstico
                  </span>
                  {isSimulatedIp && (
                    <span className="text-[10px] font-mono text-amber-750 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded font-bold">
                      Simulando IP de prueba
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                  Salud de tu IP de Conexión: <span className="font-mono text-indigo-600">{scanResult.ip}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Analizado el {new Date(scanResult.timestamp).toLocaleString('es-ES')}
                </p>
              </div>

              {/* Trigger Re-scan directly */}
              <button
                onClick={handlePerformScan}
                disabled={scanning}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                Actualizar Diagnóstico
              </button>
            </div>

            {/* Grid structure: Traffic Light vs Port results list */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start">
              
              {/* Traffic Light widget Left Column */}
              <div className="md:col-span-5 lg:col-span-4 space-y-6">
                <TrafficLight score={scanResult.score} />

                {/* Blacklists Check Summary widget */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-500" /> Reputación en Listas Negras
                  </h3>

                  <div className="space-y-3">
                    {scanResult.reputation.map((rep, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{rep.listName}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            rep.clean ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-rose-700 bg-rose-50 border border-rose-100'
                          }`}>
                            {rep.clean ? 'Limpio' : 'Reportado ⚠️'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{rep.details}</p>
                      </div>
                    ))}
                    {!user?.isPremium && (
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-[11px] text-amber-700 text-center font-medium">
                        * Adquiere el plan <strong>Premium</strong> para activar chequeos continuos contra Project Honey Pot y Cisco Talos.
                      </div>
                    )}
                  </div>
                </div>

                {/* SSL Certificate Analysis (Freemium logic representation) */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-indigo-500" /> Certificado SSL/TLS
                    </h3>
                    {!user?.isPremium ? (
                      <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <Unlock className="w-3 h-3" /> Activo
                      </span>
                    )}
                  </div>

                  {!user?.isPremium ? (
                    <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-3">
                      <Lock className="w-8 h-8 text-slate-450 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">Análisis SSL Bloqueado</p>
                        <p className="text-[11px] text-slate-500 px-4 leading-relaxed">El monitoreo de certificados, alertas de expiración y huellas digitales está disponible en el plan Premium.</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('profile')}
                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-lg font-bold transition shadow-sm"
                      >
                        Activar Premium
                      </button>
                    </div>
                  ) : scanResult.sslInfo ? (
                    <div className="space-y-3">
                      <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Emisor:</span>
                          <span className="font-semibold text-slate-700">{scanResult.sslInfo.issuer}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Expira el:</span>
                          <span className="font-semibold text-slate-700 font-mono">{scanResult.sslInfo.validTo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Días restantes:</span>
                          <span className="font-bold text-indigo-600 font-mono">{scanResult.sslInfo.daysToExpiry} días</span>
                        </div>
                        {scanResult.sslInfo.alert && (
                          <p className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-[10px] text-amber-700">
                            ⚠️ {scanResult.sslInfo.alert}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic text-center">No se detectó host SSL activo asociado para esta IP.</p>
                  )}
                </div>

                {/* 24/7 Monitoring state alerts (Premium only) */}
                {user?.isPremium && (
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-sm">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-indigo-500 animate-pulse" /> Monitoreo de Disponibilidad 24/7
                    </h3>
                    
                    <div className="space-y-2.5">
                      {premiumAlerts.length > 0 ? (
                        premiumAlerts.map((alert) => (
                          <div 
                            key={alert.id} 
                            className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                              alert.severity === 'critical' 
                                ? 'bg-red-50 border-red-100 text-red-800' 
                                : alert.severity === 'warning'
                                ? 'bg-amber-50 border-amber-100 text-amber-800'
                                : 'bg-slate-50 border-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex justify-between font-bold">
                              <span>{alert.title}</span>
                              <span className="text-[10px] font-mono text-slate-400">{alert.time}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed opacity-90">{alert.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center py-4">Todo en orden. No hay alertas de monitoreo registradas.</p>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Technical findings & Gemini analysis translation Right Column */}
              <div className="md:col-span-7 lg:col-span-8 space-y-6">
                
                {/* Port Scan Findings list */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm text-slate-800">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider font-mono border-b border-slate-100 pb-3 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-500" /> Puertos Críticos Escaneados
                  </h3>

                  <div className="space-y-4">
                    {scanResult.ports.map((p, idx) => (
                      <div 
                        key={idx} 
                        className={`p-5 rounded-xl border space-y-3 transition-all ${
                          p.status === 'open' 
                            ? 'bg-rose-50/20 border-rose-200 shadow-sm' 
                            : 'bg-emerald-50/10 border-emerald-150/80 shadow-sm'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-150 pb-2.5">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-mono font-bold text-indigo-700">
                              Puerto {p.port}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {p.service}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {p.status === 'open' && (
                              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded ${
                                p.risk === 'high' ? 'text-red-700 bg-red-50 border border-red-100' :
                                p.risk === 'medium' ? 'text-amber-700 bg-amber-50 border border-amber-100' :
                                'text-emerald-700 bg-emerald-50 border border-emerald-100'
                              }`}>
                                Riesgo: {p.risk === 'high' ? 'Alto' : p.risk === 'medium' ? 'Medio' : 'Bajo'}
                              </span>
                            )}
                            <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full ${
                              p.status === 'open' 
                                ? 'text-rose-700 bg-rose-50 border border-rose-200' 
                                : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                            }`}>
                              {p.status === 'open' ? 'Expuesto 🔓' : 'Protegido 🔒'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                          <div className="space-y-1">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">¿Qué significa?</p>
                            <p className="text-slate-800 font-medium">{p.explanation}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Recomendación para mitigar:</p>
                            <p className="text-indigo-950 font-bold">{p.recommendation}</p>
                          </div>
                        </div>

                        {p.status === 'open' && (
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                setActiveTab('guides');
                                // Delay scroll slightly to let render happen if needed
                                setTimeout(() => {
                                  const guideEl = document.getElementById(p.port === 22 ? 'ssh-guide' : p.port === 80 ? 'http-to-https-guide' : 'ufw-firewall-guide');
                                  if (guideEl) guideEl.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              }}
                              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold"
                            >
                              Ver guía paso a paso para mitigar esto <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI / Gemini generated translation panel */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" /> Traducción Humana Inteligente (Gemini AI)
                    </h3>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded font-mono font-bold">
                      @google/genai active
                    </span>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-150">
                    <MarkdownRenderer content={scanResult.analysisText} />
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 3: HOW-TO LIBRARY & ABOUT */}
        {activeTab === 'guides' && (
          <HowToGuides />
        )}

        {/* TAB 4: ABOUT MANIFESTO */}
        {activeTab === 'about' && (
          <div className="max-w-4xl mx-auto space-y-10 py-4">
            <div className="bg-white border border-slate-200 p-8 rounded-3xl space-y-8 shadow-sm text-slate-800">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">{castilloManifesto.author}</h2>
                    <p className="text-sm text-indigo-600 font-mono font-bold">{castilloManifesto.role}</p>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <span className="text-xs font-mono text-slate-400 font-bold uppercase">Copyright &copy; 2026 M. Castillo</span>
                </div>
              </div>

              {/* Manifesto paragraph blocks */}
              <div className="space-y-6 text-sm md:text-base text-slate-600 leading-relaxed font-sans max-w-3xl">
                <h3 className="text-xl md:text-2xl font-bold text-indigo-600 tracking-tight italic">
                  &ldquo;{castilloManifesto.title}&rdquo;
                </h3>
                {castilloManifesto.paragraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              {/* Quote block */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-3xl italic text-slate-500 font-medium text-center leading-relaxed">
                &ldquo;{castilloManifesto.quote}&rdquo;
              </div>

              {/* Contact box */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-400">
                <p>Compartido bajo la iniciativa de Software Libre y Educación Abierta de Privacy Tools.</p>
                <div className="flex items-center gap-2">
                  <span>Contacto Directo:</span>
                  <a href={`mailto:${castilloManifesto.contact}`} className="text-indigo-600 hover:underline font-bold font-mono">
                    {castilloManifesto.contact}
                  </a>
                </div>
              </div>

            </div>

            {/* NEW: Brand & Social Media Kit (Preview & Icon) */}
            <div className="bg-white border border-slate-200 p-8 rounded-3xl space-y-6 shadow-sm text-slate-800">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-mono tracking-widest uppercase font-bold">Recursos Visuales</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">Kit de Redes Sociales & Brand Assets</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Comparte MyIP con estilo. Hemos diseñado recursos gráficos de alta calidad y estéticos para que puedas usarlos en tus redes sociales.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* 1:1 Social Icon Column */}
                <div className="md:col-span-4 space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-700">Logo / Avatar (1:1)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Perfecto para perfiles, avatares o publicaciones cuadradas.</p>
                  </div>
                  <div className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center p-3 shadow-sm transition-all duration-300 hover:shadow-md">
                    <img 
                      src={socialIconImg} 
                      alt="MyIP App Icon" 
                      className="w-full aspect-square object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                      <a 
                        href={socialIconImg} 
                        download="myip_social_icon.jpg" 
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/90 hover:bg-white text-slate-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-transform duration-200 hover:scale-105"
                      >
                        Descargar Icono
                      </a>
                    </div>
                  </div>
                </div>

                {/* 16:9 Social Preview Column */}
                <div className="md:col-span-8 space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-700">Banner / Vista Previa (16:9)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Diseñado como tarjeta de previsualización para Twitter, LinkedIn, Facebook o post de blog.</p>
                  </div>
                  <div className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm transition-all duration-300 hover:shadow-md">
                    <img 
                      src={socialPreviewImg} 
                      alt="MyIP Social Preview Banner" 
                      className="w-full aspect-[16/9] object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                      <a 
                        href={socialPreviewImg} 
                        download="myip_social_preview.jpg" 
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/90 hover:bg-white text-slate-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-transform duration-200 hover:scale-105"
                      >
                        Descargar Banner
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Share Message Helper */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Tip de Compartido</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    "¡Analizando la salud de mi dirección IP con la plataforma MyIP! Es libre, rápida y no comparte mis datos con terceros."
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("¡Analizando la salud de mi dirección IP con la plataforma MyIP! Es libre, rápida y no comparte mis datos con terceros. #MyIP #PrivacyTools #NetworkSecurity");
                    triggerToast("¡Texto copiado al portapapeles con éxito!", "success");
                  }}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Copiar Mensaje y Tags
                </button>
              </div>

            </div>

          </div>
        )}

        {/* TAB 4.5: LEGAL & COMPLIANCE FRAMEWORK */}
        {activeTab === 'legal' && (
          <div className="max-w-4xl mx-auto space-y-10 py-4 text-slate-800 animate-fade-in">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-8 rounded-3xl shadow-md space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-200 border border-white/10">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Garantía de Seguridad Legal</span>
                  <h2 className="text-xl sm:text-2xl font-bold font-sans">Marco Legal y Cumplimiento Normativo (MyIP Shield)</h2>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                ¿Por qué MyIP es una solución 100% legal, segura y ética para el diagnóstico de puertos y salud de red, a diferencia de herramientas de línea de comandos sin restricciones como Nmap? Aquí desglosamos las bases legales y técnicas que protegen tanto a los operadores como a los usuarios finales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-xs">1</span>
                  Cero Abuso: Restricción Estricta de IP
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Las herramientas de red tradicionales (como <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-650">nmap</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-650">masscan</code> o suites de penetración) permiten a cualquier usuario escanear de forma maliciosa servidores de grandes empresas, instituciones de gobierno o redes residenciales ajenas. Esto constituye una violación directa de leyes de acceso no autorizado.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  <strong>La Solución MyIP:</strong> El servidor detecta automáticamente la dirección IP del visitante mediante las cabeceras HTTP de red (<code className="bg-slate-100 px-1 font-mono">req</code>) y restringe la auditoría TCP activa <strong>únicamente</strong> a esa IP. El usuario no tiene la opción técnica de escribir o escanear una IP de terceros, eliminando por completo el riesgo de uso ilegal.
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-xs">2</span>
                  Cumplimiento del Código Penal (Art. 197 bis)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  En España y gran parte de la Unión Europea, el acceso sin autorización a sistemas informáticos ajenos está severamente penado. Sin embargo, realizar comprobaciones pasivas de puertos públicos abiertos (sin forzar autenticación, saltarse firewalls, realizar exploits o inyecciones) es legal para auditorías de salud digital.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  <strong>Garantía MyIP:</strong> El sistema actúa estrictamente como un asesor preventivo. Únicamente reporta qué puertos (ej. puerto 80 HTTP, puerto 22 SSH) están respondiendo al tráfico público para alertar al usuario si dejó abierta la administración de su router. No ejecuta ataques de penetración.
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-xs">3</span>
                  Cumplimiento de la CFAA (EE.UU.)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  La <em>Computer Fraud and Abuse Act</em> penaliza el acceso intencional a computadoras protegidas sin autorización. Al requerir que el usuario marque activamente la <strong>Declaración de Consentimiento Autorizado</strong> antes de iniciar el diagnóstico, el servicio MyIP queda plenamente respaldado bajo consentimiento explícito del propietario de la conexión.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  <strong>Consentimiento Explícito:</strong> Cada solicitud de escaneo se realiza bajo consentimiento informado con aceptación del descargo de responsabilidad legal, garantizando la trazabilidad y la buena fe de la auditoría.
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-xs">4</span>
                  Protección frente a Listas Negras (RBLs)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Los escaneos masivos realizados mediante software local a menudo resultan en que el ISP del usuario bloquee su conexión o que su dirección IP sea listada en bases de datos de reputación negativa (como Spamhaus o AbuseIPDB) debido a actividad sospechosa en puertos altos.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  <strong>Escaneo Controlado de 5 Puertos:</strong> MyIP realiza un barrido ultra rápido únicamente sobre los 5 puertos críticos de alto riesgo (22, 80, 443, 3306, 8080) desde un clúster centralizado. Esto previene que tu router o tu ISP marquen tu IP como origen de un escaneo hostil de red.
                </div>
              </div>
            </div>

            {/* Direct Comparison: Nmap vs MyIP */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800">Comparativa de Seguridad Legal y Operativa</h3>
                <p className="text-xs text-slate-500 mt-1">¿Por qué MyIP es el sustituto seguro para distribuir diagnósticos a tus usuarios finales de forma legal?</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-3 font-semibold text-slate-600">Característica / Factor</th>
                      <th className="p-3 font-semibold text-rose-800 bg-rose-50/40">Distribución de Nmap Directo</th>
                      <th className="p-3 font-bold text-indigo-700 bg-indigo-50/40">Servicio MyIP Core (Recomendado)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-semibold">Responsabilidad Penal del Operador</td>
                      <td className="p-3 text-rose-700 bg-rose-50/20"><strong>Muy Alta.</strong> Si tu app distribuye binarios de Nmap, los usuarios pueden atacar a terceros usando tu marca.</td>
                      <td className="p-3 text-emerald-800 bg-emerald-50/20 font-medium"><strong>Nula.</strong> El servidor restringe el escaneo a la propia IP pública entrante del usuario de forma automática.</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-semibold">Instalación y Requisitos Técnicos</td>
                      <td className="p-3 text-rose-700 bg-rose-50/20">Requiere permisos de administrador (root/sudo), instalar WinPcap/Npcap en Windows, librerías del sistema.</td>
                      <td className="p-3 text-emerald-800 bg-emerald-50/20 font-medium"><strong>Cero instalación.</strong> Diagnóstico en un solo clic desde cualquier navegador móvil o de escritorio.</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-semibold">Intercepción del Antivirus</td>
                      <td className="p-3 text-rose-700 bg-rose-50/20">Windows Defender y la mayoría de Endpoint EDR bloquean Nmap por considerarlo una herramienta de hacking hostil.</td>
                      <td className="p-3 text-emerald-800 bg-emerald-50/20 font-medium"><strong>100% Amigable.</strong> No genera alertas en los antivirus al ser una web de diagnóstico estándar.</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-semibold">Privacidad y Alertas de Red</td>
                      <td className="p-3 text-rose-700 bg-rose-50/20">No tiene almacenamiento nativo de auditorías ni alertas SSL en background de forma automática sin scripts bash complejos.</td>
                      <td className="p-3 text-emerald-800 bg-emerald-50/20 font-medium">Alertas 24/7 de caídas de puertos e informes PDF descargables o enviados por email al instante.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legal Advisory Footer */}
            <div className="bg-indigo-50 border border-indigo-150 p-6 rounded-2xl flex items-start gap-4">
              <Shield className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-indigo-900">🛡️ Garantía de Confianza de M. Castillo</h4>
                <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                  "Desarrollamos esta solución web con el objetivo de masificar la auditoría de seguridad sin cometer delitos informáticos. Al centralizar los escaneos únicamente en la IP de origen y requerir consentimiento, tus usuarios disfrutan de diagnósticos de red profesionales sin infringir normativas locales. Es el sustituto idóneo frente a la distribución insegura de scripts de terminal."
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PROFILE / UPGRADE */}
        {activeTab === 'profile' && (
          <div className="space-y-10">
            {/* Header / Intro */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-slate-800">
              <div>
                <span className="text-xs font-mono tracking-widest text-indigo-600 uppercase font-bold">Membresías & Cuenta</span>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mt-1">Gestión de Acceso MyIP</h2>
                <p className="text-xs text-slate-500 mt-1">Regístrate de forma simple para vincular tu IP o adquiere el plan Premium con Stripe.</p>
              </div>
              
              {user && (
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 border border-slate-100 rounded-xl shadow-inner">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span className="text-xs text-slate-750 font-bold truncate max-w-[200px]">{user.email}</span>
                </div>
              )}
            </div>

            {/* Authentication and setup segment */}
            <AuthSection 
              user={user} 
              onLoginSuccess={handleLoginSuccess} 
              onLogout={handleLogout} 
            />

            {/* Upgrade Panel Segment */}
            {user && (
              <div className="border-t border-slate-150 pt-8">
                <UpgradePanel
                  email={user.email}
                  isPremium={user.isPremium}
                  onUpgradeSuccess={handleUpgradeSuccess}
                  onSimulateAlert={handleSimulateAlert}
                  onSendReport={handleSendReport}
                  reportSending={reportSending}
                  reportMessage={reportMessage}
                />
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer copyright block */}
      <footer className="border-t border-slate-200 bg-white py-8 pb-24 md:pb-8 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="space-y-1">
            <p className="font-bold text-slate-600">MyIP &copy; 2026 M. Castillo | Privacy Tools</p>
            <p>Todos los derechos reservados. Diseñado para empoderar al usuario final en la protección de su red.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="#manifesto-section" onClick={() => setActiveTab('about')} className="hover:text-slate-600 font-semibold text-slate-500">Sobre Misión</a>
            <a href="#how-to" onClick={() => setActiveTab('guides')} className="hover:text-slate-600 font-semibold text-slate-500">Biblioteca How-To</a>
            <a href="#legal-compliance" onClick={() => setActiveTab('legal')} className="hover:text-indigo-600 font-semibold text-indigo-600">Marco Legal & Cumplimiento</a>
            <a href={`mailto:${castilloManifesto.contact}`} className="hover:text-slate-600 font-mono font-bold text-indigo-600">{castilloManifesto.contact}</a>
          </div>
        </div>
      </footer>

      {/* Bottom Navigation Bar for Mobile and Tablet (Smartphones) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-xl pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              activeTab === 'home' ? 'text-indigo-400 font-bold scale-105' : 'text-slate-400'
            }`}
          >
            <Shield className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Analizar</span>
          </button>
          
          <button
            onClick={() => {
              if (!scanResult) {
                triggerToast('Realiza un análisis primero para ver tus resultados.', 'info');
                return;
              }
              setActiveTab('dashboard');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              !scanResult ? 'opacity-40 cursor-not-allowed' : ''
            } ${activeTab === 'dashboard' ? 'text-indigo-400 font-bold scale-105' : 'text-slate-400'}`}
          >
            <div className="relative">
              <Activity className="w-5 h-5 mb-0.5" />
              {scanResult && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
            </div>
            <span className="text-[10px] tracking-tight">Salud IP</span>
          </button>

          <button
            onClick={() => setActiveTab('guides')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              activeTab === 'guides' ? 'text-indigo-400 font-bold scale-105' : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">How-To</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              activeTab === 'about' ? 'text-indigo-400 font-bold scale-105' : 'text-slate-400'
            }`}
          >
            <Info className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">About</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              activeTab === 'profile' ? 'text-indigo-400 font-bold scale-105' : 'text-slate-400'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight truncate max-w-[55px]">
              {user ? 'Perfil' : 'Entrar'}
            </span>
          </button>
        </div>
      </nav>

    </div>
  );
}
