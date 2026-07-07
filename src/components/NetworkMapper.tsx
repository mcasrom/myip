import React, { useState, useEffect } from 'react';
import { Network, Globe, Router, Monitor, Printer, Tv, Server, Shield, AlertTriangle, Clock } from 'lucide-react';

interface DiscoveredDevice {
  ip: string;
  type: 'router' | 'computer' | 'printer' | 'tv' | 'server' | 'unknown';
  status: 'online' | 'offline' | 'checking';
  latency?: number;
  services?: string[];
}

const COMMON_IPS: Record<string, DiscoveredDevice['type']> = {
  '192.168.1.1': 'router',
  '192.168.0.1': 'router',
  '192.168.1.100': 'server',
  '192.168.0.100': 'server',
};

export default function NetworkMapper() {
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const detectLocalIp = () => {
    return new Promise<string | null>((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          const match = evt.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (match) {
            const ip = match[0];
            if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
              pc.close();
              resolve(ip);
              return;
            }
          }
        }
      };
      setTimeout(() => { pc.close(); resolve(null); }, 3000);
    });
  };

  const probeDevice = async (ip: string, type: DiscoveredDevice['type']): Promise<DiscoveredDevice> => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      
      await fetch(`http://${ip}`, { mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeout);
      
      const latency = Date.now() - start;
      const services: string[] = [];
      
      if (type === 'router') services.push('HTTP Admin', 'DNS');
      
      return { ip, type, status: 'online', latency, services };
    } catch {
      return { ip, type, status: 'offline' };
    }
  };

  const startScan = async () => {
    setScanning(true);
    setProgress(0);
    setDevices([]);
    
    const ip = await detectLocalIp();
    setLocalIp(ip);
    
    if (!ip) {
      setScanning(false);
      return;
    }
    
    const parts = ip.split('.');
    const subnet = parts.slice(0, 3).join('.');
    
    const targets: { ip: string; type: DiscoveredDevice['type'] }[] = [];
    
    // Router gateway
    targets.push({ ip: `${subnet}.1`, type: 'router' });
    
    // Common devices
    for (let i = 2; i <= 254; i++) {
      const targetIp = `${subnet}.${i}`;
      if (COMMON_IPS[targetIp]) {
        targets.push({ ip: targetIp, type: COMMON_IPS[targetIp] });
      }
    }
    
    // Scan first 20 IPs in subnet for demo
    for (let i = 2; i <= 20; i++) {
      targets.push({ ip: `${subnet}.${i}`, type: 'unknown' });
    }
    
    const results: DiscoveredDevice[] = [];
    for (let i = 0; i < targets.length; i++) {
      setProgress(Math.round(((i + 1) / targets.length) * 100));
      const result = await probeDevice(targets[i].ip, targets[i].type);
      results.push(result);
    }
    
    setDevices(results.filter(d => d.status === 'online').sort((a, b) => (a.latency || 9999) - (b.latency || 9999)));
    setScanning(false);
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
          Descubre automáticamente los dispositivos conectados a tu red WiFi/Ethernet. 100% en tu navegador, sin descargas.
        </p>
      </div>

      {/* Scan Button */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <button
          onClick={startScan}
          disabled={scanning}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-xl transition-colors flex items-center gap-2 mx-auto"
        >
          {scanning ? (
            <>
              <Clock className="w-4 h-4 animate-spin" /> Escaneando red local...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" /> Iniciar Escaneo de Red
            </>
          )}
        </button>
        
        {scanning && (
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
        
        {localIp && (
          <p className="text-xs text-slate-500">
            Tu IP local: <span className="font-mono font-bold text-indigo-600">{localIp}</span>
          </p>
        )}
      </div>

      {/* Results */}
      {devices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-indigo-500" /> Dispositivos detectados ({devices.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {devices.map((d, i) => (
              <div key={d.ip} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
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

      {devices.length === 0 && !scanning && localIp && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-amber-700">No se detectaron otros dispositivos online en tu red.</p>
          <p className="text-xs text-amber-600 mt-1">Esto es normal si tu navegador bloquea solicitudes a IPs locales.</p>
        </div>
      )}
    </div>
  );
}
