import React from 'react';
import { Heart } from 'lucide-react';

interface SupportPanelProps {}

export default function SupportPanel(_props: SupportPanelProps) {
  return (
    <div id="support-section" className="space-y-8 text-slate-800">

      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-4">
          <Heart className="w-8 h-8 text-rose-400" />
          <div>
            <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Apoyo al Proyecto</span>
            <h2 className="text-xl sm:text-2xl font-bold font-sans">MyIP es ahora completamente gratuito</h2>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
          Todas las funciones de MyIP —incluyendo escaneo de puertos, monitoreo de red, alertas y
          generación de informes— están disponibles sin ningún costo. Ya no necesitas un plan premium
          ni suscripciones para acceder a la plataforma completa.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="max-w-lg mx-auto text-center space-y-5">
          <div className="w-14 h-14 bg-rose-50 border border-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-800">¿Te gusta MyIP?</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              MyIP se mantiene gracias a contribuciones voluntarias. Si esta herramienta te resulta
              útil en tu día a día, considera invitarme un café en Ko-fi. Tu apoyo ayuda a cubrir
              los costes de servidores, dominio y desarrollo continuo.
            </p>
          </div>

          <a
            href="https://ko-fi.com/m_castillo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all shadow-sm"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.026 11.822c.033 2.568 2.289 4.336 4.785 4.336h11.552c4.232 0 6.327-2.733 6.327-2.733s3.267-3.443 3.199-7.63zm-6.724 5.048c-.595 1.028-1.952 1.414-2.952 1.414H7.635c-.999 0-1.807-.386-1.807-.386s-.79-1.183-1.184-2.651c-.272-.994-.272-1.68-.272-1.68h12.315s.54 1.847-.54 3.303z" />
            </svg>
            Invítame un café en Ko-fi
          </a>

          <p className="text-xs text-slate-400 font-mono">
            Sin publicidad · Sin suscripciones · Código abierto
          </p>
        </div>
      </div>

    </div>
  );
}
