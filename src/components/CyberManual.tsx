import React, { useState, useEffect } from 'react';
import { Shield, Download, Calendar, Server, BookOpen, AlertTriangle, CheckCircle, FileText, Globe, Lock, Wifi, Activity, Eye, Terminal, Cpu } from 'lucide-react';

export default function CyberManual() {
  const [currentDate, setCurrentDate] = useState('');
  const [version] = useState('1.0.0');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);

  const handleDownload = () => {
    window.open('/api/manual/download', '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 print:p-0 print:max-w-none print:bg-white">
      {/* Floating Action Button (Screen Only) */}
      <div className="sticky top-4 z-40 flex justify-end mb-6 no-print">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-full font-bold transition-all shadow-lg shadow-emerald-900/50 hover:scale-105"
        >
          <Download className="w-4 h-4" /> Descargar Manual PDF
        </button>
      </div>

      {/* Document Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl print:bg-white print:border-none print:shadow-none">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-8 md:p-12 border-b border-indigo-500/30 print:bg-none print:border-b-2 print:border-black print:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 print:bg-slate-200 print:shadow-none">
              <Shield className="w-10 h-10 text-white print:text-slate-800" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1 print:text-slate-500">
                <FileText className="w-3 h-3" /> Documento Oficial SIEG
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 print:text-black">Manual de Ciberseguridad</h1>
              <p className="text-slate-400 text-sm md:text-base print:text-slate-600">Soberanía Digital, Diagnóstico de Red y Mitigación de Amenazas</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-6 mt-8 text-xs font-mono text-slate-500 print:text-slate-700 print:border-t print:border-slate-200 print:pt-4">
            <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /><span>Fecha: {currentDate}</span></div>
            <div className="flex items-center gap-2"><Server className="w-3.5 h-3.5" /><span>Versión: {version}</span></div>
            <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /><span>myip.viajeinteligencia.com</span></div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 md:p-12 space-y-12 print:p-6 print:space-y-8">
          
          {/* 1. Introduction & Philosophy */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 print:text-black">
              <BookOpen className="w-5 h-5 text-indigo-400 print:text-black" /> 1. Introducción y Filosofía
            </h2>
            <div className="space-y-4 text-slate-300 leading-relaxed print:text-black">
              <p>
                En la era de la hiperconectividad, cada usuario final es el guardián de su propia frontera digital. Sin embargo, la industria de la seguridad informática a menudo utiliza un lenguaje críptico y alarmista para vender soluciones costosas, asustando al usuario común en lugar de empoderarlo.
              </p>
              <p>
                <strong className="text-white print:text-black">MyIP</strong> nació con una misión transparente: democratizar el conocimiento de la infraestructura de red. Creemos firmemente que comprender qué es una dirección IP, por qué un puerto SSH expuesto es un riesgo o qué significa que un certificado SSL esté por vencer, debe ser de acceso libre, comprensible y amigable.
              </p>
              <div className="bg-indigo-500/10 border-l-4 border-indigo-500 p-4 rounded-r-lg print:bg-slate-50 print:border-slate-800">
                <p className="text-sm text-indigo-200 italic print:text-slate-700">
                  "La verdadera seguridad no reside en la oscuridad tecnológica, sino en el faro del conocimiento compartido." — M.Castillo, Fundador SIEG
                </p>
              </div>
            </div>
          </section>

          {/* 2. The 3 Pillars of Digital Sovereignty */}
          <section>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
              <Shield className="w-5 h-5 text-indigo-400 print:text-black" /> 2. Los 3 Pilares de la Soberanía Digital
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-4">
              <PillarCard 
                icon={<Eye className="w-6 h-6" />} 
                title="Visibilidad" 
                desc="No puedes proteger lo que no ves. El primer paso es conocer tu IP pública, tus puertos abiertos y tu reputación en internet."
              />
              <PillarCard 
                icon={<Lock className="w-6 h-6" />} 
                title="Control" 
                desc="Cerrar puertas innecesarias. Desactivar servicios obsoletos y asegurar que solo tú tienes la llave de tu red."
              />
              <PillarCard 
                icon={<Activity className="w-6 h-6" />} 
                title="Monitorización" 
                desc="La seguridad no es un estado, es un proceso. Vigilar cambios en tu red y recibir alertas ante nuevas amenazas."
              />
            </div>
          </section>

          {/* 3. Platform Tools Deep Dive */}
          <section>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
              <Terminal className="w-5 h-5 text-indigo-400 print:text-black" /> 3. Herramientas de la Plataforma MyIP
            </h2>
            <div className="space-y-4">
              <ToolDetail 
                icon={<Shield className="w-5 h-5" />} 
                title="Escaneo de IP Pública y Puertos TCP" 
                desc="Esta herramienta detecta automáticamente tu dirección IP externa y realiza un escaneo de los puertos TCP más críticos (21, 22, 80, 443, 3306, etc.)."
                useCase="Úsalo cuando notes lentitud en tu red o tras configurar un nuevo router para verificar que no hay servicios expuestos accidentalmente."
              />
              <ToolDetail 
                icon={<Globe className="w-5 h-5" />} 
                title="Radar de Amenazas Global" 
                desc="Visualización en tiempo real de los ataques bloqueados por nuestros sistemas y hotspots de actividad maliciosa a nivel mundial."
                useCase="Ideal para entender el volumen de ataques que ocurren cada segundo en internet y concienciar sobre la necesidad de firewalls."
              />
              <ToolDetail 
                icon={<Lock className="w-5 h-5" />} 
                title="Reputación de IP (DNSBL Check)" 
                desc="Consulta si tu dirección IP aparece en listas negras internacionales (Spamhaus, Barracuda, etc.) que podrían estar bloqueando tus correos o servicios."
                useCase="Fundamental si tus emails están llegando a Spam o si tu proveedor de internet te ha bloqueado el acceso a ciertos servicios."
              />
              <ToolDetail 
                icon={<Wifi className="w-5 h-5" />} 
                title="Análisis de Red Local y WiFi" 
                desc="Diagnóstico de la calidad de tu conexión, latencia y detección de dispositivos conectados a tu red local."
                useCase="Perfecto para detectar intrusos en tu WiFi o verificar si tu proveedor te está dando la velocidad contratada."
              />
            </div>
          </section>

          {/* 4. Incident Response Protocols */}
          <section>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
              <AlertTriangle className="w-5 h-5 text-amber-400 print:text-black" /> 4. Protocolos de Respuesta a Incidentes
            </h2>
            <div className="space-y-4">
              <IncidentCard 
                scenario="Escenario A: Puerto 22 (SSH) Abierto"
                risk="Riesgo: Fuerza bruta y acceso no autorizado a servidores."
                solution="Solución: Ve a la sección 'How-To' y busca 'Proteger SSH'. Cambia el puerto por defecto (ej. 2204), usa llaves SSH en lugar de contraseñas y desactiva el login por password en tu router/servidor."
              />
              <IncidentCard 
                scenario="Escenario B: IP en Lista Negra (Blacklist)"
                risk="Riesgo: Emails marcados como Spam o bloqueo de servicios."
                solution="Solución: 1. Escanea tus dispositivos con antivirus. 2. Reinicia tu router para obtener una nueva IP dinámica. 3. Si la IP es fija, solicita el 'delisting' en la web de la lista negra (ej. Spamhaus)."
              />
              <IncidentCard 
                scenario="Escenario C: Dispositivos Desconocidos en tu Red"
                risk="Riesgo: Vecinos robando WiFi o malware interno."
                solution="Solución: Usa el 'Análisis de Red Local'. Cambia la contraseña de tu WiFi a WPA2/WPA3, desactiva WPS y oculta el SSID si es posible. Actualiza el firmware del router."
              />
            </div>
          </section>

          {/* 5. Security Best Practices */}
          <section>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
              <CheckCircle className="w-5 h-5 text-emerald-400 print:text-black" /> 5. Buenas Prácticas de Seguridad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
              <PracticeItem text="Actualiza el firmware de tu Router periódicamente." />
              <PracticeItem text="Desactiva WPS (vulnerable a fuerza bruta rápida)." />
              <PracticeItem text="Usa DNS Seguro (DoH/DoT) para cifrar tu historial." />
              <PracticeItem text="Contraseñas únicas y 2FA en todos los servicios críticos." />
              <PracticeItem text="Realiza un escaneo MyIP mensual para verificar tu postura." />
              <PracticeItem text="Nunca expongas el puerto 3389 (RDP) a internet." />
            </div>
          </section>

        </div>

        {/* Footer */}
        <footer className="bg-slate-950 p-6 text-center border-t border-slate-800 print:bg-white print:border-t-2 print:border-black">
          <p className="text-sm text-slate-500 font-bold print:text-black">MyIP © 2026 SIEG | Privacy Tools</p>
          <p className="text-xs text-slate-600 mt-1 print:text-slate-700">https://myip.viajeinteligencia.com</p>
          <p className="text-xs text-slate-700 mt-2 print:text-slate-500">Documento de uso libre y educativo. Prohibida su venta.</p>
        </footer>
      </div>

      {/* Print Styles - Optimized for PDF */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white; color: black; font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          nav, footer { display: none !important; }
          
          /* Reset backgrounds and borders for clean print */
          .print\\:bg-white { background-color: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:border-b-2 { border-bottom-width: 2px; }
          .print\\:border-black { border-color: black; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:p-6 { padding: 1.5rem !important; }
          .print\\:grid-cols-2 { grid-template-columns: 1fr 1fr !important; }
          .print\\:grid-cols-3 { grid-template-columns: 1fr 1fr 1fr !important; }
          .print\\:space-y-8 > * + * { margin-top: 2rem !important; }
          
          /* Specific element styling for print */
          h1, h2, h3 { color: black !important; page-break-after: avoid; }
          p, li { color: #1a1a1a !important; }
          .print\\:bg-slate-50 { background-color: #f8fafc !important; }
          .print\\:bg-slate-200 { background-color: #e2e8f0 !important; }
          .print\\:text-slate-500 { color: #64748b !important; }
          .print\\:text-slate-600 { color: #475569 !important; }
          .print\\:text-slate-700 { color: #334155 !important; }
          .print\\:text-slate-800 { color: #1e293b !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          
          /* Avoid breaking cards */
          div { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function PillarCard({ icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-5 rounded-xl hover:border-indigo-500/50 transition-colors print:bg-white print:border-slate-300 print:shadow-none print:p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-indigo-400 print:text-black">{icon}</div>
        <h3 className="font-bold text-slate-100 print:text-black">{title}</h3>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed print:text-slate-700">{desc}</p>
    </div>
  );
}

function ToolDetail({ icon, title, desc, useCase }: { icon: any; title: string; desc: string; useCase: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-5 rounded-xl print:bg-white print:border-slate-300 print:shadow-none print:p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-indigo-400 print:text-black">{icon}</div>
        <h3 className="font-bold text-slate-100 print:text-black">{title}</h3>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-3 print:text-slate-700">{desc}</p>
      <div className="bg-indigo-500/10 p-3 rounded-lg print:bg-slate-50 print:border print:border-slate-200">
        <p className="text-xs text-indigo-300 font-semibold print:text-slate-800">💡 Cuándo usarlo:</p>
        <p className="text-xs text-indigo-200 mt-1 print:text-slate-700">{useCase}</p>
      </div>
    </div>
  );
}

function IncidentCard({ scenario, risk, solution }: { scenario: string; risk: string; solution: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-5 rounded-xl print:bg-white print:border-slate-300 print:p-4">
      <p className="font-bold text-slate-100 mb-1 print:text-black">{scenario}</p>
      <p className="text-sm text-rose-400 mb-2 print:text-rose-700"><strong>{risk}</strong></p>
      <p className="text-sm text-emerald-400 print:text-emerald-700"><strong>{solution}</strong></p>
    </div>
  );
}

function PracticeItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 items-start text-slate-300 print:text-black">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0 print:bg-black"></span>
      <span className="text-sm leading-relaxed">{text}</span>
    </div>
  );
}