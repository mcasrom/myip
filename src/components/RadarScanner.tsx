import React from 'react';

interface RadarScannerProps {
  scanning: boolean;
  ip: string;
}

export default function RadarScanner({ scanning, ip }: RadarScannerProps) {
  return (
    <div className="relative flex flex-col items-center justify-center py-8">
      {/* Radar Container */}
      <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full border border-indigo-500/20 bg-slate-900 flex items-center justify-center overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.15)]">
        
        {/* Sweep effect */}
        {scanning && (
          <div className="absolute inset-0 origin-center animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_50%,rgba(99,102,241,0.2))] pointer-events-none" />
        )}

        {/* Concentric rings */}
        <div className="absolute w-4/5 h-4/5 rounded-full border border-indigo-500/10" />
        <div className="absolute w-3/5 h-3/5 rounded-full border border-indigo-500/10" />
        <div className="absolute w-2/5 h-2/5 rounded-full border border-indigo-500/10" />
        <div className="absolute w-1/5 h-1/5 rounded-full border border-indigo-500/20" />

        {/* Crosshair lines */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-indigo-500/15" />
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-indigo-500/15" />

        {/* Dynamic scanning dots */}
        {scanning ? (
          <>
            <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-amber-500 rounded-full animate-ping [animation-delay:1s]" />
            <div className="absolute top-1/2 right-1/3 w-3.5 h-3.5 bg-indigo-400 rounded-full animate-ping [animation-delay:1.8s]" />
          </>
        ) : (
          <div className="absolute w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_15px_#6366f1]" />
        )}

        {/* Display IP inside */}
        <div className="absolute flex flex-col items-center text-center px-4 bg-slate-950/90 backdrop-blur-md py-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
            {scanning ? 'Escaneando' : 'Host Detectado'}
          </span>
          <span className="text-sm font-mono font-bold text-indigo-400 mt-1">
            {ip || 'Detectando IP...'}
          </span>
        </div>
      </div>

      <div className="mt-6 text-center">
        {scanning ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-700 animate-pulse font-medium">
              Escaneando puertos críticos y listas negras de reputación...
            </p>
            <p className="text-xs text-slate-500 font-mono">
              Comprobando SSH (22), HTTP (80), HTTPS (443), MySQL (3306)
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            * El diagnóstico se realiza estrictamente en tu IP de conexión para evitar fraudes y uso malicioso contra terceros.
          </p>
        )}
      </div>
    </div>
  );
}
