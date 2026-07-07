import React, { useState } from 'react';
import { Network, Globe, Router, Monitor, Printer, Tv, Server, Shield, AlertTriangle, Clock, Play, Wifi, Lock } from 'lucide-react';

interface DiscoveredDevice {
  ip: string;
  type: 'router' | 'computer' | 'printer' | 'tv' | 'server' | 'unknown';
  status: 'online' | 'offline' | 'checking';
  latency?: number;
  services?: string[];
}

const DEMO_DEVICES: DiscoveredDevice[] = [
  { ip: '192.168.1.1', type: 'router', status: 'online', latency: 2, services: ['HTTP Admin', 'DNS'] },
  { ip: '192.168.1.15', type: 'computer', status: 'online', latency: 12, services: ['SMB', 'SSH'] },
  { ip: '192.168.1.20', type: 'printer', status: 'online', latency: 45, services: ['IPP', 'HTTP'] },
  { ip: '192.168.1.50', type: 'tv', status: 'online', latency: 8, services: ['DLNA', 'HTTP'] },
];

export default function NetworkMapper() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');

  const startDemoScan = async () => {
    setScanning(true);
    setProgress(0);
    setDevices([]);
    setStatus('Ejecutando demostración...');
    
    try {
      for (let i = 0; i <= 100; i += 5) {
        setProgress(i);
        await new Promise(r => setTimeout(r, 50));
      }

      setDevices(DEMO_DEVICES);
      setStatus('Escaneo de demostración completado.');
    } catch (error) {
      console.error("Scan error:", error);
      setStatus('Error durante el escaneo.');
    } finally {
      setScanning(false);
    }
  };

  const getIcon = (type: DiscoveredDevice['type']) => {
    switch (type) {
      case 'router': return <Router className="w-4 h-4" />;
      case 'computer': return <Monitor className="w-4 h-4" />;
      case 'printer': return <Printer className="w-4 h-4" />;
      case 'tv': return <Tv className="w-4 h-4" />;
      case 'server': return <Server className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Network className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold">Mapeador de Red Local</h2>
        </div>
        <p className="text-sm text-slate-300">
          Visualiza tu topología de red. El escaneo real requiere permisos avanzados (próximamente).
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Real Scan - Disabled/Future */}
          <button
            disabled
            className="bg-slate-100 text-slate-400 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed relative group"
          >
            <Lock className="w-4 h-4" />
            Escaneo Real (Próximamente)
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              <p className="font-bold mb-1">Requiere extensión o agente local</p>
              <p className="text-slate-400">Los navegadores bloquean el escaneo de red por seguridad. Estamos trabajando en una solución segura.</p>
            </div>
          </button>

          {/* Demo Scan - Active */}
          <button
            onClick={startDemoScan}
            disabled={scanning}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {scanning ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Modo Demo
          </button>
        </div>
        
        {scanning && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{status}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        
        {!scanning && status && (
          <div className="text-xs p-3 rounded-lg bg-slate-50 text-slate-600">
            {status}
          </div>
        )}
      </div>

      {/* Results */}
      {devices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fadeIn">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-indigo-500" /> Dispositivos detectados ({devices.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {devices.map((d) => (
              <div key={d.ip} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.type === 'router' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                  {getIcon(d.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-slate-700 truncate">{d.ip}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{d.type} · {d.latency}ms</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
