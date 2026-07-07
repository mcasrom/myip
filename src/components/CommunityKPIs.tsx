import React, { useState, useEffect } from 'react';
import { Shield, Scan, AlertTriangle, Users } from 'lucide-react';

export default function CommunityKPIs() {
  const [data, setData] = useState({ totalScans: 0, totalUsers: 0, premiumUsers: 0, avgScore: 0 });
  const [counts, setCounts] = useState({ scans: 0, users: 0, threats: 0, premium: 0 });

  useEffect(() => {
    fetch('/api/stats/community')
      .then(r => r.json())
      .then(d => {
        setData(d);
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto mt-8">
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
