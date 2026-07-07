import React, { useState, useEffect } from 'react';
import { Shield, Scan, AlertTriangle, Users } from 'lucide-react';

interface KPI {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  color: string;
  bgColor: string;
}

const KPIS: KPI[] = [
  { icon: <Scan className="w-5 h-5" />, label: 'Escaneos realizados', value: 1248, suffix: '+', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { icon: <Shield className="w-5 h-5" />, label: 'IPs protegidas', value: 86, suffix: '', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { icon: <AlertTriangle className="w-5 h-5" />, label: 'Amenazas detectadas', value: 342, suffix: '', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { icon: <Users className="w-5 h-5" />, label: 'Usuarios activos', value: 156, suffix: '', color: 'text-slate-600', bgColor: 'bg-slate-50' },
];

export default function CommunityKPIs() {
  const [counts, setCounts] = useState(KPIS.map(() => 0));

  useEffect(() => {
    const duration = 1500;
    const steps = 30;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounts(KPIS.map(kpi => Math.round(kpi.value * eased)));
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto mt-8">
      {KPIS.map((kpi, i) => (
        <div
          key={kpi.label}
          className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 text-center shadow-sm hover:shadow-md transition-shadow"
        >
          <div className={`w-10 h-10 ${kpi.bgColor} rounded-xl flex items-center justify-center mx-auto mb-3 ${kpi.color}`}>
            {kpi.icon}
          </div>
          <p className={`text-2xl sm:text-3xl font-extrabold ${kpi.color} font-mono tracking-tight`}>
            {counts[i].toLocaleString('es-ES')}{kpi.suffix}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 uppercase tracking-wide">
            {kpi.label}
          </p>
        </div>
      ))}
    </div>
  );
}
