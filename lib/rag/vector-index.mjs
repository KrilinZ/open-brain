/**
 * vector-index.mjs — Fachada del índice vectorial local (Fase 5).
 * Delega en vector-store (cosine puro JS) + embedder (@xenova/transformers WASM).
 * status().ready === true cuando hay vectores indexados; si no, el orquestador usa léxico.
 */
import * as store from './vector-store.mjs';
import * as embedder from './embedder.mjs';

export function status() {
  const s = store.status();
  return { ready: s.count > 0, backend: 'local-transformers', count: s.count, kis: s.kis, model: s.model, dim: s.dim };
}

export async function search({ query, k = 8 } = {}) {
  if (store.status().count === 0) return [];
  if (!(await embedder.isAvailable())) return [];
  try {
    const qv = await embedder.embedQuery(query);
    return store.search(qv, k); // [{ kiId, text, score }]
  } catch { return []; }
}

export async function upsertKI(id) {
  const { indexOne } = await import('./indexer.mjs');
  return indexOne(id);
}

export async function removeKI(id) {
  store.removeKI(id);
  store.save();
  return true;
}

export { chunkText } from './chunk.mjs';
