/**
 * normalize.mjs — Normalización de texto para matching robusto.
 * Pliega acentos y ñ (NFD + quita diacríticos) y pasa a minúsculas, para que
 * "Auditoría" case con "auditoria" y "diseño" con "diseno". Compartido por el
 * léxico y el embedder.
 */
export function foldAccents(s) {
  // Descompone en NFD y quita las marcas diacríticas combinantes (U+0300–U+036F).
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeText(s) {
  return foldAccents(String(s || '').toLowerCase());
}

export function normalizeTerms(query) {
  return normalizeText(query).split(/\s+/).filter(t => t.length > 1);
}
