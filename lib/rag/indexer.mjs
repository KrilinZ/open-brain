/**
 * indexer.mjs — Construye/actualiza el índice vectorial sobre los KIs.
 * Incremental por hash del contenido: solo re-embebe los KIs que cambiaron.
 */
import crypto from 'crypto';
import * as kiStore from '../ki-store.mjs';
import * as store from './vector-store.mjs';
import * as embedder from './embedder.mjs';
import { chunkText } from './chunk.mjs';

const MAX_CHUNKS_PER_KI = 12;

function hash(s) { return crypto.createHash('md5').update(String(s || '')).digest('hex'); }

export async function reindex({ onProgress, force = false } = {}) {
  if (!(await embedder.isAvailable())) return { ok: false, error: 'EMBEDDER_UNAVAILABLE' };
  store.setModel(embedder.MODEL, embedder.DIM);

  const kis = kiStore.listKIs();
  let done = 0, embedded = 0, skipped = 0;

  for (const ki of kis) {
    const text = kiStore.getKIText(ki.id);
    const h = hash(text);
    if (!force && store.kiHash(ki.id) === h) {
      skipped++; done++;
      onProgress && onProgress({ done, total: kis.length, embedded, skipped, current: ki.id });
      continue;
    }
    const chunks = chunkText(text, { maxChars: 900, overlap: 120 }).slice(0, MAX_CHUNKS_PER_KI);
    if (chunks.length) {
      const vecs = await embedder.embedPassages(chunks);
      store.upsertKI(ki.id, h, chunks.map((t, chunkIdx) => ({ chunkIdx, text: t, vec: vecs[chunkIdx] })));
      embedded++;
    } else {
      store.upsertKI(ki.id, h, []);
    }
    done++;
    onProgress && onProgress({ done, total: kis.length, embedded, skipped, current: ki.id });
    if (done % 20 === 0) store.save();
  }

  store.pruneExcept(kis.map(k => k.id)); // limpia KIs borrados
  store.save();
  return { ok: true, ...store.status(), embedded, skipped };
}

export async function indexOne(kiId) {
  if (!(await embedder.isAvailable())) return { ok: false, error: 'EMBEDDER_UNAVAILABLE' };
  const text = kiStore.getKIText(kiId);
  if (!text) { store.removeKI(kiId); store.save(); return { ok: true, removed: true }; }
  const chunks = chunkText(text, { maxChars: 900, overlap: 120 }).slice(0, MAX_CHUNKS_PER_KI);
  const vecs = await embedder.embedPassages(chunks);
  store.upsertKI(kiId, hash(text), chunks.map((t, i) => ({ chunkIdx: i, text: t, vec: vecs[i] })));
  store.save();
  return { ok: true, ...store.status() };
}
