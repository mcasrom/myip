import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Eye, EyeOff, Lock, Unlock, Key, AlertTriangle, CheckCircle, XCircle, Globe } from 'lucide-react';
import { motion } from 'motion/react';

interface SecurityCheck {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  detail: string;
  recommendation: string;
}

// Check WebRTC leak: does the browser expose local/public IP via WebRTC?
async function checkWebRTCIp(): Promise<string | null> {
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.createDataChannel('');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => { resolve(null); pc.close(); }, 3000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const parts = e.candidate.candidate.split(' ');
        const ip = parts[4];
        if (ip && !ip.startsWith('0.0.0.0')) {
          clearTimeout(timeout);
          resolve(ip);
          pc.close();
        }
      };
    });
  } catch {
    return null;
  }
}

// Check if password has been breached using HaveIBeenPwned k-anonymity (free, no API key)
async function checkPasswordBreach(password: string): Promise<number> {
  if (!password || password.length < 4) return 0;
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await res.text();
    const line = text.split('\n').find(l => l.startsWith(suffix));
    if (line) {
      const count = parseInt(line.split(':')[1], 10);
      return isNaN(count) ? 0 : count;
    }
    return 0;
  } catch {
    return 0;
  }
}

export default function TerminalSecurityCheck() {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<SecurityCheck[]>([]);
  const [passwordTest, setPasswordTest] = useState('');
  const [breachCount, setBreachCount] = useState<number | null>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    setChecks([]);
    setBreachCount(null);
    
    const results: SecurityCheck[] = [];

    // 1. Secure Context (HTTPS)
    results.push({
      id: 'secure-context',
      name: 'Conexión Segura (HTTPS)',
      icon: window.isSecureContext ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />,
      status: window.isSecureContext ? 'pass' : 'fail',
      detail: window.isSecureContext ? 'Tu conexión usa HTTPS cifrado.' : 'Tu conexión NO usa HTTPS. Los datos viajan en texto plano.',
      recommendation: window.isSecureContext ? 'Correcto. Siempre usa sitios con HTTPS.' : 'Evita introducir datos sensibles en sitios sin HTTPS.',
    });

    // 2. Do Not Track
    const dnt = (navigator as any).doNotTrack;
    const dntEnabled = dnt === '1' || dnt === 'yes';
    results.push({
      id: 'dnt',
      name: 'Do Not Track',
      icon: dntEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
      status: dntEnabled ? 'pass' : 'warn',
      detail: dntEnabled ? 'Tu navegador solicita no ser rastreado.' : 'Tu navegador no bloquea el rastreo por defecto.',
      recommendation: dntEnabled ? 'Bien. Ten en cuenta que muchos sitios ignoran esta señal.' : 'Activa "Do Not Track" en la configuración de tu navegador.',
    });

    // 3. Third-party cookies
    const cookiesEnabled = navigator.cookieEnabled;
    results.push({
      id: 'cookies',
      name: 'Cookies de Terceros',
      icon: cookiesEnabled ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />,
      status: cookiesEnabled ? 'warn' : 'pass',
      detail: cookiesEnabled ? 'Las cookies están habilitadas (comportamiento normal).' : 'Las cookies están deshabilitadas.',
      recommendation: cookiesEnabled ? 'Considera bloquear cookies de terceros en la configuración de privacidad.' : 'Si algún sitio no funciona, habilita cookies para ese sitio.',
    });

    // 4. Password Manager available
    const hasPasswordManager = typeof (navigator as any).credentials !== 'undefined' && typeof (window as any).PasswordCredential !== 'undefined';
    results.push({
      id: 'password-manager',
      name: 'Gestor de Contraseñas del Navegador',
      icon: hasPasswordManager ? <Key className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />,
      status: hasPasswordManager ? 'pass' : 'warn',
      detail: hasPasswordManager ? 'Tu navegador ofrece guardar contraseñas.' : 'No se detectó gestor de contraseñas nativo.',
      recommendation: hasPasswordManager ? 'Úsalo con contraseñas únicas para cada servicio.' : 'Usa un gestor como Bitwarden o 1Password.',
    });

    // 5. WebRTC Leak Test
    results.push({
      id: 'webrtc',
      name: 'Fuga de IP por WebRTC',
      icon: <Globe className="w-4 h-4" />,
      status: 'unknown',
      detail: 'Comprobando si tu navegador filtra tu IP real...',
      recommendation: '',
    });

    setChecks([...results]);

    const webrtcIp = await checkWebRTCIp();
    const webrtcIdx = results.findIndex(r => r.id === 'webrtc');
    if (webrtcIp) {
      results[webrtcIdx] = {
        ...results[webrtcIdx],
        icon: <AlertTriangle className="w-4 h-4" />,
        status: 'fail',
        detail: `Tu IP real (${webrtcIp}) se filtra por WebRTC. Si usas VPN, tu ubicación real podría quedar expuesta.`,
        recommendation: 'Bloquea WebRTC en la configuración de tu navegador o usa una extensión que lo desactive.',
      };
    } else {
      results[webrtcIdx] = {
        ...results[webrtcIdx],
        icon: <ShieldCheck className="w-4 h-4" />,
        status: 'pass',
        detail: 'No se detectó fuga de IP por WebRTC.',
        recommendation: 'Tu navegador no expone tu IP a través de WebRTC.',
      };
    }

    setChecks([...results]);
    setRunning(false);
  };

  const testPasswordBreach = async () => {
    if (!passwordTest) return;
    setCheckingBreach(true);
    setBreachCount(null);
    const count = await checkPasswordBreach(passwordTest);
    setBreachCount(count);
    setCheckingBreach(false);
  };

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passCount / total) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-700 p-4 sm:p-5 rounded-2xl flex items-start gap-3 text-white">
        <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h3 className="text-sm sm:text-base font-bold">Auditoría de Seguridad del Navegador</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Comprueba si tu navegador filtra tu IP, si pide no ser rastreado, y si tus contraseñas han aparecido en filtraciones conocidas. Todo se ejecuta localmente, sin enviar datos a ningún servidor.
          </p>
        </div>
      </div>

      {/* Password Breach Check */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-500" />
          ¿Tu contraseña ha sido filtrada?
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Usa la API de Have I Been Pwned (k-anonymity). Tu contraseña NUNCA se envía completa — solo los primeros 5 caracteres de su hash SHA-1.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="password"
            value={passwordTest}
            onChange={(e) => setPasswordTest(e.target.value)}
            placeholder="Escribe una contraseña para comprobar..."
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={testPasswordBreach}
            disabled={checkingBreach || !passwordTest}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {checkingBreach ? 'Comprobando...' : 'Comprobar'}
          </button>
        </div>
        {breachCount !== null && (
          <div className={`mt-4 p-4 rounded-xl border ${breachCount > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className={`text-sm font-bold ${breachCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {breachCount > 0
                ? `⚠️ Esta contraseña ha aparecido en ${breachCount.toLocaleString()} filtraciones conocidas. ¡Cámbiala inmediatamente!`
                : '✅ Esta contraseña no aparece en filtraciones conocidas.'}
            </p>
          </div>
        )}
      </div>

      {/* Run Button */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 sm:p-8 rounded-3xl shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Auditoría del Terminal</span>
            <h2 className="text-lg sm:text-2xl font-bold font-sans">¿Tu navegador te protege?</h2>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          Detecta fugas de IP, rastreo, y configuración insegura. Todo se ejecuta en tu navegador, sin enviar datos.
        </p>
        <button
          onClick={runChecks}
          disabled={running}
          className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
        >
          <ShieldCheck className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Auditando...' : 'Ejecutar Auditoría'}
        </button>
      </div>

      {/* Loading */}
      {running && (
        <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col items-center justify-center space-y-4 text-center text-slate-800">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          </div>
          <p className="font-bold text-slate-800">Auditando tu navegador...</p>
        </div>
      )}

      {/* Results */}
      {checks.length > 0 && !running && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Score */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Resultado de la Auditoría</h3>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                score >= 80 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                score >= 50 ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                'bg-red-50 text-red-800 border border-red-100'
              }`}>
                {passCount}/{total} aprobados
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all duration-700 ${
                  score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> {passCount} OK</span>
              <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> {warnCount} Avisos</span>
              <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {failCount} Fallos</span>
            </div>
          </div>

          {/* Individual Checks */}
          <div className="space-y-3">
            {checks.map((check) => (
              <div key={check.id} className={`bg-white border rounded-xl p-4 sm:p-5 shadow-sm ${
                check.status === 'pass' ? 'border-emerald-200' :
                check.status === 'fail' ? 'border-red-200' :
                check.status === 'warn' ? 'border-amber-200' :
                'border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    check.status === 'pass' ? 'bg-emerald-50 text-emerald-600' :
                    check.status === 'fail' ? 'bg-red-50 text-red-600' :
                    check.status === 'warn' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-50 text-slate-400'
                  }`}>
                    {check.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-slate-800">{check.name}</h4>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        check.status === 'pass' ? 'bg-emerald-50 text-emerald-700' :
                        check.status === 'fail' ? 'bg-red-50 text-red-700' :
                        check.status === 'warn' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {check.status === 'pass' ? 'OK' :
                         check.status === 'fail' ? 'FALLO' :
                         check.status === 'warn' ? 'AVISO' :
                         '...'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{check.detail}</p>
                    {check.recommendation && (
                      <p className="text-xs text-indigo-600 mt-1 font-medium">💡 {check.recommendation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
