/**
 * orchestrator.mjs — Compone el prompt fundamentado (RAG) en el proceso main.
 * Fusiona (RRF) recuperación léxica + vectorial cuando el índice está listo,
 * respeta la privacidad configurada y valida las citas del modelo.
 */
import { retrieve, buildContext } from './retriever.mjs';
import { redactSecrets, wrapUntrusted } from './sensitivity.mjs';
import * as vectorIndex from './vector-index.mjs';
import * as kiStore from '../ki-store.mjs';

const BASE_SYSTEM =
  'Eres Open Brain, el asistente personal integrado en el segundo cerebro del usuario. ' +
  'Respondes en español, con precisión y sin rodeos.';

const GROUNDING_INSTRUCTION =
  '\n\nUsa la información recuperada del Brain del usuario para responder. Cuando te apoyes en un KI, ' +
  'cítalo con su id entre dobles corchetes, p.ej. [[algun-ki-id]]. Si la respuesta no está en el ' +
  'contexto, dilo claramente y responde con tu conocimiento general.\n\n';

// Reciprocal Rank Fusion sobre varias listas rankeadas.
function rrf(lists, k0 = 60) {
  const map = new Map();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const sig = item.kiId + '|' + String(item.text || '').slice(0, 80);
      const cur = map.get(sig) || { kiId: item.kiId, title: item.title, text: item.text, rrf: 0 };
      cur.rrf += 1 / (k0 + rank + 1);
      if (!cur.title && item.title) cur.title = item.title;
      map.set(sig, cur);
    });
  }
  return [...map.values()].sort((a, b) => b.rrf - a.rrf);
}

function capPerKI(chunks, maxPerKI, topN) {
  const per = {};
  const out = [];
  for (const c of chunks) {
    per[c.kiId] = per[c.kiId] || 0;
    if (per[c.kiId] >= maxPerKI) continue;
    per[c.kiId]++;
    out.push(c);
    if (out.length >= topN) break;
  }
  return out;
}

/**
 * prepare(query, cfg) → contexto fundamentado listo para chatStreamStart.
 * @returns { systemPrompt, sources, includedChunks, allowedCitations, engine, grounded, tokenStats }
 */
export async function prepare(query, cfg = {}) {
  const privacy = (cfg.brain && cfg.brain.privacy) || {};
  const vecReady = vectorIndex.status().ready;
  const engine = vecReady ? 'híbrido' : 'léxico';

  const empty = (extra = {}) => ({
    systemPrompt: BASE_SYSTEM, sources: [], includedChunks: [], allowedCitations: [],
    engine, grounded: false, tokenStats: { contextChars: 0, approxTokens: 0 }, ...extra,
  });

  if (privacy.sendKiContext === false) return empty({ reason: 'sendKiContext=false' });

  // Léxico (siempre)
  const lex = retrieve(query, { topChunks: 8, maxPerKI: 3 });

  // Fusión con vectorial si el índice está listo
  let fused;
  if (vecReady) {
    const vec = await vectorIndex.search({ query, k: 8 });
    const titleMap = new Map(kiStore.listKIs().map(k => [k.id, k.title]));
    const vecWithTitle = vec.map(v => ({ ...v, title: titleMap.get(v.kiId) || v.kiId }));
    fused = rrf([lex, vecWithTitle]);
  } else {
    fused = lex.map((c, i) => ({ ...c, rrf: 1 / (60 + i + 1) }));
  }

  const top = capPerKI(fused, 2, 6);
  const budget = privacy.maxContextChars || 12000;
  const { contextText, included, citations } = buildContext(top, { budgetChars: budget });
  if (!contextText) return empty({ reason: 'sin coincidencias' });

  const safe = privacy.redactOutbound === false ? contextText : redactSecrets(contextText);
  const systemPrompt = BASE_SYSTEM + GROUNDING_INSTRUCTION + wrapUntrusted(safe);

  const seen = new Set();
  const sources = [];
  for (const i of included) {
    if (!seen.has(i.kiId)) { seen.add(i.kiId); sources.push({ id: i.kiId, title: i.title }); }
  }

  return {
    systemPrompt, sources, includedChunks: included, allowedCitations: citations,
    engine, grounded: true,
    tokenStats: { contextChars: safe.length, approxTokens: Math.round(safe.length / 4) },
  };
}

/** Extrae las citas [[id]] del texto y las valida contra los KIs enviados. */
export function parseCitations(text, allowed = []) {
  const set = new Set(allowed);
  const found = [...String(text || '').matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].trim());
  return [...new Set(found.filter(id => set.has(id)))];
}
