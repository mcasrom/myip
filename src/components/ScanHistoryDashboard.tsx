import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  AlertTriangle,
  ShieldAlert,
  Calendar,
  Network,
  ArrowRight,
  Loader2,
  FileDown,
  Send,
  Bot,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface ScanRecord {
  id: number;
  targetIp: string;
  score: string;
  scoreReason: string;
  createdAt: number;
  portCount: number;
  scanSource: string;
  scoreNumeric?: number;
}

interface ComparisonData {
  current: ScanRecord | null;
  previous: ScanRecord | null;
  scoreDiff: number;
  portDiff: number;
  improved: boolean;
}

const scoreConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  green: { color: 'text-emerald-600', bg: 'bg-emerald-500', icon: <Shield className="w-3 h-3 text-white" />, label: 'Seguro' },
  yellow: { color: 'text-amber-600', bg: 'bg-amber-500', icon: <AlertTriangle className="w-3 h-3 text-white" />, label: 'Precaucion' },
  red: { color: 'text-red-600', bg: 'bg-red-500', icon: <ShieldAlert className="w-3 h-3 text-white" />, label: 'Riesgo' },
};

function scoreToNumeric(score: string): number {
  switch (score.toLowerCase()) {
    case 'green': return 85;
    case 'yellow': return 50;
    case 'red': return 20;
    default: return 50;
  }
}

