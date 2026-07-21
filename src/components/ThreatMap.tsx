import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, AlertTriangle, Globe, RefreshCw, TrendingUp, Clock, Layers, Info, Play, Pause, SkipBack, SkipForward, Map as MapIcon, Thermometer } from 'lucide-react';

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

interface SnapshotEntry {
  file: string;
  data: ThreatData;
  mtime: number;
}

function Bar({ label, value, max, colorClass }: { key?: any; label: string; value: number; max: number; colorClass: string }) {
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

function KpiCard({ label, value, icon }: { key?: any; label: string; value: string | number; icon: React.ReactNode }) {
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

export default function ThreatMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const circleLayer = useRef<any[]>([]);
  const heatLayerRef = useRef<any>(null);
  const [data, setData] = useState<ThreatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'circles' | 'heat'>('circles');
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [snapIdx, setSnapIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<any>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const fetchData = useCallback(async () => {
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
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch('/api/threat/timeline');
      if (!res.ok) return;
      const json = await res.json();
      if (json.snapshots?.length) {
        setSnapshots(json.snapshots);
        setSnapIdx(json.snapshots.length - 1);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchSnapshots();
    const interval = setInterval(fetchData, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData, fetchSnapshots]);

  useEffect(() => {
    const evtSource = new EventSource('/api/threat/events');
    evtSource.onopen = () => setSseConnected(true);
    evtSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.updated) {
          fetchData();
          fetchSnapshots();
        }
      } catch {}
    };
    evtSource.onerror = () => setSseConnected(false);
    return () => evtSource.close();
  }, [fetchData, fetchSnapshots]);

  const clearLayers = () => {
    circleLayer.current.forEach(m => leafletMapRef.current?.removeLayer(m));
    circleLayer.current = [];
    if (heatLayerRef.current) {
      leafletMapRef.current?.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
  };

  const renderCircles = (d: ThreatData) => {
    clearLayers();
    if (!leafletMapRef.current) return;
    const getColor = (bans: number) => bans > 10 ? '#ff0000' : bans > 5 ? '#ff4400' : bans > 2 ? '#ff8800' : '#ffaa00';
    d.attackers.forEach((a: Attacker) => {
      if (!a.lat || !a.lon) return;
      const r = Math.max(4, Math.min(a.bans * 2, 20));
      const m = L.circleMarker([a.lat, a.lon], {
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
      circleLayer.current.push(m);
    });
  };

  const renderHeatmap = (d: ThreatData) => {
    clearLayers();
    if (!leafletMapRef.current || typeof L.heatLayer !== 'function') {
      console.warn('[ThreatMap] L.heatLayer no disponible');
      return;
    }
    const points = d.attackers
      .filter(a => a.lat && a.lon)
      .map(a => [a.lat, a.lon, Math.min(a.bans / 5, 1)]);
    if (points.length) {
      heatLayerRef.current = L.heatLayer(points, {
        radius: 30,
        blur: 20,
        maxZoom: 10,
        max: 1.0,
        gradient: { 0.3: '#00ff00', 0.5: '#ffaa00', 0.7: '#ff4400', 1.0: '#ff0000' }
      }).addTo(leafletMapRef.current);
      console.log(`[ThreatMap] Heatmap renderizado con ${points.length} puntos`);
    }
  };

  useEffect(() => {
    const d = snapIdx >= 0 && snapIdx < snapshots.length ? snapshots[snapIdx].data : data;
    if (!d || !mapRef.current) return;

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
    }

    setTimeout(() => leafletMapRef.current?.invalidateSize(), 100);

    if (viewMode === 'heat') renderHeatmap(d);
    else renderCircles(d);
  }, [data, snapshots, snapIdx, viewMode]);

  const toggleViewMode = () => setViewMode(v => v === 'circles' ? 'heat' : 'circles');

  const handlePlay = () => {
    if (playing) {
      setPlaying(false);
      clearInterval(timerRef.current);
    } else {
      setPlaying(true);
      timerRef.current = setInterval(() => {
        setSnapIdx(prev => {
          if (prev >= snapshots.length - 1) {
            clearInterval(timerRef.current);
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
  };

  const currentData = snapIdx >= 0 && snapIdx < snapshots.length ? snapshots[snapIdx].data : data;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-500" />
          <div>
            <h2 className="text-lg font-bold">Radar de Amenazas en Tiempo Real</h2>
            <p className="text-xs text-slate-400">Origen de ataques bloqueados por nuestro firewall (Fail2ban)</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          {sseConnected && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Conexión SSE activa" />}
          <div className="text-center">
            <p className="text-red-400 font-bold text-lg">{currentData?.total_ips || '-'}</p>
            <p className="text-slate-500">IPs Atacantes</p>
          </div>
          <div className="text-center">
            <p className="text-orange-400 font-bold text-lg">{currentData?.total_bans || '-'}</p>
            <p className="text-slate-500">Bloqueos Totales</p>
          </div>
          <button onClick={() => { fetchData(); fetchSnapshots(); }} className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={toggleViewMode} className={`p-2 rounded transition ${viewMode === 'heat' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`} title="Alternar visualización: círculos / heatmap">
            <Thermometer className="w-4 h-4" />
          </button>
        </div>
      </div>

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
        <div className="absolute bottom-3 left-3 z-[1000] flex gap-1">
          <span className={`px-2 py-1 rounded text-[10px] font-mono ${viewMode === 'circles' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Círculos</span>
          <span className={`px-2 py-1 rounded text-[10px] font-mono ${viewMode === 'heat' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Heatmap</span>
        </div>
      </div>

      {snapshots.length > 1 && (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setTimelineOpen(!timelineOpen)} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <Clock className="w-4 h-4" /> Timeline ({snapshots.length} snapshots)
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => setSnapIdx(0)} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700" title="Primero"><SkipBack className="w-3.5 h-3.5" /></button>
              <button onClick={handlePlay} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700" title={playing ? 'Pausar' : 'Reproducir'}>
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setSnapIdx(snapshots.length - 1)} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700" title="Último"><SkipForward className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {timelineOpen && (
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={snapshots.length - 1}
                value={snapIdx}
                onChange={e => setSnapIdx(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>{new Date(snapshots[0]?.mtime || 0).toLocaleDateString()}</span>
                <span>{snapIdx + 1} / {snapshots.length}</span>
                <span>{new Date(snapshots[snapIdx]?.mtime || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {currentData && (
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Top Países Atacantes
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {Object.entries(currentData.top_countries)
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

      <SecurityKpiPanel />
    </div>
  );
}

function SecurityKpiPanel() {
  const [kpis, setKpis] = useState<any>(null);
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
    const interval = setInterval(fetchKpis, 15 * 60 * 1000);
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

  const maxMonthly = Math.max(...kpis.monthly.map((m: any) => m.attacks), 1);
  const maxWeekly = Math.max(...kpis.weekly.map((w: any) => w.attacks), 1);
  const maxCountry = Math.max(...kpis.top_countries.map((c: any) => c.attacks), 1);
  const maxSubnet = Math.max(...kpis.top_subnets.map((s: any) => s.attacks), 1);
  const maxHourly = Math.max(...kpis.hourly.map((h: any) => h.attacks), 1);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Resumen Histórico
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Bloqueos totales" value={kpis.total_bans.toLocaleString()} icon={<Shield className="w-5 h-5" />} />
          <KpiCard label="IPs únicas" value={kpis.unique_ips.toLocaleString()} icon={<Globe className="w-5 h-5" />} />
          <KpiCard label="Eventos registrados" value={kpis.total_events.toLocaleString()} icon={<Layers className="w-5 h-5" />} />
          <KpiCard label="Periodo monitorizado" value={`${kpis.date_range.oldest.slice(0, 10)} → hoy`} icon={<Clock className="w-5 h-5" />} />
        </div>
        {kpis.data_gaps?.length > 0 && (
          <div className="mt-3 text-[11px] text-amber-400/80 bg-amber-950/30 border border-amber-900/40 rounded p-2 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Nota de transparencia: hubo un corte de recolección de datos entre el {kpis.data_gaps[0].from} y el {kpis.data_gaps[0].to}.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Ataques por Mes</h3>
          <div className="space-y-2">
            {kpis.monthly.map((m: any) => (
              <Bar key={m.month} label={m.month} value={m.attacks} max={maxMonthly} colorClass="bg-indigo-500" />
            ))}
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Ataques por Semana</h3>
          <div className="space-y-2">
            {kpis.weekly.map((w: any) => (
              <Bar key={w.week} label={w.week} value={w.attacks} max={maxWeekly} colorClass="bg-cyan-500" />
            ))}
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Top Países de Origen
          </h3>
          <div className="space-y-2">
            {kpis.top_countries.slice(0, 8).map((c: any) => (
              <Bar key={c.country_code} label={c.country} value={c.attacks} max={maxCountry} colorClass="bg-red-500" />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">El origen refleja la ubicación de la IP atacante.</p>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Redes Más Reincidentes
          </h3>
          <div className="space-y-2">
            {kpis.top_subnets.slice(0, 8).map((s: any) => (
              <Bar key={s.subnet} label={s.subnet} value={s.attacks} max={maxSubnet} colorClass="bg-orange-500" />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Agrupado por subred /24.</p>
        </div>
      </div>

      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Distribución Horaria (UTC)
        </h3>
        <div className="flex items-end gap-1 h-24">
          {kpis.hourly.map((h: any) => (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${h.hour}h: ${h.attacks}`}>
              <div className="w-full bg-teal-500 rounded-t" style={{ height: `${Math.max(4, (h.attacks / maxHourly) * 100)}%` }} />
              <span className="text-[9px] text-slate-500">{h.hour}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Duración Media de Bloqueo por Servicio</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.avg_ban_duration_minutes.map((j: any) => (
            <KpiCard key={j.jail} label={j.jail} value={`${(j.minutes / 60).toFixed(1)}h`} icon={<Shield className="w-5 h-5" />} />
          ))}
        </div>
      </div>
    </div>
  );
}
