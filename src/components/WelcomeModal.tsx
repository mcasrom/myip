import React, { useState, useEffect } from 'react';
import { Shield, Eye, Bell, Lock, ArrowRight, X, Sparkles, Globe } from 'lucide-react';

interface WelcomeModalProps {
  onRegister: () => void;
  onDismiss: () => void;
}

const translations = {
  es: {
    welcome: 'Bienvenido a MyIP',
    title: 'Protege tu red en <highlight>3 pasos</highlight>',
    subtitle: 'Escanea tu IP, detecta puertos abiertos y recibe alertas de seguridad — todo gratis.',
    features: [
      { title: 'Escaneo IP', desc: 'Pública y privada' },
      { title: 'Puertos abiertos', desc: 'Detección en vivo' },
      { title: 'Alertas email', desc: 'Monitoreo 24/7' },
      { title: 'Privacidad', desc: 'Sin rastreo' }
    ],
    cta: 'Empezar gratis',
    secondary: 'Ya tengo cuenta · Explorar ahora',
    footer: 'Gratis para uso personal · Sin tarjeta de crédito'
  },
  en: {
    welcome: 'Welcome to MyIP',
    title: 'Protect your network in <highlight>3 steps</highlight>',
    subtitle: 'Scan your IP, detect open ports and receive security alerts — all for free.',
    features: [
      { title: 'IP Scan', desc: 'Public & private' },
      { title: 'Open Ports', desc: 'Live detection' },
      { title: 'Email Alerts', desc: '24/7 monitoring' },
      { title: 'Privacy', desc: 'Zero tracking' }
    ],
    cta: 'Get started free',
    secondary: 'Already have an account · Explore now',
    footer: 'Free for personal use · No credit card required'
  }
};

function detectLanguage(): 'es' | 'en' {
  const lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'es';
  return lang.startsWith('en') ? 'en' : 'es';
}

export default function WelcomeModal({ onRegister, onDismiss }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<'es' | 'en'>('es');

  useEffect(() => {
    setLang(detectLanguage());
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

  const t = translations[lang];
  const titleParts = t.title.split(/(<highlight>.*?<\/highlight>)/);

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
              {t.welcome}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white font-sans leading-tight">
            {titleParts.map((part, i) =>
              part.startsWith('<highlight>') ? (
                <span key={i} className="text-indigo-400">{part.replace(/<\/?highlight>/g, '')}</span>
              ) : (
                part
              )
            )}
          </h2>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            {t.subtitle}
          </p>

          {/* Floating icon decoration */}
          <div className="absolute -bottom-6 right-8 w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Features */}
        <div className="px-8 -mt-4 pb-8">
          <div className="grid grid-cols-2 gap-4">
            <Feature icon={<Globe className="w-4 h-4" />} title={t.features[0].title} desc={t.features[0].desc} />
            <Feature icon={<Eye className="w-4 h-4" />} title={t.features[1].title} desc={t.features[1].desc} />
            <Feature icon={<Bell className="w-4 h-4" />} title={t.features[2].title} desc={t.features[2].desc} />
            <Feature icon={<Lock className="w-4 h-4" />} title={t.features[3].title} desc={t.features[3].desc} />
          </div>

          {/* CTA */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleCTA}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30"
            >
              {t.cta} <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleDismiss}
              className="w-full text-slate-400 hover:text-slate-600 text-xs font-medium py-2 transition-colors"
            >
              {t.secondary}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-4">
            {t.footer}
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
