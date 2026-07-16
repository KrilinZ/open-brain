/**
 * vector-store.mjs — Índice vectorial local: JSON plano + cosine en JS.
 *
 * A escala de unos miles de vectores (421 KIs ≈ pocos miles de chunks) la búsqueda
 * por fuerza bruta es instantánea, y evita módulos NATIVOS (sqlite-vec/better-sqlite3)
 * que complican rebuild y notarización del DMG.
 *
 * Persistencia: ~/.openbrain/vector-index.json
 *   { model, dim, kiHashes:{kiId:hash}, items:[{kiId,chunkIdx,text,vec:[...]}] }
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const AG_BASE = path.join(os.homedir(), '.openbrain');
const INDEX_FILE = process.env.OPENBRAIN_VECTOR_INDEX || path.join(AG_BASE, 'vector-index.json');

let _cache = null;

function load() {
  if (_cache) return _cache;
  try { _cache = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); }
  catch { _cache = { model: null, dim: 0, kiHashes: {}, items: [] }; }
  _cache.items = _cache.items || [];
  _cache.kiHashes = _cache.kiHashes || {};
  return _cache;
}

export function save() {
  if (!_cache) return;
  fs.mkdirSync(AG_BASE, { recursive: true });
  const tmp = INDEX_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_cache));
  fs.renameSync(tmp, INDEX_FILE);
}

export function status() {
  const c = load();
  return { count: c.items.length, kis: Object.keys(c.kiHashes).length, dim: c.dim, model: c.model };
}

export function kiHash(kiId) { return load().kiHashes[kiId] || null; }
export function setModel(model, dim) { const c = load(); c.model = model; c.dim = dim; }
export function reset() { _cache = { model: null, dim: 0, kiHashes: {}, items: [] }; }

/** Reemplaza todos los vectores de un KI. vectors: [{chunkIdx, text, vec:number[]}] */
export function upsertKI(kiId, hash, vectors) {
  const c = load();
  c.items = c.items.filter(it => it.kiId !== kiId);
  for (const v of vectors) c.items.push({ kiId, chunkIdx: v.chunkIdx, text: v.text, vec: v.vec });
  c.kiHashes[kiId] = hash;
}

export function removeKI(kiId) {
  const c = load();
  c.items = c.items.filter(it => it.kiId !== kiId);
  delete c.kiHashes[kiId];
}

/** Elimina del índice cualquier KI que ya no exista en `ids`. */
export function pruneExcept(ids) {
  const c = load();
  const set = new Set(ids);
  c.items = c.items.filter(it => set.has(it.kiId));
  for (const id of Object.keys(c.kiHashes)) if (!set.has(id)) delete c.kiHashes[id];
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

/** Top-k por similitud coseno. Devuelve [{kiId, text, score}]. */
export function search(queryVec, k = 6) {
  const c = load();
  const scored = c.items.map(it => ({ kiId: it.kiId, text: it.text, score: cosine(queryVec, it.vec) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export { INDEX_FILE };