function formatDate(ts: number): string {
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  return new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(ts: number): string {
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export default function ScanHistoryDashboard() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/scan/dashboard', { credentials: 'include' });
        const data = await res.json();
        if (data.history) {
          const sorted = data.history
            .map((h: any) => ({
              ...h,
              scoreNumeric: h.scoreNumeric ?? scoreToNumeric(h.score),
            }))
            .sort((a: ScanRecord, b: ScanRecord) => a.createdAt - b.createdAt);
          setScans(sorted);
        } else if (data.error) {
          setError(data.error);
        }
      } catch {
        setError('No se pudo cargar el historial.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        <span className="ml-2 text-sm text-slate-500">Cargando historial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-sm text-amber-700">{error}</p>
        <p className="text-xs text-amber-600 mt-1">Realiza un escaneo para ver tu historial aqui.</p>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
        <Network className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-bold">Sin escaneos registrados</p>
        <p className="text-xs text-slate-400 mt-1">Realiza tu primer escaneo para empezar a ver tu evolucion.</p>
      </div>
    );
  }

  const comparison: ComparisonData = scans.length >= 2
    ? {
        current: scans[scans.length - 1],
        previous: scans[scans.length - 2],
        scoreDiff: (scans[scans.length - 1].scoreNumeric ?? 0) - (scans[scans.length - 2].scoreNumeric ?? 0),
        portDiff: scans[scans.length - 1].portCount - scans[scans.length - 2].portCount,
        improved: (scans[scans.length - 1].scoreNumeric ?? 0) >= (scans[scans.length - 2].scoreNumeric ?? 0),
      }
    : { current: scans[0], previous: null, scoreDiff: 0, portDiff: 0, improved: true };

  const chartData = scans.map(s => ({
    date: formatDate(s.createdAt),
    time: formatTime(s.createdAt),
    score: s.scoreNumeric ?? scoreToNumeric(s.score),
    ports: s.portCount,
    ip: s.targetIp,
    scoreLabel: s.score,
  }));

  const avgScore = Math.round(scans.reduce((sum, s) => sum + (s.scoreNumeric ?? scoreToNumeric(s.score)), 0) / scans.length);
  const totalScans = scans.length;
  const lastScan = scans[scans.length - 1];

  const exportPdf = async () => {
    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        window.alert(d.error || 'No se pudo exportar el PDF.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Informe_MyIP_' + lastScan.targetIp + '.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('No se pudo exportar el PDF.');
    }
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading || !lastScan) return;
    const next = [...chatMsgs, { role: 'user' as const, content: q }];
    setChatMsgs(next);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: lastScan.id, question: q, history: chatMsgs }),
      });
      const d = await res.json();
      setChatMsgs([...next, { role: 'assistant', content: d.answer || 'Sin respuesta.' }]);
    } catch {
      setChatMsgs([...next, { role: 'assistant', content: 'No se pudo conectar con el analista. Inténtalo de nuevo.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-mono tracking-widest text-slate-500 uppercase font-bold">Tu historial de seguridad</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Bot className="w-4 h-4" /> {chatOpen ? 'Cerrar analista' : 'Preguntar a tu analista'}
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Asistente conversacional (sobre el último scan) */}
      {chatOpen && lastScan && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-900 text-white">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Tu analista de seguridad</span>
            <span className="ml-auto text-[10px] text-slate-400 font-mono">Scan #{lastScan.id} · {lastScan.targetIp}</span>
          </div>
          <div className="h-64 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {chatMsgs.length === 0 && (
              <p className="text-xs text-slate-400 text-center pt-16">
                Pregunta sobre tu último escaneo. Ej: "¿Qué puerto debo vigilar primero?" o "¿Qué significa mi score?"
              </p>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                  <MarkdownRenderer content={m.content} />
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-400 inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Analizando tu escaneo...
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 p-3 border-t border-slate-200">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
              placeholder="Pregunta sobre tu escaneo..."
              className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
            >
              <Send className="w-3.5 h-3.5" /> Enviar
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Shield className="w-4 h-4" />}
          label="Score Promedio"
          value={`${avgScore}/100`}
          color="text-indigo-600"
        />
        <StatCard
          icon={<Calendar className="w-4 h-4" />}
          label="Total Escaneos"
          value={totalScans.toString()}
          color="text-slate-600"
        />
        <StatCard
          icon={<Network className="w-4 h-4" />}
          label="Ultimo Score"
          value={`${lastScan.scoreNumeric ?? scoreToNumeric(lastScan.score)}/100`}
          color={lastScan.score === 'green' ? 'text-emerald-600' : lastScan.score === 'yellow' ? 'text-amber-600' : 'text-red-600'}
        />
        <StatCard
          icon={comparison.scoreDiff > 0 ? <TrendingUp className="w-4 h-4" /> : comparison.scoreDiff < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          label="Tendencia"
          value={comparison.scoreDiff > 0 ? `+${comparison.scoreDiff}` : comparison.scoreDiff.toString()}
          color={comparison.scoreDiff > 0 ? 'text-emerald-600' : comparison.scoreDiff < 0 ? 'text-red-600' : 'text-slate-600'}
        />
      </div>

      {/* Comparison Card */}
      {comparison.previous && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500" /> Comparativa Ultimo Escaneo
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Anterior</p>
              <p className="text-lg font-bold text-slate-700">{comparison.previous.scoreNumeric ?? scoreToNumeric(comparison.previous.score)}/100</p>
              <p className="text-[10px] text-slate-500">{formatDate(comparison.previous.createdAt)} · {comparison.previous.portCount} puertos</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Actual</p>
              <p className="text-lg font-bold text-slate-700">{comparison.current?.scoreNumeric ?? scoreToNumeric(comparison.current?.score || 'yellow')}/100</p>
              <p className="text-[10px] text-slate-500">{formatDate(comparison.current?.createdAt || 0)} · {comparison.current?.portCount} puertos</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {comparison.improved ? (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Mejoro {Math.abs(comparison.scoreDiff)} puntos
              </span>
            ) : (
              <span className="text-xs text-red-600 font-bold flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Empeoro {Math.abs(comparison.scoreDiff)} puntos
              </span>
            )}
            {comparison.portDiff !== 0 && (
              <span className={`text-xs font-bold ${comparison.portDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                · {comparison.portDiff > 0 ? '+' : ''}{comparison.portDiff} puertos
              </span>
            )}
          </div>
        </div>
      )}

      {/* Score Evolution Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Evolucion del Score
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value}/100`, 'Score']}
                labelFormatter={(label) => `Fecha: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#scoreGradient)"
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, fill: '#4f46e5' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono p-5 pb-3 flex items-center gap-2 border-b border-slate-100">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Historial Completo
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="text-left px-4 py-2 font-bold uppercase tracking-wider text-[10px]">Fecha</th>
                <th className="text-left px-4 py-2 font-bold uppercase tracking-wider text-[10px]">IP</th>
                <th className="text-center px-4 py-2 font-bold uppercase tracking-wider text-[10px]">Score</th>
                <th className="text-center px-4 py-2 font-bold uppercase tracking-wider text-[10px]">Puertos</th>
                <th className="text-left px-4 py-2 font-bold uppercase tracking-wider text-[10px]">Fuente</th>
              </tr>
            </thead>
            <tbody>
              {[...scans].reverse().map((scan) => {
                const cfg = scoreConfig[scan.score.toLowerCase()] || scoreConfig.yellow;
                return (
                  <tr key={scan.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatDate(scan.createdAt)}<br />
                      <span className="text-[10px] text-slate-400">{formatTime(scan.createdAt)}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{scan.targetIp}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} text-white`}>
                        {cfg.icon}
                        {scan.scoreNumeric ?? scoreToNumeric(scan.score)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600">{scan.portCount}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-[10px]">{scan.scanSource || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`flex items-center gap-2 mb-1 ${color}`}>
        {icon}
        <span className="text-[10px] text-slate-400 uppercase font-bold">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
