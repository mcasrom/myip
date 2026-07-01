/**
 * Browser Fingerprint Generator
 * Creates a stable, unique identifier per browser/device.
 * Used for anti-fraud: prevents users from bypassing scan limits
 * by clearing cookies or using incognito mode.
 */

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('MyIP FP', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('MyIP FP', 4, 17);
    return canvas.toDataURL().slice(-32);
  } catch {
    return '';
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!ext) return '';
    const vendor = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_VENDOR_WEBGL);
    const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return hashString(vendor + renderer);
  } catch {
    return '';
  }
}

export function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '',
    (navigator as any).deviceMemory?.toString() || '',
    getCanvasFingerprint(),
    getWebGLFingerprint(),
  ].filter(Boolean);

  return hashString(components.join('||'));
}

export function getStoredFingerprint(): string | null {
  try {
    return localStorage.getItem('myip_fingerprint');
  } catch {
    return null;
  }
}

export function initFingerprint(): string {
  const stored = getStoredFingerprint();
  if (stored) return stored;

  const fp = generateFingerprint();
  try {
    localStorage.setItem('myip_fingerprint', fp);
  } catch {
    // localStorage blocked, fingerprint will be regenerated each session
  }
  return fp;
}
