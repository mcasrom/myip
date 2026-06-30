import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share, PlusSquare, X } from 'lucide-react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Detect if already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone === true;

    if (isStandalone) {
      return; // No need to show installation banner if already installed!
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS users, we show a friendly installer button after 4 seconds
    if (isIosDevice) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 4000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Elección de instalación del usuario: ${outcome}`);
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4.5 rounded-2xl border border-indigo-500/20 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-3xl mx-auto animate-fade-in relative mb-6">
        <button 
          onClick={() => setShowBanner(false)}
          className="absolute top-2 right-2 text-slate-400 hover:text-white transition"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/30 border border-indigo-500/40 rounded-xl flex items-center justify-center text-indigo-400 flex-shrink-0 animate-pulse">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold font-sans flex items-center gap-1.5 text-indigo-200">
              📲 ¡Instala MyIP en tu Pantalla de Inicio!
            </h4>
            <p className="text-[11px] text-slate-300 leading-normal max-w-lg">
              Disfruta de MyIP como una app nativa en tu móvil o tablet. Acceso instantáneo, menor consumo de batería y sin barra de navegación.
            </p>
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 justify-center transition-all shadow-sm flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          {isIos ? 'Cómo Instalar en iOS' : 'Instalar App'}
        </button>
      </div>

      {/* iOS Installation Instruction Dialog Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-xl space-y-5 text-slate-800 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" /> Instalar en iPhone / iPad
              </h3>
              <button 
                onClick={() => setShowIosGuide(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Safari en iOS no permite la instalación automática directa, pero puedes añadir MyIP a tu pantalla de inicio de forma sencilla:
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p className="text-xs text-slate-700">
                  Pulsa el botón de <strong>Compartir</strong> (icono de un cuadrado con una flecha hacia arriba <Share className="w-3.5 h-3.5 inline text-indigo-600" />) en Safari.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p className="text-xs text-slate-700">
                  Desliza hacia abajo en el menú de opciones y selecciona <strong>"Añadir a la pantalla de inicio"</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-indigo-600" />).
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p className="text-xs text-slate-700">
                  Confirma pulsando <strong>"Añadir"</strong> en la esquina superior derecha. ¡Listo!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
