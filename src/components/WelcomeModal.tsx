import React, { useState, useEffect } from 'react';
import { Shield, Zap, Eye, Bell, Lock, ArrowRight, X, Sparkles, Globe, Wifi } from 'lucide-react';

interface WelcomeModalProps {
  onRegister: () => void;
  onDismiss: () => void;
}

export default function WelcomeModal({ onRegister, onDismiss }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('myip_welcome_dismissed');
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('myip_welcome_dismissed', '1');
    onDismiss();
  };

  const handleCTA = () => {
    handleDismiss();
    onRegister();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={handleDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-8 pt-8 pb-12">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">
              Bienvenido a MyIP
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white font-sans leading-tight">
            Protege tu red en <span className="text-indigo-400">3 pasos</span>
          </h2>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            Escanea tu IP, detecta puertos abiertos y recibe alertas de seguridad — todo gratis.
          </p>

          {/* Floating icon decoration */}
          <div className="absolute -bottom-6 right-8 w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Features */}
        <div className="px-8 -mt-4 pb-8">
          <div className="grid grid-cols-2 gap-4">
            <Feature icon={<Globe className="w-4 h-4" />} title="Escaneo IP" desc="Pública y privada" />
            <Feature icon={<Eye className="w-4 h-4" />} title="Puertos abiertos" desc="Detección en vivo" />
            <Feature icon={<Bell className="w-4 h-4" />} title="Alertas email" desc="Monitoreo 24/7" />
            <Feature icon={<Lock className="w-4 h-4" />} title="Privacidad" desc="Sin rastreo" />
          </div>

          {/* CTA */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleCTA}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30"
            >
              Empezar gratis <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleDismiss}
              className="w-full text-slate-400 hover:text-slate-600 text-xs font-medium py-2 transition-colors"
            >
              Ya tengo cuenta · Explorar ahora
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-4">
            Gratis para uso personal · Sin tarjeta de crédito
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out }
        .animate-slideUp { animation: slideUp 0.4s ease-out }
      `}</style>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700">{title}</p>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
