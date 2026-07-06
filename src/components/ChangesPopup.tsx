import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ChangesPopupProps {
  changes: string[];
  onClose: () => void;
}

export default function ChangesPopup({ changes, onClose }: ChangesPopupProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-xl space-y-5 text-slate-800 animate-scale-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Cambios detectados
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Hemos detectado diferencias respecto a tu ultimo analisis:
        </p>

        <ul className="space-y-3">
          {changes.map((change, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                !
              </span>
              <p className="text-xs text-slate-700">{change}</p>
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
