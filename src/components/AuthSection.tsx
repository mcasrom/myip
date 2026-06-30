import React, { useState } from 'react';
import { Mail, CheckCircle2, RefreshCw, KeyRound, AlertCircle, Info, ShieldCheck, Fingerprint, Sparkles } from 'lucide-react';

interface AuthSectionProps {
  user: any | null;
  onLoginSuccess: (user: any) => void;
  onLogout: () => void;
}

export default function AuthSection({ user, onLoginSuccess, onLogout }: AuthSectionProps) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // To show the demo simulated mailbox code on screen
  const [demoMailboxCode, setDemoMailboxCode] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Por favor introduce un correo electrónico válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al solicitar el código.');
      }

      setStep('verify');
      setSuccessMsg(data.message || 'Código generado de forma segura.');
      setDemoMailboxCode(data.demoVerificationCode);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      setError('Por favor introduce el código de 6 dígitos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Código incorrecto o caducado.');
      }

      onLoginSuccess(data.user);
      setSuccessMsg('Sesión iniciada con éxito. Tu IP ha sido vinculada.');
      setStep('request');
      setDemoMailboxCode(null);
    } catch (err: any) {
      setError(err.message || 'Error al verificar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

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
      setSuccessMsg(data.message || 'Acceso de invitado iniciado con éxito.');
      setStep('request');
      setDemoMailboxCode(null);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start text-slate-800">
      {/* Informative column */}
      <div className="md:col-span-6 space-y-6">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono">
            Acceso Directo Sin Contraseña
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            MyIP utiliza un modelo de autenticación sin contraseñas tradicionales para garantizar la máxima comodidad y protección del usuario.
          </p>

          <div className="space-y-3.5">
            <div className="flex gap-3 items-start text-xs text-slate-500">
              <CheckCircle2 className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span><strong>Registro de Baja Fricción:</strong> Inicia sesión al instante sin crear ni recordar contraseñas complejas. Solo necesitas tu correo electrónico.</span>
            </div>
            <div className="flex gap-3 items-start text-xs text-slate-500">
              <CheckCircle2 className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span><strong>Vinculación Inteligente de IP:</strong> Al ingresar, el sistema detecta de forma autónoma tu IP residencial/pública para asociarla a tu cuenta. Esto previene escaneos fraudulentos de terceros.</span>
            </div>
            <div className="flex gap-3 items-start text-xs text-slate-500">
              <CheckCircle2 className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span><strong>Seguridad Cero Cookies:</strong> Máximo respeto a la privacidad de tu historial de escaneos y alertas de seguridad en tiempo real.</span>
            </div>
          </div>
        </div>

        {/* Demo simulator box for usability */}
        {demoMailboxCode && (
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600">
              <Info className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                Buzón de Entrada Simulado
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hemos simulado el envío de un correo electrónico de seguridad a <strong className="text-slate-800">{email}</strong>. Copia el siguiente código de verificación de baja fricción:
            </p>
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-indigo-200">
              <span className="text-lg font-mono font-bold tracking-widest text-indigo-600">
                {demoMailboxCode}
              </span>
              <button 
                onClick={() => setVerificationCode(demoMailboxCode)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold shadow-sm"
              >
                Autocompletar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Auth action card */}
      <div className="md:col-span-6">
        {!user ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                {step === 'request' ? 'Identificarse o Registrarse' : 'Confirmar Código'}
              </h3>
              <KeyRound className="w-4 h-4 text-indigo-600" />
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
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {step === 'request' ? (
                <form onSubmit={handleRequestCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Introduce tu Correo Electrónico
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
                    <p className="text-[10px] text-slate-450 italic">
                      * No almacenamos contraseñas. Recibirás un código seguro de un solo uso en tu buzón.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Recibir Código Seguro'
                    )}
                  </button>

                  <div className="relative my-4 flex items-center justify-center">
                    <div className="absolute inset-x-0 border-t border-slate-200" />
                    <span className="relative bg-white px-3 text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">O también</span>
                  </div>

                  <div className="bg-indigo-50/30 border border-indigo-100/50 p-4 rounded-xl text-center space-y-2.5">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      ¿Prefieres no usar tu correo electrónico? Accede de forma 100% privada e instantánea como un invitado.
                    </p>
                    <button
                      type="button"
                      onClick={handleGuestLogin}
                      disabled={loading}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm font-mono uppercase tracking-wide"
                    >
                      <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                      Entrar como Invitado (Sin Email)
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Código de Verificación (6 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 tracking-widest text-center font-mono font-bold text-lg"
                    />
                    <p className="text-[10px] text-slate-450 italic">
                      Introducido para validar tu identidad y enlazar tu IP actual.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('request');
                        setDemoMailboxCode(null);
                        setError(null);
                      }}
                      className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 py-3 rounded-xl text-xs font-semibold transition"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        'Verificar & Entrar'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 p-6 rounded-2xl text-center space-y-5 shadow-sm">
            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded font-bold">
                Sesión Iniciada
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-2">{user.email}</h3>
              <p className="text-xs text-slate-500">Tu cuenta está vinculada a la IP pública de conexión.</p>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl text-left space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>IP Asociada:</span>
                <span className="font-mono text-indigo-600 font-bold">{user.ipAddress}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Rango de Licencia:</span>
                <span className={`font-bold ${user.isPremium ? 'text-amber-600' : 'text-slate-500'}`}>
                  {user.isPremium ? 'Plan Premium 👑' : 'Plan Gratuito 🛡️'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Historial de Diagnósticos:</span>
                <span className="font-mono text-slate-700 font-semibold">{user.scanCount} escaneos</span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 py-2.5 rounded-xl text-xs font-semibold transition"
            >
              Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
