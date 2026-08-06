import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, RefreshCw } from 'lucide-react';

interface SnapshotFile {
  name: string;
  path: string;
}

interface Attacker {
  ip: string;
  bans: number;
  country: string;
  city: string;
  isp: string;
  lat: number;
  lon: number;
}

interface SnapshotData {
  generated: string;
  total_ips: number;
  total_bans: number;
  top_countries: Record<string, number>;
  attackers: Attacker[];
}

export default function SnapshotTimeline() {
  const [snapshots, setSnapshots] = useState<SnapshotFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameDelay = 1500;

  useEffect(() => {
    fetch('/api/snapshots/list')
      .then(r => r.json())
      .then(json => {
        setSnapshots(json.snapshots || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadSnapshot = useCallback(async (idx: number) => {
    const file = snapshots[idx];
    if (!file) return;
    try {
      const r = await fetch(`/api/snapshots/data?file=${encodeURIComponent(file.name)}`);
      const json = await r.json();
      setData(json);
      setCurrentIndex(idx);
    } catch (e) {
      console.error('Error loading snapshot:', e);
    }
  }, [snapshots]);

  useEffect(() => {
    if (snapshots.length > 0) loadSnapshot(0);
  }, [snapshots, loadSnapshot]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          if (next >= snapshots.length) {
            setPlaying(false);
            return prev;
          }
          loadSnapshot(next);
          return next;
        });
      }, frameDelay);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, snapshots, loadSnapshot]);

  const handlePlayPause = () => setPlaying(!playing);

  const handleStep = (dir: number) => {
    const next = currentIndex + dir;
    if (next >= 0 && next < snapshots.length) loadSnapshot(next);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    loadSnapshot(idx);
  };

  if (loading) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin mr-2" />
        <span className="text-slate-400 text-sm">Cargando snapshots...</span>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center">
        <p className="text-slate-400 text-sm">No hay snapshots disponibles. Los nuevos se generan automáticamente cada hora.</p>
      </div>
    );
  }

  const pct = snapshots.length > 1 ? (currentIndex / (snapshots.length - 1)) * 100 : 0;
  const timeLabel = data?.generated ? new Date(data.generated).toLocaleString('es-ES') : '';

  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          Línea de Tiempo de Ataques
        </h3>
        <span className="text-[11px] text-slate-500 font-mono">
          {currentIndex + 1} / {snapshots.length}
        </span>
      </div>

      {/* Timeline slider */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={snapshots.length - 1}
          value={currentIndex}
          onChange={handleSeek}
          className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>{snapshots[0]?.name.slice(10, 19) || ''}</span>
          <span>{snapshots[snapshots.length - 1]?.name.slice(10, 19) || ''}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => handleStep(-1)} disabled={currentIndex === 0}
          className="p-2 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-30 transition">
          <SkipBack className="w-4 h-4" />
        </button>
        <button onClick={handlePlayPause}
          className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 transition shadow-lg">
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button onClick={() => handleStep(1)} disabled={currentIndex >= snapshots.length - 1}
          className="p-2 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-30 transition">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Data display */}
      {data && (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>{timeLabel}</span>
            <span>{data.total_ips} IPs · {data.total_bans} bloqueos</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Object.entries(data.top_countries || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([country, count]) => (
                <div key={country} className="bg-slate-800 p-2 rounded text-center">
                  <p className="text-[11px] text-slate-400 truncate">{country}</p>
                  <p className="text-sm font-bold text-red-400">{count}</p>
                </div>
              ))}
          </div>

          {data.attackers && data.attackers.length > 0 && (
            <div className="text-xs text-slate-500">
              Principales atacantes: {data.attackers.slice(0, 5).map(a => a.ip).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
