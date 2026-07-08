import React, { useState, useEffect } from 'react';
import { Activity, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface UserHealthChartProps {
  email: string;
}

export default function UserHealthChart({ email }: UserHealthChartProps) {
  const [data, setData] = useState({ green: 0, yellow: 0, red: 0, avgScore: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/stats/user?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [email]);

  if (loading || data.total === 0) return null;

  const total = data.green + data.yellow + data.red;
  const greenPct = total > 0 ? Math.round((data.green / total) * 100) : 0;
  const yellowPct = total > 0 ? Math.round((data.yellow / total) * 100) : 0;
  const redPct = total > 0 ? Math.round((data.red / total) * 100) : 0;

  const radius = 50;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const greenLen = (greenPct / 100) * circumference;
  const yellowLen = (yellowPct / 100) * circumference;
  const redLen = (redPct / 100) * circumference;

  const healthLabel = greenPct >= 70 ? 'Saludable' : greenPct >= 50 ? 'Moderado' : 'En Riesgo';
  const healthColor = greenPct >= 70 ? 'text-emerald-400' : greenPct >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden border border-indigo-900/50">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[60px] pointer-events-none" />
      
      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
            {greenLen > 0 && (
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#10b981" strokeWidth={strokeWidth}
                strokeDasharray={`${greenLen} ${circumference - greenLen}`}
                strokeDashoffset={0} strokeLinecap="round" />
            )}
            {yellowLen > 0 && (
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#f59e0b" strokeWidth={strokeWidth}
                strokeDasharray={`${yellowLen} ${circumference - yellowLen}`}
                strokeDashoffset={-greenLen} strokeLinecap="round" />
            )}
            {redLen > 0 && (
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#ef4444" strokeWidth={strokeWidth}
                strokeDasharray={`${redLen} ${circumference - redLen}`}
                strokeDashoffset={-(greenLen + yellowLen)} strokeLinecap="round" />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Activity className={`w-4 h-4 ${healthColor} mb-0.5`} />
            <p className={`text-xl font-extrabold ${healthColor} font-mono`}>{data.avgScore || '-'}</p>
            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">{healthLabel}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Tu Salud Digital
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {data.total} escaneos realizados
            </p>
          </div>

          <div className="space-y-2">
            <HealthBar label="Conexiones seguras" pct={greenPct} count={data.green} color="bg-emerald-500" textColor="text-emerald-400" icon={<CheckCircle className="w-3 h-3" />} />
            <HealthBar label="Riesgo moderado" pct={yellowPct} count={data.yellow} color="bg-amber-500" textColor="text-amber-400" icon={<AlertTriangle className="w-3 h-3" />} />
            <HealthBar label="Vulnerabilidades" pct={redPct} count={data.red} color="bg-red-500" textColor="text-red-400" icon={<AlertTriangle className="w-3 h-3" />} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthBar({ label, pct, count, color, textColor, icon }: { label: string; pct: number; count: number; color: string; textColor: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`${textColor} flex-shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-slate-300 truncate">{label}</span>
          <span className={`text-[10px] font-bold font-mono ${textColor} ml-2`}>{pct}%</span>
        </div>
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[9px] text-slate-500 font-mono w-5 text-right">{count}</span>
    </div>
  );
}
