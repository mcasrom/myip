import React, { useState } from 'react';
import { guides, castilloManifesto } from '../data/guides';
import { BookOpen, Search, ShieldAlert, CheckCircle2, ChevronRight, ChevronDown, User, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function HowToGuides() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Todos');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);

  const filteredGuides = guides.filter(guide => {
    const matchesSearch = guide.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          guide.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          guide.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty = selectedDifficulty === 'Todos' || guide.difficulty === selectedDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  const toggleGuide = (id: string) => {
    if (expandedGuideId === id) {
      setExpandedGuideId(null);
    } else {
      setExpandedGuideId(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
            <BookOpen className="w-10 h-10" />
          </div>
          <div>
            <span className="text-xs font-mono tracking-widest text-indigo-400 uppercase font-semibold">Biblioteca Educativa</span>
            <h2 className="text-2xl font-bold mt-1">
              Guías de Mitigación y Cerrado de Puertos
            </h2>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Aprende paso a paso cómo cerrar puertos abiertos, ocultar tu dirección IP de origen tras Cloudflare y configurar firewalls domésticos de forma sencilla, comprensible y sin tecnicismos excesivos.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar guías (ej. SSH, Cloudflare, Firewall...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Difficulty Filter */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {['Todos', 'Fácil', 'Medio', 'Avanzado'].map((diff) => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(diff)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedDifficulty === diff
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion Guide List */}
      <div className="space-y-4">
        {filteredGuides.length > 0 ? (
          filteredGuides.map((guide) => {
            const isExpanded = expandedGuideId === guide.id;
            return (
              <div 
                key={guide.id} 
                className={`bg-white border transition-all rounded-xl overflow-hidden ${
                  isExpanded ? 'border-indigo-400 shadow-md' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleGuide(guide.id)}
                  className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex-1 space-y-1.5 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded font-bold">
                        {guide.category}
                      </span>
                      <span className={`text-[10px] font-mono tracking-wider px-2.5 py-0.5 rounded font-bold ${
                        guide.difficulty === 'Fácil' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' :
                        guide.difficulty === 'Medio' ? 'text-amber-700 bg-amber-50 border border-amber-100' :
                        'text-rose-700 bg-rose-50 border border-rose-100'
                      }`}>
                        Dificultad: {guide.difficulty}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800">
                      {guide.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {guide.description}
                    </p>
                  </div>
                  <div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Accordion Content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-5 text-sm leading-relaxed text-slate-600">
                        {/* Summary */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <p className="text-xs text-slate-500 uppercase font-mono tracking-wider mb-1.5 flex items-center gap-1.5 font-bold">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> ¿Por qué es un riesgo?
                          </p>
                          <p className="text-slate-600 leading-relaxed">{guide.description}</p>
                        </div>

                        {/* Step-by-Step Instructions */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Guía de Mitigación Paso a Paso
                          </h4>
                          <ol className="space-y-3 pl-1">
                            {guide.steps.map((step, idx) => {
                              // Replace bold markdown with html bold representation
                              const formattedStep = step.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                              return (
                                <li key={idx} className="flex gap-3">
                                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-slate-200 text-xs text-slate-600 font-mono font-bold shadow-sm">
                                    {idx + 1}
                                  </span>
                                  <div 
                                    className="text-slate-600 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: formattedStep }}
                                  />
                                </li>
                              );
                            })}
                          </ol>
                        </div>

                        {/* Professional tip */}
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3">
                          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-emerald-800">Recomendación del Experto</p>
                            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">{guide.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-sm text-slate-500">
              No se encontraron guías de seguridad que coincidan con la búsqueda.
            </p>
          </div>
        )}
      </div>

      {/* M. Castillo About & Filosofía section */}
      <div id="manifesto-section" className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">La Filosofía / About de {castilloManifesto.author}</h3>
              <p className="text-xs text-slate-500">{castilloManifesto.role}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 font-bold tracking-wider uppercase">Privacy Tools Project</span>
        </div>

        <div className="space-y-4 text-sm text-slate-600 leading-relaxed font-sans max-w-3xl">
          <h4 className="text-lg font-bold text-indigo-600 italic">
            &ldquo;{castilloManifesto.title}&rdquo;
          </h4>
          {castilloManifesto.paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-w-2xl italic text-slate-500 font-medium text-xs leading-relaxed">
          &ldquo;{castilloManifesto.quote}&rdquo;
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-100 pt-4">
          <p>M. Castillo - Privacy Tools &copy; 2026</p>
          <a href={`mailto:${castilloManifesto.contact}`} className="text-indigo-600 hover:underline font-bold font-mono">
            Contacto: {castilloManifesto.contact}
          </a>
        </div>
      </div>
    </div>
  );
}
