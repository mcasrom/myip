import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface TrafficLightProps {
  score: 'green' | 'yellow' | 'red';
}

export default function TrafficLight({ score }: TrafficLightProps) {
  return (
    <div className="flex flex-col items-center justify-center bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
      <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4 font-mono">
        Estado de Salud Digital
      </h3>
      
      {/* Light Housing */}
      <div className="flex flex-row md:flex-col items-center justify-between gap-4 bg-slate-50 p-4 rounded-3xl md:rounded-full border border-slate-100 shadow-inner">
        {/* Red Light */}
        <div className="relative flex flex-col items-center justify-center">
          <div 
            className={`w-12 h-12 rounded-full transition-all duration-500 border flex items-center justify-center ${
              score === 'red' 
                ? 'bg-red-500 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                : 'bg-slate-100 border-slate-200/60 opacity-30'
            }`}
          >
            <ShieldX className={`w-6 h-6 ${score === 'red' ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <span className={`text-[10px] font-bold mt-1.5 uppercase ${score === 'red' ? 'text-red-600' : 'text-slate-400'}`}>
            Crítico
          </span>
        </div>

        {/* Yellow Light */}
        <div className="relative flex flex-col items-center justify-center">
          <div 
            className={`w-12 h-12 rounded-full transition-all duration-500 border flex items-center justify-center ${
              score === 'yellow' 
                ? 'bg-amber-500 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]' 
                : 'bg-slate-100 border-slate-200/60 opacity-30'
            }`}
          >
            <ShieldAlert className={`w-6 h-6 ${score === 'yellow' ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <span className={`text-[10px] font-bold mt-1.5 uppercase ${score === 'yellow' ? 'text-amber-600' : 'text-slate-400'}`}>
            Advertencia
          </span>
        </div>

        {/* Green Light */}
        <div className="relative flex flex-col items-center justify-center">
          <div 
            className={`w-12 h-12 rounded-full transition-all duration-500 border flex items-center justify-center ${
              score === 'green' 
                ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
                : 'bg-slate-100 border-slate-200/60 opacity-30'
            }`}
          >
            <ShieldCheck className={`w-6 h-6 ${score === 'green' ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <span className={`text-[10px] font-bold mt-1.5 uppercase ${score === 'green' ? 'text-emerald-600' : 'text-slate-400'}`}>
            Protegido
          </span>
        </div>
      </div>

      <div className="mt-5 text-center w-full">
        {score === 'red' && (
          <p className="text-xs text-red-700 font-medium bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
            Riesgo Elevado: Puertos Críticos Expuestos o Reportado en Listas Negras.
          </p>
        )}
        {score === 'yellow' && (
          <p className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
            Riesgo Medio: Servicios no cifrados activos en tu IP.
          </p>
        )}
        {score === 'green' && (
          <p className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
            Conexión Segura: Sin vulnerabilidades públicas expuestas.
          </p>
        )}
      </div>
    </div>
  );
}
