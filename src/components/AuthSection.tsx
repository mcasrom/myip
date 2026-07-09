import React, { useState } from 'react';
import { Mail, CheckCircle2, RefreshCw, ShieldCheck, AlertCircle, Info, Fingerprint, Key } from 'lucide-react';

// Simple password strength checker (no external dependencies)
function getPasswordStrength(pw: string): { score: number; label: string; color: string; feedback: string } {
  if (pw.length === 0) return { score: 0, label: '', color: 'bg-slate-200', feedback: '' };
  
  let score = 0;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const isLong = pw.length >= 12;
  const isVeryLong = pw.length >= 16;
  
  // Length is the most important factor
  if (pw.length >= 8) score++;
  if (isLong) score++;
  if (isVeryLong) score++;
  
  // Character variety
  if ((hasLower && hasUpper) || (hasLower && hasDigit) || (hasLower && hasSymbol)) score++;
  if (hasLower && hasUpper && hasDigit && hasSymbol) score++;
  
  // Penalize common patterns
  const commonPatterns = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome'];
  const isCommon = commonPatterns.some(p => pw.toLowerCase().includes(p));
  if (isCommon) score = Math.min(score, 1);
  
  // Repeated characters
  if (/(.)\1{2,}/.test(pw)) score = Math.max(0, score - 1);
  
  // Maximo score real es 5 (3 por longitud + 2 por variedad), pero labels/
  // colors solo tienen indices 0-4 -> acotar para evitar undefined en la
  // contrasenya mas fuerte posible (bug detectado antes de comprometer).
  const cappedScore = Math.min(score, 4);
  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];
  
  let feedback = '';
  if (cappedScore <= 1) feedback = 'Usa al menos 8 caracteres con variedad';
  else if (cappedScore === 2) feedback = 'Añade mayúsculas, números o símbolos';
  else if (cappedScore === 3) feedback = 'Buena contraseña';
  
  return { score: cappedScore, label: labels[cappedScore], color: colors[cappedScore], feedback };
}

interface AuthSectionProps {
  user: any | null;
  onLoginSuccess: (user: any) => void;
  onLogout: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

export default function AuthSection({ user, onLoginSuccess, onLogout, canInstallPwa, onInstallPwa }: AuthSectionProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Premium code redemption
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [redeemMsgType, setRedeemMsgType] = useState<'success' | 'error'>('error');

  // Password strength calculation
  const pwStrength = getPasswordStrength(password);
  const strengthScore = pwStrength.score;
  const strengthLabel = pwStrength.label;
  const strengthColor = pwStrength.color;
  const strengthFeedback = pwStrength.feedback;

  // Registro real con contraseña (minimo 8 caracteres)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Introduce un correo electrónico válido.');
      return;
    }
    if (!password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password.length > 128) {
      setError('La contraseña no puede tener más de 128 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar.');
      }

