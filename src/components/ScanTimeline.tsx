import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Shield, ShieldAlert } from 'lucide-react';

interface ScanRecord {
  id: number;
  targetIp: string;
  score: string;
  scoreReason: string;
  createdAt: number;
  portCount?: number;
  scanSource?: string;
}

interface ScanTimelineProps {
  scans: ScanRecord[];
  onScanClick: (id: number) => void;
}

const scoreConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  green: { color: 'text-emerald-600', bg: 'bg-emerald-500', icon: <Shield className="w-3 h-3 text-white" />, label: 'Seguro' },
  yellow: { color: 'text-amber-600', bg: 'bg-amber-500', icon: <AlertTriangle className="w-3 h-3 text-white" />, label: 'Precaución' },
  red: { color: 'text-red-600', bg: 'bg-red-500', icon: <ShieldAlert className="w-3 h-3 text-white" />, label: 'Riesgo' },
};

export default function ScanTimeline({ scans, onScanClick }: ScanTimelineProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!scans.length) return null;

  const formatDate = (ts: number) => {
    const ms = ts < 10000000000 ? ts * 1000 : ts;
    return new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
      <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
        Cronología de Escaneos
      </h5>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" />

        <div className="space-y-2">
          {scans.map((scan, i) => {
            const cfg = scoreConfig[scan.score.toLowerCase()] || scoreConfig.yellow;
            const isExpanded = expanded === scan.id;

            return (
              <div key={scan.id} className="relative pl-8">
                {/* Dot */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : scan.id)}
                  className={`absolute left-1.5 top-2 w-3.5 h-3.5 rounded-full ${cfg.bg} flex items-center justify-center ring-2 ring-white hover:scale-125 transition-transform z-10`}
                >
                  {cfg.icon}
                </button>

                {/* Card */}
                <button
                  onClick={() => onScanClick(scan.id)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-left hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full ${cfg.bg} flex-shrink-0`} />
                      <span className="text-xs font-mono font-bold text-slate-700 truncate">{scan.targetIp}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-slate-400">{formatDate(scan.createdAt)}</span>
                      <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                      <p><span className="font-semibold text-slate-600">Estado:</span> <span className={cfg.color}>{cfg.label}</span></p>
                      <p><span className="font-semibold text-slate-600">Razón:</span> {scan.scoreReason || 'N/A'}</p>
                      <p><span className="font-semibold text-slate-600">Puertos:</span> {scan.portCount || 0} detectados</p>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
