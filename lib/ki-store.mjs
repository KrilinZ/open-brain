/**
 * ki-store.mjs — Lector/escritor canónico de Knowledge Items.
 * Fuente de verdad: ~/.openbrain/knowledge/  (override con OPENBRAIN_KI_DIR).
 * Sin dependencias de Electron: usable desde main y desde tests headless.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { normalizeText } from './rag/normalize.mjs';

const KNOWLEDGE_DIR = process.env.OPENBRAIN_KI_DIR
  || path.join(os.homedir(), '.openbrain', 'knowledge');

const MAIN_ARTIFACTS = ['context.md', 'content.md'];

function safeReadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }
function safeReadText(p) { try { return fs.readFileSync(p, 'utf-8'); } catch { return null; } }

export function listKIs() {
  const items = [];
  if (!fs.existsSync(KNOWLEDGE_DIR)) return items;
  for (const entry of fs.readdirSync(KNOWLEDGE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'knowledge.lock') continue;
    const meta = safeReadJson(path.join(KNOWLEDGE_DIR, entry.name, 'metadata.json'));
    if (!meta) continue;
    items.push({
      id: entry.name,
      title: meta.title || entry.name,
      summary: meta.summary || '',
      updatedAt: meta.updatedAt || meta.createdAt || null,
    });
  }
  return items;
}

// Cache de texto de artefactos por id, invalidada por mtime del dir artifacts/.
const _textCache = new Map();
export function getKIText(id) {
  const dir = path.join(KNOWLEDGE_DIR, id, 'artifacts');
  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(dir).mtimeMs; } catch { return ''; }
  const cached = _textCache.get(id);
  if (cached && cached.mtimeMs === mtimeMs) return cached.text;
  let text = '';
  try {
    for (const af of fs.readdirSync(dir, { withFileTypes: true })) {
      if (af.isFile()) text += (safeReadText(path.join(dir, af.name)) || '') + '\n';
    }
  } catch { /* no dir */ }
  _textCache.set(id, { mtimeMs, text });
  return text;
}

export function getKI(id) {
  const meta = safeReadJson(path.join(KNOWLEDGE_DIR, id, 'metadata.json'));
  if (!meta) return null;
  return {
    id,
    title: meta.title || id,
    summary: meta.summary || '',
    references: meta.references || [],
    updatedAt: meta.updatedAt || null,
    content: getKIText(id).trim(),
  };
}

// Búsqueda léxica a nivel KI (título > resumen > contenido, AND de términos).
export function searchLexical(query, limit = 30) {
  const terms = normalizeText(query).split(/\s+/).filter(t => t.length > 1);
  if (!terms.length) return [];
  const scored = [];
  for (const ki of listKIs()) {
    const titleL = normalizeText(ki.title);
    const summaryL = normalizeText(ki.summary || '');
    const needContent = terms.some(t => !titleL.includes(t) && !summaryL.includes(t));
    const contentL = needContent ? normalizeText(getKIText(ki.id)) : '';
    let score = 0, allMatch = true;
    for (const t of terms) {
      if (titleL.includes(t)) score += 3;
      else if (summaryL.includes(t)) score += 2;
      else if (contentL.includes(t)) score += 1;
      else { allMatch = false; break; }
    }
    if (allMatch) scored.push({ ...ki, score });
  }
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return scored.slice(0, limit);
}

function slugify(title) {
  return String(title).toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
    .substring(0, 50) || 'ki';
}

export function createKI({ title, summary = '', content = '', source = null, references = [] }) {
  if (!title || !content) throw new Error('title y content son obligatorios');
  const id = `${slugify(title)}-${Date.now()}`;
  const kiDir = path.join(KNOWLEDGE_DIR, id);
  const artDir = path.join(kiDir, 'artifacts');
  fs.mkdirSync(artDir, { recursive: true });
  const now = new Date().toISOString();
  const refs = source ? [...references, source] : references;
  fs.writeFileSync(path.join(kiDir, 'metadata.json'),
    JSON.stringify({ title, summary, createdAt: now, updatedAt: now, references: refs, source: source || undefined, id }, null, 2));
  fs.writeFileSync(path.join(artDir, 'context.md'), content, 'utf-8');
  return { id, action: 'created' };
}

export function updateKI(id, { summary, content } = {}) {
  const kiDir = path.join(KNOWLEDGE_DIR, id);
  if (!fs.existsSync(kiDir)) throw new Error(`KI no encontrado: ${id}`);
  const metaPath = path.join(kiDir, 'metadata.json');
  const meta = safeReadJson(metaPath) || {};
  meta.updatedAt = new Date().toISOString();
  if (typeof summary === 'string') meta.summary = summary;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  if (typeof content === 'string' && content) {
    const artDir = path.join(kiDir, 'artifacts');
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(path.join(artDir, 'context.md'), content, 'utf-8');
  }
  return { id, action: 'updated' };
}

export { KNOWLEDGE_DIR, MAIN_ARTIFACTS };