      onLoginSuccess(data.user);
      setSuccessMsg(`Cuenta creada con ${email}. Tus escaneos se guardarán en esta cuenta.`);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Login real: verifica contraseña contra el backend
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Introduce email y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Acceso invitado: inmediato, sin datos personales
  const handleGuestAccess = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión de invitado.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Redeem premium code
  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) { 
      setRedeemMsg('Introduce un código.'); 
      setRedeemMsgType('error'); 
      return; 
    }
    if (!user?.email) {
      setRedeemMsg('Debes iniciar sesión primero.'); 
      setRedeemMsgType('error'); 
      return;
    }
    
    setRedeemLoading(true);
    setRedeemMsg(null);
    
    try {
      const res = await fetch('/api/premium/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: redeemCode })
      });
      const data = await res.json();
      if (!res.ok) { 
        setRedeemMsg(data.error); 
        setRedeemMsgType('error'); 
        return; 
      }
      setRedeemMsg(data.message); 
      setRedeemMsgType('success');
      onLoginSuccess(data.user);
      setRedeemCode('');
    } catch { 
      setRedeemMsg('Error de conexión.'); 
      setRedeemMsgType('error'); 
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start text-slate-800">

      {/* Columna informativa */}
      <div className="md:col-span-6 space-y-6">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono">
            Acceso sin Barreras
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            MyIP no requiere registro para escanear. Tu IP pública se detecta directamente desde tu navegador. Los resultados son reales, obtenidos de APIs de seguridad profesionales.
          </p>

          <div className="space-y-3.5">
            <div className="flex gap-3 items-start text-xs text-slate-500">
              <CheckCircle2 className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span><strong>Escaneo inmediato:</strong> Sin registro, sin email, sin contraseñas. Detecta tu IP y escanea en un clic.</span>
            </div>
            <div className="flex gap-3 items-start text-xs text-slate-500">
              <CheckCircle2 className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span><strong>3 escaneos gratis:</strong> Sin registrarte. Sin trucos. Sin datos personales.</span>
            </div>
            <div className="flex gap-3 items-start text-xs text-slate-500">
              <CheckCircle2 className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span><strong>Email opcional:</strong> Solo si quieres guardar tu historial de escaneos. Sin verificación falsa.</span>
            </div>
          </div>
        </div>

        {/* Explicación honesta de límites */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-slate-600">
            <Info className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">
              ¿Por qué hay límites?
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Cada escaneo consume recursos reales: consultas a APIs de seguridad (Shodan, AbuseIPDB, DNSBL), análisis de IA (Gemini/Grok) y ancho de banda. Los límites gratuitos protegen al servidor de abusos automatizados. Si necesitas más escaneos, crea una cuenta o adquiere Premium.
          </p>
        </div>
      </div>

      {/* Columna de acción */}
      <div className="md:col-span-6">
        {!user ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                Opciones de Acceso
              </h3>
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl text-xs flex gap-2 items-center">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 rounded-xl text-xs flex gap-2 items-center">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Opción 1: Acceso inmediato como invitado */}
              <div className="bg-indigo-50/30 border border-indigo-100/50 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-xs font-bold text-slate-700">Acceso Inmediato (Recomendado)</h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Escanea tu IP pública ahora mismo. Sin email, sin registro, sin datos personales. 3 escaneos gratuitos incluidos.
                </p>
                <button
                  type="button"
                  onClick={handleGuestAccess}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm font-mono uppercase tracking-wide"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Escanear Ahora como Invitado
                </button>
              </div>

              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-x-0 border-t border-slate-200" />
                <span className="relative bg-white px-3 text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">Opcional</span>
              </div>

              {/* Opción 2: Cuenta con email + contraseña (historial persistente) */}
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => { setMode('register'); setError(null); }}
                  className={`flex-1 text-[10px] font-mono uppercase tracking-wider font-bold py-2 rounded-lg transition ${mode === 'register' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>
                  Crear Cuenta
                </button>
                <button type="button" onClick={() => { setMode('login'); setError(null); }}
                  className={`flex-1 text-[10px] font-mono uppercase tracking-wider font-bold py-2 rounded-lg transition ${mode === 'login' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>
                  Ya Tengo Cuenta
                </button>
              </div>
              <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    {mode === 'register' ? 'Guardar Historial con tu Email' : 'Inicia Sesión'}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="ejemplo@correo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder="Contraseña (mínimo 8 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {mode === 'register' && password.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1 h-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className={`flex-1 rounded-full transition-colors ${i <= strengthScore ? strengthColor : 'bg-slate-100'}`} />
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`font-bold ${strengthScore >= 3 ? 'text-emerald-600' : strengthScore >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                          {strengthLabel}
                        </span>
                        {strengthFeedback && <span className="text-slate-400 italic">{strengthFeedback}</span>}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-450 italic">
                    {mode === 'register'
                      ? '* Tu contraseña se guarda cifrada. Nunca la compartimos.'
                      : '* Introduce tu email y contraseña para acceder a tu historial.'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : mode === 'register' ? (
                    'Crear Cuenta'
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 p-6 rounded-2xl text-center space-y-5 shadow-sm">
            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded font-bold">
                Sesión Activa
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-2">{user.email}</h3>
              <p className="text-xs text-slate-500">
                {user.isGuest ? 'Sesión de invitado — 3 escaneos gratuitos' : 'Cuenta registrada — Historial guardado'}
              </p>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl text-left space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>IP Asociada:</span>
                <span className="font-mono text-indigo-600 font-bold">{user.ipAddress}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Plan:</span>
                <span className={`font-bold ${user.isPremium ? 'text-amber-600' : 'text-slate-500'}`}>
                  {user.isPremium ? 'Premium 👑' : 'Gratuito'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Escaneos realizados:</span>
                <span className="font-mono text-slate-700 font-semibold">{user.scanCount}</span>
              </div>
              {user.isGuest && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Escaneos restantes:</span>
                  <span className="font-mono text-emerald-600 font-bold">{Math.max(0, 3 - (user.scanCount || 0))}</span>
                </div>
              )}
            </div>

            {/* PWA Install Button */}
            {canInstallPwa && onInstallPwa && (
              <button
                onClick={onInstallPwa}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 animate-pulse"
              >
                📲 Instalar App en este dispositivo
              </button>
            )}
            
            {/* Fallback if browser doesn't support auto-install prompt */}
            {!canInstallPwa && onInstallPwa && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-2">¿Quieres instalar la app?</p>
                <button
                  onClick={() => alert('Por favor, usa el menú de tu navegador (⋮) y selecciona "Instalar aplicación" o "Añadir a pantalla de inicio".')}
                  className="text-xs text-indigo-600 font-bold underline"
                >
                  Ver instrucciones manuales
                </button>
              </div>
            )}

            {/* Redeem Code Section - Only show if not premium */}
            {!user.isPremium && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> ¿Tienes un código Premium?
                </h4>
                <form onSubmit={handleRedeemCode} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Introduce tu código"
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="submit"
                    disabled={redeemLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition disabled:opacity-50"
                  >
                    {redeemLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Activar'}
                  </button>
                </form>
                {redeemMsg && (
                  <p className={`text-[10px] font-mono ${redeemMsgType === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {redeemMsg}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={onLogout}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 py-2.5 rounded-xl text-xs font-semibold transition"
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
