// src/utils/passwordBloom.ts
//
// Carga el Bloom filter (scripts/rockyou-bloom.json) UNA VEZ al arrancar
// el proceso y lo mantiene en memoria (~25-35MB fijos, nada por request).
// No usa Python, no hace spawn de procesos, no toca disco tras el arranque.
//
import fs from 'fs';
import path from 'path';
import { BloomFilter } from 'bloom-filters';

import { fileURLToPath } from 'url';
// esbuild (build de produccion, formato cjs) inyecta un __dirname real y
// correcto apuntando a dist/. En dev (tsx, ESM nativo) __dirname no existe,
// se usa import.meta.url en su lugar. typeof es seguro aqui: nunca lanza
// ReferenceError aunque la variable no exista en el scope.
const baseDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const BLOOM_CANDIDATES = [
  path.join(baseDir, '../scripts/rockyou-bloom.json'),   // produccion (dist/)
  path.join(baseDir, '../../scripts/rockyou-bloom.json') // dev (src/, tsx directo)
];
const BLOOM_PATH = BLOOM_CANDIDATES.find(p => fs.existsSync(p)) ?? BLOOM_CANDIDATES[0];

let filter: BloomFilter | null = null;
let loadError: string | null = null;

function loadFilter(): void {
  try {
    if (!fs.existsSync(BLOOM_PATH)) {
      loadError = `No se encontró ${BLOOM_PATH}. Ejecuta: node scripts/build-bloom-filter.js`;
      console.warn(`[passwordBloom] ${loadError}`);
      return;
    }
    const raw = fs.readFileSync(BLOOM_PATH, 'utf-8');
    const json = JSON.parse(raw);
    filter = BloomFilter.fromJSON(json);
    console.log('[passwordBloom] Bloom filter cargado en memoria correctamente.');
  } catch (err) {
    loadError = `Error cargando Bloom filter: ${err}`;
    console.error(`[passwordBloom] ${loadError}`);
  }
}

// Carga inmediata al importar el módulo (una sola vez en la vida del proceso)
loadFilter();

/**
 * Devuelve true si la contraseña está en el diccionario de contraseñas
 * filtradas (rockyou.txt). Falso positivo posible (~0.1%), falso negativo
 * imposible — si dice `false`, la contraseña NO está en el diccionario.
 *
 * Si el filtro no pudo cargarse, devuelve `false` (fail-open) para no
 * bloquear registros por un problema de infraestructura; se loguea el
 * error para que salte en monitorización.
 */
export function isCommonPassword(password: string): boolean {
  if (!filter) {
    if (loadError) {
      console.warn('[passwordBloom] Chequeo omitido (filtro no disponible):', loadError);
    }
    return false;
  }
  return filter.has(password);
}

export function isPasswordBloomReady(): boolean {
  return filter !== null;
}
