/**
 * embedder.mjs — Embeddings LOCALES vía @xenova/transformers (WASM, sin módulos nativos).
 *
 * Modelo multilingüe (funciona en español): Xenova/multilingual-e5-small (384 dims).
 * Carga PEREZOSA con import dinámico: si la dependencia no está instalada,
 * isAvailable() === false y todo el sistema cae al léxico sin romperse.
 * El modelo se cachea en ~/.openbrain/models (descarga única en el primer indexado).
 */
import path from 'path';
import os from 'os';
import { normalizeText } from './normalize.mjs';

export const MODEL = 'Xenova/multilingual-e5-small';
export const DIM = 384;
const CACHE_DIR = path.join(os.homedir(), '.openbrain', 'models');

let _pipe = null;
let _loading = null;
let _available = null;

export async function isAvailable() {
  if (_available !== null) return _available;
  try { await import('@xenova/transformers'); _available = true; }
  catch { _available = false; }
  return _available;
}

async function getPipe(onProgress) {
  if (_pipe) return _pipe;
  if (_loading) return _loading;
  _loading = (async () => {
    const tf = await import('@xenova/transformers');
    tf.env.allowLocalModels = false;
    tf.env.cacheDir = CACHE_DIR;
    _pipe = await tf.pipeline('feature-extraction', MODEL,
      onProgress ? { progress_callback: onProgress } : undefined);
    return _pipe;
  })();
  return _loading;
}

// e5 recomienda prefijos "query:"/"passage:" para separar consulta y documento.
function prep(text, kind) { return `${kind}: ${normalizeText(text).slice(0, 512)}`; }

export async function embedPassages(texts, onProgress) {
  const pipe = await getPipe(onProgress);
  const out = [];
  for (const t of texts) {
    const res = await pipe(prep(t, 'passage'), { pooling: 'mean', normalize: true });
    out.push(Array.from(res.data));
  }
  return out;
}

export async function embedQuery(text, onProgress) {
  const pipe = await getPipe(onProgress);
  const res = await pipe(prep(text, 'query'), { pooling: 'mean', normalize: true });
  return Array.from(res.data);
}

export { CACHE_DIR };
