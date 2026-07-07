import React, { useState } from 'react';
import { Download, Upload, Terminal, Shield, AlertTriangle, CheckCircle, FileText, Monitor, Network, Globe } from 'lucide-react';

interface Device {
  ip: string;
  mac: string;
  type: string;
}

interface Port {
  proto: string;
  local: string;
  state: string;
}

export default function NetworkAgent() {
  const [log, setLog] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setLog(text);
      parseLog(text);
    };
    reader.readAsText(file);
  };

  const parseLog = (text: string) => {
    const devs: Device[] = [];
    const pts: Port[] = [];

    // Parse ARP (Windows format: "  192.168.1.1   00-11-22-33-44-55     dynamic")
    const arpLines = text.split('\n').filter(l => l.match(/\d{1,3}(\.\d{1,3}){3}/) && (l.includes('dynamic') || l.includes('static') || l.match(/[0-9a-f]{2}[:-]/i)));
    arpLines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        devs.push({ ip: parts[0], mac: parts[1] || 'N/A', type: parts[2] || 'Desconocido' });
      }
    });

    // Parse Listening Ports (netstat format: "TCP  0.0.0.0:80  0.0.0.0:0  LISTENING")
    const portLines = text.split('\n').filter(l => l.includes('LISTEN') || l.includes('ESTABLISHED'));
    portLines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        pts.push({ proto: parts[0], local: parts[1], state: parts[parts.length - 1] });
      }
    });

    setDevices(devs.slice(0, 50)); // Limit display
    setPorts(pts.slice(0, 50));
  };

  const downloadScript = (os: 'win' | 'unix') => {
    const file = os === 'win' ? 'network_agent.bat' : 'network_agent.sh';
    const a = document.createElement('a');
    a.href = `/scripts/${file}`;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Network className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold">Network Agent — Inventario de Red Local</h2>
        </div>
        <p className="text-sm text-slate-300">
          Herramienta avanzada para usuarios técnicos. Ejecuta un diagnóstico local seguro y sube el reporte para visualizar tu topología de red.
        </p>
      </div>

      {/* Step 1: Download */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
          Descarga el agente para tu sistema
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => downloadScript('win')} className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Monitor className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">Windows (.bat)</p>
              <p className="text-[10px] text-slate-500">Doble clic para ejecutar</p>
            </div>
          </button>
          <button onClick={() => downloadScript('unix')} className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Terminal className="w-5 h-5 text-slate-700" />
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">Mac / Linux (.sh)</p>
              <p className="text-[10px] text-slate-500">chmod +x && ./network_agent.sh</p>
            </div>
          </button>
        </div>
      </div>

      {/* Step 2: Upload */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
          Sube el reporte generado
        </h3>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-2">Arrastra <code className="bg-slate-100 px-1 rounded">myip_raw_data.txt</code> aquí</p>
          <label className="inline-block bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-indigo-700">
            Seleccionar archivo
            <input type="file" accept=".txt" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        </div>
      </div>

      {/* Results */}
      {log && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" /> Dispositivos detectados ({devices.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {devices.map((d, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                    <span className="font-mono font-bold text-slate-700">{d.ip}</span>
                    <span className="text-[10px] text-slate-500">{d.mac}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Puertos escuchando ({ports.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {ports.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                    <span className="font-mono text-slate-700">{p.local}</span>
                    <span className="text-[10px] text-amber-600 font-bold">{p.state}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <details className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs font-mono">
            <summary className="cursor-pointer text-indigo-400 font-bold mb-2">Ver log completo</summary>
            <pre className="whitespace-pre-wrap break-all max-h-80 overflow-y-auto">{log}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
