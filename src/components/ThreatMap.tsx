import React, { useEffect, useRef, useState } from 'react';
import { Shield, AlertTriangle, Globe, RefreshCw } from 'lucide-react';

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

    // Initialize map if not exists
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
      // Clear existing layers
      leafletMapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.CircleMarker) {
          leafletMapRef.current.removeLayer(layer);
        }
      });
    }

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
    <div className="space-y-4 h-full flex flex-col">
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
      <div className="flex-1 relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 min-h-[400px]">
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

      {/* Top Countries */}
      {data && (
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Top Países Atacantes
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
    </div>
  );
}
