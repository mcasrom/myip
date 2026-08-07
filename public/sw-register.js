// Registro del Service Worker (PWA) — archivo externo para una CSP estricta
// (sin 'unsafe-inline' en script-src).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA] Service Worker registrado con éxito:', reg.scope))
      .catch((err) => console.error('[PWA] Error registrando el Service Worker:', err));
  });
}
