#!/usr/bin/env node
/**
 * KI Reconcile — Unifica los dos almacenes de Knowledge Items en uno canónico.
 *
 * Problema que resuelve ("cerebro partido"):
 *   - ~/.gemini/antigravity/knowledge/   (lo lee el MCP server y Antigravity IDE)
 *   - ~/.openbrain/knowledge/            (lo lee la app OpenBrain)
 * habían divergido, así que según la puerta de entrada se veían KIs distintos.
 *
 * Estrategia (100% NO destructiva):
 *   - CANÓNICO = ~/.openbrain/knowledge  (destino superset)
 *   - KI que solo existe en gemini            -> se COPIA entero al canónico
 *   - KI en ambos: se UNEN artefactos y metadata (nunca se borra nada)
 *       · artefacto solo en gemini            -> se copia
 *       · artefacto en ambos con bytes distintos -> se guarda la variante gemini
 *                                                 como "<nombre>.gemini.<ext>"
 *       · metadata: gana el updatedAt más nuevo; summary no-vacío tiene prioridad;
 *         references se unen (unión de conjuntos)
 *   - NUNCA se escribe ni se borra en el store de gemini.
 *
 * Uso:
 *   node scripts/ki-reconcile.mjs --dry-run     # solo informa, no toca nada
 *   node scripts/ki-reconcile.mjs --apply       # ejecuta la unificación
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const HOME = os.homedir();
const GEMINI_DIR   = path.join(HOME, '.gemini', 'antigravity', 'knowledge');
const CANONICAL_DIR = path.join(HOME, '.openbrain', 'knowledge');
const REPORT_DIR    = path.join(HOME, '.openbrain', 'backups');

const APPLY = process.argv.includes('--apply');
const DRY   = !APPLY;

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function listKIs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'knowledge.lock')
    .map(e => e.name)
    .filter(name => fs.existsSync(path.join(dir, name, 'metadata.json')));
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function listArtifacts(kiDir) {
  const ad = path.join(kiDir, 'artifacts');
  if (!fs.existsSync(ad)) return [];
  try {
    return fs.readdirSync(ad, { withFileTypes: true })
      .filter(e => e.isFile()).map(e => e.name);
  } catch { return []; }
}

function md5(p) {
  try { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }
  catch { return null; }
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function newer(a, b) {
  // devuelve 'a' | 'b' | 'eq' según updatedAt
  const ta = Date.parse(a?.updatedAt || a?.createdAt || 0) || 0;
  const tb = Date.parse(b?.updatedAt || b?.createdAt || 0) || 0;
  if (ta > tb) return 'a';
  if (tb > ta) return 'b';
  return 'eq';
}

// ─── Reconciliación ──────────────────────────────────────────────────────────
const gemIds = new Set(listKIs(GEMINI_DIR));
const canIds = new Set(listKIs(CANONICAL_DIR));

const onlyGemini    = [...gemIds].filter(id => !canIds.has(id)).sort();
const onlyCanonical = [...canIds].filter(id => !gemIds.has(id)).sort();
const inBoth        = [...gemIds].filter(id => canIds.has(id)).sort();

const report = {
  ranAt: new Date().toISOString(),
  mode: APPLY ? 'apply' : 'dry-run',
  geminiDir: GEMINI_DIR,
  canonicalDir: CANONICAL_DIR,
  counts: {
    gemini: gemIds.size,
    canonical: canIds.size,
    onlyGemini: onlyGemini.length,
    onlyCanonical: onlyCanonical.length,
    inBoth: inBoth.length,
  },
  copiedKIs: [],
  mergedKIs: [],      // KIs en ambos con cambios (artefactos o metadata)
  addedArtifacts: [], // "<id>/<artefacto>"
  variantArtifacts: [], // "<id>/<artefacto>.gemini.*" (colisión de contenido)
  metadataUpdated: [],
};

// 1) KIs solo en gemini -> copiar enteros
for (const id of onlyGemini) {
  report.copiedKIs.push(id);
  if (APPLY) copyDir(path.join(GEMINI_DIR, id), path.join(CANONICAL_DIR, id));
}

// 2) KIs en ambos -> unir
for (const id of inBoth) {
  const gDir = path.join(GEMINI_DIR, id);
  const cDir = path.join(CANONICAL_DIR, id);
  let touched = false;

  // 2a) artefactos
  const gArts = listArtifacts(gDir);
  const cArts = new Set(listArtifacts(cDir));
  const cArtDir = path.join(cDir, 'artifacts');
  for (const a of gArts) {
    const gPath = path.join(gDir, 'artifacts', a);
    if (!cArts.has(a)) {
      report.addedArtifacts.push(`${id}/${a}`);
      touched = true;
      if (APPLY) {
        fs.mkdirSync(cArtDir, { recursive: true });
        fs.copyFileSync(gPath, path.join(cArtDir, a));
      }
    } else {
      const cPath = path.join(cArtDir, a);
      if (md5(gPath) !== md5(cPath)) {
        const ext = path.extname(a);
        const base = a.slice(0, a.length - ext.length);
        const variant = `${base}.gemini${ext}`;
        report.variantArtifacts.push(`${id}/${variant}`);
        touched = true;
        if (APPLY) fs.copyFileSync(gPath, path.join(cArtDir, variant));
      }
    }
  }

  // 2b) metadata: unir references, elegir el más nuevo, preservar summary no vacío
  const gMeta = readJson(path.join(gDir, 'metadata.json')) || {};
  const cMeta = readJson(path.join(cDir, 'metadata.json')) || {};
  const win = newer(gMeta, cMeta); // 'a'=gemini gana, 'b'=canonical gana
  const refs = [...new Set([...(gMeta.references || []), ...(cMeta.references || [])])];
  const merged = {
    ...cMeta,
    title: cMeta.title || gMeta.title,
    summary: (cMeta.summary && cMeta.summary.trim()) ? cMeta.summary : (gMeta.summary || cMeta.summary || ''),
    createdAt: cMeta.createdAt || gMeta.createdAt,
    updatedAt: win === 'a' ? gMeta.updatedAt : (cMeta.updatedAt || gMeta.updatedAt),
    references: refs,
  };
  const changed =
    merged.summary !== (cMeta.summary || '') ||
    merged.updatedAt !== (cMeta.updatedAt || '') ||
    refs.length !== (cMeta.references || []).length ||
    merged.title !== (cMeta.title || '');
  if (changed) {
    report.metadataUpdated.push(id);
    touched = true;
    if (APPLY) fs.writeFileSync(path.join(cDir, 'metadata.json'), JSON.stringify(merged, null, 2));
  }

  if (touched) report.mergedKIs.push(id);
}

// ─── Salida ──────────────────────────────────────────────────────────────────
fs.mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = path.join(REPORT_DIR, `reconcile-report-${ts()}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

const finalCanon = APPLY ? listKIs(CANONICAL_DIR).length : canIds.size + onlyGemini.length;

console.log('═══════════════════════════════════════════════════════');
console.log(`  KI RECONCILE — ${APPLY ? '🟢 APPLY (cambios escritos)' : '🔍 DRY-RUN (sin cambios)'}`);
console.log('═══════════════════════════════════════════════════════');
console.log(`  gemini    (${GEMINI_DIR.replace(HOME, '~')}): ${gemIds.size} KIs`);
console.log(`  canonical (${CANONICAL_DIR.replace(HOME, '~')}): ${canIds.size} KIs`);
console.log('  ─────────────────────────────────────────────────────');
console.log(`  Solo en gemini (se copian al canónico): ${onlyGemini.length}`);
console.log(`  Solo en canónico (ya estaban):          ${onlyCanonical.length}`);
console.log(`  En ambos:                               ${inBoth.length}`);
console.log(`    · con artefactos añadidos:  ${report.addedArtifacts.length}`);
console.log(`    · con variantes gemini:     ${report.variantArtifacts.length}`);
console.log(`    · con metadata actualizada: ${report.metadataUpdated.length}`);
console.log('  ─────────────────────────────────────────────────────');
console.log(`  Store canónico ${APPLY ? 'AHORA' : 'QUEDARÍA'} con: ${finalCanon} KIs`);
console.log(`  Reporte: ${reportPath.replace(HOME, '~')}`);
console.log('═══════════════════════════════════════════════════════');
if (DRY) console.log('  Ejecuta con --apply para aplicar la unificación.');
