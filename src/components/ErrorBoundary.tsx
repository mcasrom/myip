import React, { useState, useEffect, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent): void => {
      console.error('[ErrorBoundary] Window error:', event.error);
      setHasError(true);
      setError(event.error || new Error('Error desconocido'));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      console.error('[ErrorBoundary] Unhandled rejection:', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleReset = (): void => {
    setHasError(false);
    setError(null);
    window.location.hash = '';
    window.location.reload();
  };

  if (hasError) {
    if (fallback) return fallback;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Algo salio mal</h2>
          <p className="text-sm text-slate-500 mb-6">
            Ha ocurrido un error inesperado. No te preocupes, tus datos estan seguros.
          </p>

          <div className="bg-slate-50 rounded-lg p-3 mb-6 text-left">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Detalles tecnicos</p>
            <p className="text-xs font-mono text-slate-600 truncate">
              {error?.message || 'Error desconocido'}
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Recargar pagina
            </button>
            <a
              href="/"
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              <Home className="w-4 h-4" /> Ir al inicio
            </a>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
