/**
 * retriever.mjs — Recuperación a nivel de FRAGMENTO sobre los KIs.
 * Motor léxico (siempre disponible). Cuando el vector-index esté listo (Fase 5),
 * el orquestador fusionará ambos con RRF; aquí exponemos la vía léxica.
 */
import * as kiStore from '../ki-store.mjs';
import { chunkText } from './chunk.mjs';
import { normalizeText } from './normalize.mjs';

function terms(q) {
  return normalizeText(q).split(/\s+/).filter(t => t.length > 1);
}

function countOccurrences(haystack, needle) {
  let n = 0, idx = haystack.indexOf(needle);
  while (idx >= 0) { n++; idx = haystack.indexOf(needle, idx + needle.length); }
  return n;
}

/**
 * Devuelve los mejores fragmentos para la query.
 * @returns [{ kiId, title, text, score }]
 */
export function retrieve(query, { topChunks = 6, maxPerKI = 2, candidateKIs = 30 } = {}) {
  const ts = terms(query);
  if (!ts.length) return [];

  const shortlist = kiStore.searchLexical(query, candidateKIs);
  const scored = [];

  for (const ki of shortlist) {
    const titleL = normalizeText(ki.title || '');
    const chunks = chunkText(kiStore.getKIText(ki.id), { maxChars: 1000, overlap: 150 });
    for (const ch of chunks) {
      const cl = normalizeText(ch);
      let score = 0, matched = 0;
      for (const t of ts) {
        const n = countOccurrences(cl, t);
        if (n > 0) { score += n; matched++; }
        if (titleL.includes(t)) score += 0.5;
      }
      // Bonus si el fragmento cubre varios términos distintos (más relevante)
      if (matched > 1) score += matched;
      if (score > 0) scored.push({ kiId: ki.id, title: ki.title, text: ch, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Diversidad: máximo maxPerKI fragmentos por KI
  const perKI = {};
  const out = [];
  for (const c of scored) {
    perKI[c.kiId] = perKI[c.kiId] || 0;
    if (perKI[c.kiId] >= maxPerKI) continue;
    perKI[c.kiId]++;
    out.push(c);
    if (out.length >= topChunks) break;
  }
  return out;
}

/**
 * Construye el bloque de contexto respetando un presupuesto de caracteres.
 * @returns { contextText, included:[{kiId,title,chars}], citations:[kiId] }
 */
export function buildContext(chunks, { budgetChars = 12000 } = {}) {
  let used = 0;
  const included = [];
  const parts = [];
  for (const c of chunks) {
    const block = `### [[${c.kiId}]] ${c.title}\n${c.text}`;
    if (used + block.length > budgetChars && parts.length > 0) break;
    parts.push(block);
    used += block.length;
    included.push({ kiId: c.kiId, title: c.title, chars: c.text.length });
  }
  return {
    contextText: parts.join('\n\n'),
    included,
    citations: [...new Set(included.map(i => i.kiId))],
  };
}
