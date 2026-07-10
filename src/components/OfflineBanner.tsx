import React from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-2.5 shadow-lg flex items-center justify-center gap-2 text-sm font-medium">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>Sin conexion a internet. Algunas funciones requieren conexion activa.</span>
    </div>
  );
}
