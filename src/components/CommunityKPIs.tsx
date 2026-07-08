import React, { useState, useEffect } from 'react';
import { Shield, Scan, AlertTriangle, Users, Activity } from 'lucide-react';

interface Distribution {
  green: number;
  yellow: number;
  red: number;
}

export default function CommunityKPIs() {
  const [data, setData] = useState({ totalScans: 0, totalUsers: 0, premiumUsers: 0, avgScore: 0, totalScored: 0 });
  const [counts, setCounts] = useState({ scans: 0, users: 0, threats: 0, premium: 0 });
  const [distribution, setDistribution] = useState<Distribution>({ green: 0, yellow: 0, red: 0 });

  useEffect(() => {
    fetch('/api/stats/community')
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.distribution) setDistribution(d.distribution);
        animateCounts(d.totalScans, d.totalUsers, d.totalScored, d.premiumUsers);
      })
      .catch(() => {});
  }, []);

  const animateCounts = (scans: number, users: number, threats: number, premium: number) => {
    const duration = 1500;
    const steps = 30;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounts({
        scans: Math.round(scans * eased),
        users: Math.round(users * eased),
        threats: Math.round(threats * eased),
        premium: Math.round(premium * eased),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  };

  const total = distribution.green + distribution.yellow + distribution.red;
  const greenPct = total > 0 ? Math.round((distribution.green / total) * 100) : 0;
  const yellowPct = total > 0 ? Math.round((distribution.yellow / total) * 100) : 0;
  const redPct = total > 0 ? Math.round((distribution.red / total) * 100) : 0;

  // SVG donut chart calculations
  const radius = 60;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const greenLen = (greenPct / 100) * circumference;
  const yellowLen = (yellowPct / 100) * circumference;
  const redLen = (redPct / 100) * circumference;
  const greenOffset = 0;
  const yellowOffset = -greenLen;
  const redOffset = -(greenLen + yellowLen);

  // Determine overall health label
  const healthLabel = greenPct >= 70 ? 'Saludable' : greenPct >= 50 ? 'Moderado' : 'En Riesgo';
  const healthColor = greenPct >= 70 ? 'text-emerald-400' : greenPct >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-8">
      {/* Original KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          icon={<Scan className="w-5 h-5" />}
          label="Escaneos realizados"
          value={counts.scans}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <KPICard
          icon={<Users className="w-5 h-5" />}
          label="Usuarios activos"
          value={counts.users}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <KPICard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Amenazas detectadas"
          value={counts.threats}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <KPICard
          icon={<Shield className="w-5 h-5" />}
          label="Usuarios Premium"
          value={counts.premium}
          color="text-slate-600"
          bgColor="bg-slate-50"
        />
      </div>

      {/* Community Health Donut Chart */}
      {total > 0 && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            {/* Donut Chart */}
            <div className="relative flex-shrink-0">
              <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                {/* Background circle */}
                <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
                {/* Green segment */}
                {greenLen > 0 && (
                  <circle cx="80" cy="80" r={radius} fill="none" stroke="#10b981" strokeWidth={strokeWidth}
                    strokeDasharray={`${greenLen} ${circumference - greenLen}`}
                    strokeDashoffset={greenOffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000" />
                )}
                {/* Yellow segment */}
                {yellowLen > 0 && (
                  <circle cx="80" cy="80" r={radius} fill="none" stroke="#f59e0b" strokeWidth={strokeWidth}
                    strokeDasharray={`${yellowLen} ${circumference - yellowLen}`}
                    strokeDashoffset={yellowOffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000" />
                )}
                {/* Red segment */}
                {redLen > 0 && (
                  <circle cx="80" cy="80" r={radius} fill="none" stroke="#ef4444" strokeWidth={strokeWidth}
                    strokeDasharray={`${redLen} ${circumference - redLen}`}
                    strokeDashoffset={redOffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000" />
                )}
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Activity className={`w-5 h-5 ${healthColor} mb-1`} />
                <p className={`text-2xl font-extrabold ${healthColor} font-mono`}>{data.avgScore || '-'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{healthLabel}</p>
              </div>
            </div>

            {/* Legend & Stats */}
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-indigo-300">
                  Salud Global de la Comunidad
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Distribución de {total.toLocaleString('es-ES')} escaneos analizados
                </p>
              </div>

              <div className="space-y-2.5">
                <HealthBar label="Conexiones seguras" pct={greenPct} count={distribution.green} color="bg-emerald-500" textColor="text-emerald-400" />
                <HealthBar label="Riesgo moderado" pct={yellowPct} count={distribution.yellow} color="bg-amber-500" textColor="text-amber-400" />
                <HealthBar label="Vulnerabilidades críticas" pct={redPct} count={distribution.red} color="bg-red-500" textColor="text-red-400" />
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Basado en {total} escaneos con puntuación. Score ≥70: seguro · 40-69: moderado · &lt;40: crítico.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, color, bgColor }: { icon: React.ReactNode; label: string; value: number; color: string; bgColor: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 text-center shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center mx-auto mb-3 ${color}`}>
        {icon}
      </div>
      <p className={`text-2xl sm:text-3xl font-extrabold ${color} font-mono tracking-tight`}>
        {value.toLocaleString('es-ES')}
      </p>
      <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

function HealthBar({ label, pct, count, color, textColor }: { label: string; pct: number; count: number; color: string; textColor: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-300 truncate">{label}</span>
          <span className={`text-xs font-bold font-mono ${textColor} ml-2`}>{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-slate-500 font-mono w-8 text-right">{count}</span>
    </div>
  );
}
