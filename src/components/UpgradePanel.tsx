import React, { useState } from 'react';
import { CreditCard, ShieldCheck, Mail, RefreshCw, Radio, BellRing, Sparkles, Check, Server, Building, Award } from 'lucide-react';

interface UpgradePanelProps {
  email: string;
  isPremium: boolean;
  onUpgradeSuccess: (user: any) => void;
  onSimulateAlert: () => void;
  onSendReport: (type: string) => void;
  reportSending: boolean;
  reportMessage: string | null;
}

export default function UpgradePanel({
  email,
  isPremium,
  onUpgradeSuccess,
  onSimulateAlert,
  onSendReport,
  reportSending,
  reportMessage
}: UpgradePanelProps) {
  const [selectedTier, setSelectedTier] = useState<'lifetime' | 'monthly' | 'whitelabel'>('lifetime');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState('');
  const [devEmail, setDevEmail] = useState('');
  const [devMsg, setDevMsg] = useState<string | null>(null);
  const [devMsgType, setDevMsgType] = useState<'success' | 'error'>('error');

  const handleDevCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devCode.trim()) { setDevMsg('Introduce un código.'); setDevMsgType('error'); return; }
    const useEmail = email || devEmail.trim();
    if (!useEmail) { setDevMsg('Introduce un email.'); setDevMsgType('error'); return; }
    try {
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: useEmail })
      });
      const regData = await regRes.json();
      if (!regRes.ok) { setDevMsg(regData.error); setDevMsgType('error'); return; }
      if (!email) onUpgradeSuccess(regData.user);
      const codeRes = await fetch('/api/premium/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: useEmail, code: devCode })
      });
      const codeData = await codeRes.json();
      if (!codeRes.ok) { setDevMsg(codeData.error); setDevMsgType('error'); return; }
      setDevMsg(codeData.message); setDevMsgType('success');
      onUpgradeSuccess(codeData.user);
    } catch { setDevMsg('Error de conexión.'); setDevMsgType('error'); }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    // Format card number with spaces every 4 digits
    const formatted = value.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    setExpiry(value);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 3) value = value.slice(0, 3);
    setCvc(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Debes iniciar sesión con tu correo electrónico para adquirir un plan de monetización.');
      return;
    }

    if (cardNumber.replace(/\s/g, '').length !== 16) {
      setError('Introduce un número de tarjeta de 16 dígitos válido.');
      return;
    }

    if (expiry.length < 5) {
      setError('Introduce una fecha de vencimiento válida (MM/AA).');
      return;
    }

    if (cvc.length < 3) {
      setError('Introduce un código CVC de 3 dígitos válido.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try to initiate a real Stripe Checkout Session if Stripe is configured
      const checkRes = await fetch('/api/premium/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tier: selectedTier })
      });
      
      const checkData = await checkRes.json();
      
      if (checkRes.ok && checkData.checkoutUrl) {
        // Stripe is configured! Redirect to the real Stripe Checkout page
        window.location.href = checkData.checkoutUrl;
        return;
      }

      // 2. Fall back to the simulated instant upgrade if Stripe is not configured
      const response = await fetch('/api/premium/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          cardNumber,
          expiry,
          cvc,
          tier: selectedTier
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error procesando el pago');
      }

      onUpgradeSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con la pasarela de pagos.');
    } finally {
      setLoading(false);
    }
  };

  // Pricing configuration for the selected tier
  const tiers = {
    lifetime: {
      name: 'Plan Hogar Permanente',
      price: '$9.99',
      billing: 'pago único',
      description: 'Protección para tu conexión personal y router doméstico.'
    },
    monthly: {
      name: 'Plan SysAdmin Pro',
      price: '$4.99',
      billing: 'mes (suscripción)',
      description: 'Monitoreo 24/7 y automatizaciones avanzadas de red.'
    },
    whitelabel: {
      name: 'Plan Consultor Marca Blanca',
      price: '$24.99',
      billing: 'pago único',
      description: 'Generación de informes ejecutivos con tu marca para clientes.'
    }
  };

  return (
    <div id="upgrade-plans-section" className="space-y-8 text-slate-800">
      
      {/* Monetization Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-8 h-8 text-amber-400" />
          <div>
            <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">Opciones de Monetización</span>
            <h2 className="text-xl sm:text-2xl font-bold font-sans">Planes de Alto Valor para Usuarios Finales & Administradores</h2>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
          Apoya el desarrollo de esta plataforma para costear servidores, dominio y energía. Elige el plan que mejor se adapte a tus necesidades de seguridad, auditoría y marca.
        </p>
      </div>

      {/* Developer access — code field is blank, no hints */}
      {!isPremium && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 font-mono">Acceso Desarrollador</h3>
          <form onSubmit={handleDevCode} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-4 space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400 font-bold">Email</label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email || devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                disabled={!!email}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-4 space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400 font-bold">Código</label>
              <input
                type="password"
                placeholder="Introduce tu código"
                value={devCode}
                onChange={(e) => setDevCode(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-4">
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Activar Premium
              </button>
            </div>
            {devMsg && (
              <div className={`sm:col-span-12 text-sm font-mono ${devMsgType === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
                {devMsg}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Tiers Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tier 1: Lifetime */}
        <div 
          onClick={() => !isPremium && setSelectedTier('lifetime')}
          className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 cursor-pointer transition-all ${
            isPremium ? 'opacity-70 pointer-events-none' : ''
          } ${
            selectedTier === 'lifetime' && !isPremium
              ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50/10 scale-[1.02]' 
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase">
              Hogar
            </span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Premium de por vida</h3>
            <p className="text-xs text-slate-500 mt-1">Escaneos ilimitados sin restricciones.</p>
          </div>
          <div className="flex items-baseline gap-1 pt-2 border-t border-slate-100">
            <span className="text-2xl font-extrabold text-slate-900">$9.99</span>
            <span className="text-[10px] text-slate-400 font-medium">/ pago único</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 pt-1">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Diagnósticos de IP ilimitados</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Escaneo TCP real de puertos en vivo</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Envío de Reportes por Correo</span>
            </li>
          </ul>
        </div>

        {/* Tier 2: Monthly Pro */}
        <div 
          onClick={() => !isPremium && setSelectedTier('monthly')}
          className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 cursor-pointer transition-all ${
            isPremium ? 'opacity-70 pointer-events-none' : ''
          } ${
            selectedTier === 'monthly' && !isPremium
              ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50/10 scale-[1.02]' 
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="bg-amber-50 text-amber-700 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase">
              SysAdmin
            </span>
            <Server className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Plan SysAdmin Pro</h3>
            <p className="text-xs text-slate-500 mt-1">Automatización continua de salud de red.</p>
          </div>
          <div className="flex items-baseline gap-1 pt-2 border-t border-slate-100">
            <span className="text-2xl font-extrabold text-slate-900">$4.99</span>
            <span className="text-[10px] text-slate-400 font-medium">/ mes</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 pt-1">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span><strong>Monitoreo continuo 24/7</strong></span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Alertas por email: nuevo puerto expuesto o IP en blacklist</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Soporte prioritario via email</span>
            </li>
          </ul>
        </div>

        {/* Tier 3: Whitelabel */}
        <div 
          onClick={() => !isPremium && setSelectedTier('whitelabel')}
          className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 cursor-pointer transition-all ${
            isPremium ? 'opacity-70 pointer-events-none' : ''
          } ${
            selectedTier === 'whitelabel' && !isPremium
              ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50/10 scale-[1.02]' 
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase">
              Consultores
            </span>
            <Building className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Auditoría Marca Blanca</h3>
            <p className="text-xs text-slate-500 mt-1">Para profesionales de TI y soporte técnico.</p>
          </div>
          <div className="flex items-baseline gap-1 pt-2 border-t border-slate-100">
            <span className="text-2xl font-extrabold text-slate-900">$24.99</span>
            <span className="text-[10px] text-slate-400 font-medium">/ pago único</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 pt-1">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span><strong>PDFs sin logos / Marca Blanca</strong></span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Sube tu logo para los informes</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Exportar datos técnicos JSON</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Main Grid: Features Control Panel vs Payments Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Left Side: Premium control panel or features */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-indigo-500" /> ¿Cómo Funciona la Activación?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Al confirmar el pago con el simulador de Stripe o pasarela real, la cuenta de correo que introduzcas se marcará como <strong>Premium Permanente</strong> en nuestra base de datos.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                <h4 className="font-bold text-slate-700">🔐 Canales Seguros</h4>
                <p className="text-slate-500">Cifrado de datos de extremo a extremo a través de HTTPS/TLS.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                <h4 className="font-bold text-slate-700">🌱 Cuidado Energético</h4>
                <p className="text-slate-500">Parte de lo recaudado financia servidores neutrales en emisiones de carbono.</p>
              </div>
            </div>
          </div>

          {/* Premium Actions Controls (Only shown if Premium) */}
          {isPremium && (
            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-5 shadow-sm">
              <h3 className="text-sm font-bold text-indigo-600 border-b border-slate-100 pb-3 font-mono uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" /> Panel de Control Premium Activo
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2 font-bold">Simular Monitoreo de Servidor en Vivo</h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={onSimulateAlert}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
                    >
                      <BellRing className="w-4 h-4 text-amber-600 animate-pulse" />
                      Simular Alerta de Puerto Abierto / Blacklist
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2 font-bold">Envío de Informes PDF/Email de Alto Valor</h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => onSendReport('Resumen Ejecutivo')}
                      disabled={reportSending}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                    >
                      <Mail className="w-4 h-4 text-indigo-200" />
                      Enviar Reporte Ejecutivo
                    </button>
                    <button
                      onClick={() => onSendReport('Reporte Técnico Detallado')}
                      disabled={reportSending}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      Enviar Informe Técnico de Redes (Estilo Nmap)
                    </button>
                  </div>
                  {reportMessage && (
                    <p className="text-xs text-emerald-700 mt-2.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg leading-relaxed">
                      {reportMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Payment Form / Confirmation */}
        <div className="lg:col-span-5 space-y-6">
          {!isPremium ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Form Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    Pasarela de Pago Stripe
                  </span>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded uppercase font-bold font-mono">
                  Transacción Segura
                </span>
              </div>

              {/* Payment Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-lg text-xs font-medium">
                    {error}
                  </div>
                )}

                {/* Plan Summary */}
                <div className="bg-slate-50 p-3 border border-slate-100 rounded-xl space-y-1 text-xs">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Plan Seleccionado:</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{tiers[selectedTier].name}</span>
                    <span className="text-indigo-600 font-extrabold font-mono text-sm">{tiers[selectedTier].price}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{tiers[selectedTier].description}</p>
                </div>

                {/* Email (readonly autofilled) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Email de Suscriptor
                  </label>
                  <input
                    type="email"
                    value={email || 'Inicia sesión primero'}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 focus:outline-none"
                  />
                  {!email && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      * Debes estar registrado e identificado con tu email en la pestaña Perfil para poder realizar el pago.
                    </p>
                  )}
                </div>

                {/* Cardholder Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Nombre del Titular
                  </label>
                  <input
                    type="text"
                    placeholder="ej. M. Castillo"
                    required
                    disabled={!email}
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Card Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Número de Tarjeta de Crédito / Débito
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="4000 1234 5678 9010"
                      required
                      disabled={!email}
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                    <CreditCard className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {/* Expiry and CVC */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Vencimiento (MM/AA)
                    </label>
                    <input
                      type="text"
                      placeholder="12/28"
                      required
                      disabled={!email}
                      value={expiry}
                      onChange={handleExpiryChange}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      CVC
                    </label>
                    <input
                      type="password"
                      placeholder="123"
                      required
                      disabled={!email}
                      value={cvc}
                      onChange={handleCvcChange}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Submit Pay */}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Procesando con Stripe...
                    </span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4.5 h-4.5" />
                      Pagar {tiers[selectedTier].price} & Confirmar
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-400 text-center font-mono">
                  <span>🔒 Transacción Cifrada SSL/TLS</span>
                  <span>•</span>
                  <span>PCI-DSS Compliant</span>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 p-6 rounded-2xl text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Plan Premium Activo</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Gracias por apoyar a MyIP y fomentar la soberanía digital de los usuarios.</p>
              </div>
              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl text-left space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Suscriptor:</span>
                  <span className="font-mono text-slate-700 font-bold">{email}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Tipo de Licencia:</span>
                  <span className="text-amber-600 font-bold">Premium Permanente</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Soporte Técnico:</span>
                  <span className="text-indigo-600 font-bold">Prioritario de por vida</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
