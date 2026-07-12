import React, { useEffect, useRef, useState } from 'react';
import { Shield, AlertTriangle, Globe, RefreshCw, TrendingUp, Clock, Layers, Info } from 'lucide-react';

// Leaflet is loaded via script tag in index.html
declare const L: any;

interface Attacker {
  ip: string;
  bans: number;
  country: string;
  city: string;
  isp: string;
  lat: number;
  lon: number;
}

interface ThreatData {
  generated: string;
  total_ips: number;
  total_bans: number;
  top_countries: Record<string, number>;
  attackers: Attacker[];
}

interface SecurityKpis {
  generated: string;
  total_events: number;
  total_bans: number;
  unique_ips: number;
  date_range: { oldest: string; newest: string };
  top_countries: { country_code: string; country: string; attacks: number }[];
  weekly: { week: string; attacks: number }[];
  monthly: { month: string; attacks: number }[];
  hourly: { hour: string; attacks: number }[];
  avg_ban_duration_minutes: { jail: string; minutes: number }[];
  top_subnets: { subnet: string; attacks: number; unique_ips: number }[];
  data_gaps: { from: string; to: string; note: string }[];
}

function Bar({ label, value, max, colorClass }: { label: string; value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-400 font-mono truncate">{label}</span>
      <div className="flex-1 bg-slate-800 rounded h-4 overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-slate-300 font-mono">{value}</span>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-800 p-3 rounded-lg flex items-center gap-3">
      <div className="text-indigo-400">{icon}</div>
      <div>
        <p className="text-lg font-bold text-white leading-none">{value}</p>
        <p className="text-[11px] text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

function SecurityKpiPanel() {
  const [kpis, setKpis] = useState<SecurityKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = async () => {
    try {
      const res = await fetch('/api/security/kpis');
      if (!res.ok) throw new Error('Error cargando KPIs de seguridad');
      const json = await res.json();
      setKpis(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 15 * 60 * 1000); // 15 min
    return () => clearInterval(interval);
  }, []);

  if (loading && !kpis) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin mr-2" />
        <span className="text-slate-400 text-sm">Cargando KPIs de seguridad...</span>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-red-400 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error || 'Sin datos disponibles'}
      </div>
    );
  }

  const maxMonthly = Math.max(...kpis.monthly.map(m => m.attacks), 1);
  const maxWeekly = Math.max(...kpis.weekly.map(w => w.attacks), 1);
  const maxCountry = Math.max(...kpis.top_countries.map(c => c.attacks), 1);
  const maxSubnet = Math.max(...kpis.top_subnets.map(s => s.attacks), 1);
  const maxHourly = Math.max(...kpis.hourly.map(h => h.attacks), 1);

  return (
    <div className="space-y-4">
      {/* Resumen global */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Resumen Histórico
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Bloqueos totales" value={kpis.total_bans.toLocaleString()} icon={<Shield className="w-5 h-5" />} />
          <KpiCard label="IPs únicas" value={kpis.unique_ips.toLocaleString()} icon={<Globe className="w-5 h-5" />} />
          <KpiCard label="Eventos registrados" value={kpis.total_events.toLocaleString()} icon={<Layers className="w-5 h-5" />} />
          <KpiCard
            label="Periodo monitorizado"
            value={`${kpis.date_range.oldest.slice(0, 10)} → hoy`}
            icon={<Clock className="w-5 h-5" />}
          />
        </div>
        {kpis.data_gaps.length > 0 && (
          <div className="mt-3 text-[11px] text-amber-400/80 bg-amber-950/30 border border-amber-900/40 rounded p-2 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Nota de transparencia: hubo un corte de recolección de datos entre el {kpis.data_gaps[0].from} y el {kpis.data_gaps[0].to}.
              No representa una bajada real de ataques, sino un fallo del sistema de monitorización ya corregido.
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Evolución mensual */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Ataques por Mes</h3>
          <div className="space-y-2">
            {kpis.monthly.map(m => (
              <Bar key={m.month} label={m.month} value={m.attacks} max={maxMonthly} colorClass="bg-indigo-500" />
            ))}
          </div>
        </div>

        {/* Evolución semanal */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Ataques por Semana</h3>
          <div className="space-y-2">
            {kpis.weekly.map(w => (
              <Bar key={w.week} label={w.week} value={w.attacks} max={maxWeekly} colorClass="bg-cyan-500" />
            ))}
          </div>
        </div>

        {/* Países (corregido, agrupado por country_code) */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Top Países de Origen
          </h3>
          <div className="space-y-2">
            {kpis.top_countries.slice(0, 8).map(c => (
              <Bar key={c.country_code} label={c.country} value={c.attacks} max={maxCountry} colorClass="bg-red-500" />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            El origen refleja la ubicación de la IP atacante, a menudo infraestructura cloud/VPS y no el país del atacante real.
          </p>
        </div>

        {/* Subredes reincidentes */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Redes Más Reincidentes
          </h3>
          <div className="space-y-2">
            {kpis.top_subnets.slice(0, 8).map(s => (
              <Bar key={s.subnet} label={s.subnet} value={s.attacks} max={maxSubnet} colorClass="bg-orange-500" />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Agrupado por subred /24 para identificar infraestructura de ataque concentrada, sin exponer IPs individuales.
          </p>
        </div>
      </div>

      {/* Distribución horaria */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Distribución Horaria (UTC)
        </h3>
        <div className="flex items-end gap-1 h-24">
          {kpis.hourly.map(h => (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${h.hour}h: ${h.attacks}`}>
              <div
                className="w-full bg-teal-500 rounded-t"
                style={{ height: `${Math.max(4, (h.attacks / maxHourly) * 100)}%` }}
              />
              <span className="text-[9px] text-slate-500">{h.hour}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Actividad distribuida a lo largo del día: patrón típico de ataques automatizados, no ligados a horario humano.
        </p>
      </div>

      {/* Duración media de ban */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Duración Media de Bloqueo por Servicio</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.avg_ban_duration_minutes.map(j => (
            <KpiCard
              key={j.jail}
              label={j.jail}
              value={`${(j.minutes / 60).toFixed(1)}h`}
              icon={<Shield className="w-5 h-5" />}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ThreatMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const [data, setData] = useState<ThreatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('https://status.viajeinteligencia.com/fail2ban-data.json');
      if (!res.ok) throw new Error('Error cargando datos');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15 * 60 * 1000); // 15 min
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!data || !mapRef.current) return;

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current, {
        center: [30, 10],
        zoom: 2,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18
      }).addTo(leafletMapRef.current);
    } else {
      leafletMapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.CircleMarker) {
          leafletMapRef.current.removeLayer(layer);
        }
      });
    }

    setTimeout(() => {
      leafletMapRef.current?.invalidateSize();
    }, 100);

    const getColor = (bans: number) => bans > 10 ? '#ff0000' : bans > 5 ? '#ff4400' : bans > 2 ? '#ff8800' : '#ffaa00';

    data.attackers.forEach((a: Attacker) => {
      if (!a.lat || !a.lon) return;
      const r = Math.max(4, Math.min(a.bans * 2, 20));
      L.circleMarker([a.lat, a.lon], {
        radius: r,
        color: getColor(a.bans),
        fillColor: getColor(a.bans),
        fillOpacity: 0.6,
        weight: 1,
        opacity: 0.8
      }).bindPopup(`
        <div style="font-family:monospace;color:#00d4aa;font-size:0.85rem">${a.ip}</div>
        <div style="font-size:0.75rem;margin-top:4px;color:#a0c8a0">${a.city}, ${a.country}</div>
        <div style="font-size:0.75rem;color:#a0c8a0">${a.isp || 'N/A'}</div>
        <div style="font-size:0.75rem;color:#ff4444;font-weight:bold">${a.bans} ban(s)</div>
      `).addTo(leafletMapRef.current);
    });

  }, [data]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-500" />
          <div>
            <h2 className="text-lg font-bold">Radar de Amenazas en Tiempo Real</h2>
            <p className="text-xs text-slate-400">Origen de ataques bloqueados por nuestro firewall (Fail2ban)</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-center">
            <p className="text-red-400 font-bold text-lg">{data?.total_ips || '-'}</p>
            <p className="text-slate-500">IPs Atacantes</p>
          </div>
          <div className="text-center">
            <p className="text-orange-400 font-bold text-lg">{data?.total_bans || '-'}</p>
            <p className="text-slate-500">Bloqueos Totales</p>
          </div>
          <button onClick={fetchData} className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800" style={{ height: '500px' }}>
        {loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Cargando mapa de amenazas...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50">
            <div className="text-center text-red-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Top Countries (mapa en vivo, pipeline parcial) */}
      {data && (
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Top Países Atacantes (ventana reciente)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {Object.entries(data.top_countries)
              .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
              .slice(0, 12)
              .map(([country, count]) => (
                <div key={country} className="bg-slate-800 p-2 rounded text-center">
                  <p className="text-xs text-slate-400 truncate">{country}</p>
                  <p className="text-sm font-bold text-red-400">{count}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* KPIs históricos de alto valor (fuente completa: SQLite events + geo_cache) */}
      <SecurityKpiPanel />
    </div>
  );
}
