#!/usr/bin/env node
/**
 * MCP Server — Antigravity Brain KI Store
 * Expone los Knowledge Items de ~/.openbrain/knowledge/
 * como herramientas MCP para que Claude (u otro AI) los lea.
 *
 * Protocolo: MCP sobre stdio (JSON-RPC 2.0)
 * Uso: node scripts/mcp-ki-server.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// Store canónico unificado (superset de OpenBrain + Antigravity). Fuente de verdad.
// Se puede sobreescribir con la variable de entorno OPENBRAIN_KI_DIR.
const AG_KNOWLEDGE = process.env.OPENBRAIN_KI_DIR
  || path.join(os.homedir(), '.openbrain', 'knowledge');

/* ─── Utilidades ─────────────────────────────────────────────── */

function safeReadJson(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); }
  catch { return null; }
}

function safeReadText(filepath) {
  try { return fs.readFileSync(filepath, 'utf-8'); }
  catch { return null; }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/* ─── Lógica KI (misma que ki-cli.mjs y main.js) ────────────── */

function listKIs() {
  const items = [];
  if (!fs.existsSync(AG_KNOWLEDGE)) return items;

  const entries = fs.readdirSync(AG_KNOWLEDGE, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'knowledge.lock') continue;
    const metaPath = path.join(AG_KNOWLEDGE, entry.name, 'metadata.json');
    const meta = safeReadJson(metaPath);
    if (!meta) continue;

    const artifactsDir = path.join(AG_KNOWLEDGE, entry.name, 'artifacts');
    let artifactNames = [];
    try {
      artifactNames = fs.readdirSync(artifactsDir, { withFileTypes: true })
        .filter(a => a.isFile())
        .map(a => a.name);
    } catch { /* no artifacts */ }

    items.push({
      id: entry.name,
      titulo: meta.title || meta.summary?.substring(0, 60) || entry.name,
      resumen: meta.summary || '',
      referencias: meta.references || [],
      creadoEn: meta.createdAt || null,
      actualizadoEn: meta.updatedAt || null,
      artefactos: artifactNames,
    });
  }
  items.sort((a, b) => a.id < b.id ? -1 : 1);
  return items;
}

// Nombres de artefacto que se consideran "principales" y se devuelven inline
// cuando no se pide un artefacto concreto.
const MAIN_ARTIFACTS = ['context.md', 'content.md'];

function getKI(id, { full = true, artifact = null } = {}) {
  const kiDir = path.join(AG_KNOWLEDGE, id);
  const metaPath = path.join(kiDir, 'metadata.json');
  const meta = safeReadJson(metaPath);
  if (!meta) return null;

  const artifactsDir = path.join(kiDir, 'artifacts');
  let allNames = [];
  try {
    allNames = fs.readdirSync(artifactsDir, { withFileTypes: true })
      .filter(a => a.isFile())
      .map(a => a.name);
  } catch { /* no dir */ }

  // Decidir qué artefactos cargar con contenido:
  // - artifact dado  -> solo ese
  // - 1 artefacto    -> ese
  // - >1 artefactos  -> solo los "principales" (context/content); el resto se lista sin contenido
  let namesToLoad;
  let omitted = [];
  if (artifact) {
    namesToLoad = allNames.filter(n => n === artifact);
  } else if (allNames.length <= 1) {
    namesToLoad = allNames;
  } else {
    const mains = allNames.filter(n => MAIN_ARTIFACTS.includes(n.toLowerCase()));
    namesToLoad = mains.length ? mains : allNames.slice(0, 1);
    omitted = allNames.filter(n => !namesToLoad.includes(n));
  }

  const artifactFiles = [];
  for (const name of namesToLoad) {
    const afPath = path.join(artifactsDir, name);
    let contenido = safeReadText(afPath);
    if (!full && contenido && contenido.length > 3000) {
      contenido = contenido.substring(0, 3000) + '\n\n[... truncado, usa get_ki con full=true para ver completo]';
    }
    let tamaño = '0 B';
    try { tamaño = formatBytes(fs.statSync(afPath).size); } catch { /* gone */ }
    artifactFiles.push({ nombre: name, contenido, tamaño });
  }

  return {
    id,
    titulo: meta.title || id,
    resumen: meta.summary || '',
    referencias: meta.references || [],
    creadoEn: meta.createdAt || null,
    actualizadoEn: meta.updatedAt || null,
    artefactos: artifactFiles,
    artefactosOmitidos: omitted,   // listados pero no cargados (pide con artifact=<nombre>)
    totalArtefactos: allNames.length,
  };
}

// Caché de texto concatenado de artefactos para búsqueda (invalidada por mtime del dir).
const _contentCache = new Map(); // id -> { mtimeMs, text }

function readAllArtifactText(id) {
  const artifactsDir = path.join(AG_KNOWLEDGE, id, 'artifacts');
  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(artifactsDir).mtimeMs; } catch { return ''; }

  const cached = _contentCache.get(id);
  if (cached && cached.mtimeMs === mtimeMs) return cached.text;

  let text = '';
  try {
    for (const af of fs.readdirSync(artifactsDir, { withFileTypes: true })) {
      if (!af.isFile()) continue;
      text += (safeReadText(path.join(artifactsDir, af.name)) || '') + '\n';
    }
  } catch { /* no dir */ }

  _contentCache.set(id, { mtimeMs, text });
  return text;
}

function slugFromTitle(titulo) {
  return titulo
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function createOrUpdateKI({ titulo, resumen, contenido, force = false }) {
  const id = slugFromTitle(titulo);
  const kiDir = path.join(AG_KNOWLEDGE, id);
  const artifactsDir = path.join(kiDir, 'artifacts');

  const exists = fs.existsSync(kiDir);
  if (exists && !force) {
    // Update: preserve existing context.md, only update metadata
    const metaPath = path.join(kiDir, 'metadata.json');
    const existing = safeReadJson(metaPath) || {};
    fs.writeFileSync(metaPath, JSON.stringify({
      ...existing,
      title: titulo,
      summary: resumen,
      updatedAt: new Date().toISOString(),
    }, null, 2));
    if (contenido) {
      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.writeFileSync(path.join(artifactsDir, 'context.md'), contenido, 'utf-8');
    }
    return { id, created: false, updated: true };
  }

  fs.mkdirSync(artifactsDir, { recursive: true });
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify({
    title: titulo,
    summary: resumen,
    createdAt: now,
    updatedAt: now,
    references: [],
  }, null, 2));
  if (contenido) {
    fs.writeFileSync(path.join(artifactsDir, 'context.md'), contenido, 'utf-8');
  }
  return { id, created: true, updated: false };
}

/* ─── Definición de herramientas MCP ─────────────────────────── */

const TOOLS = [
  {
    name: 'list_kis',
    description: 'Índice COMPACTO de Knowledge Items (id — título), paginado. Por defecto devuelve solo id+título (sin resumen ni contenido) para no saturar el contexto: el almacén tiene cientos de KIs. Para encontrar un KI concreto prefiere search_kis; usa list_kis solo para navegar/paginar el índice o filtrar por texto en id/título/resumen.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Filtro opcional: solo KIs cuyo id, título o resumen contengan este texto (case-insensitive).',
        },
        limit: {
          type: 'number',
          description: 'Máximo de KIs a devolver (por defecto 60). Usa offset para paginar.',
          default: 60,
        },
        offset: {
          type: 'number',
          description: 'Desplazamiento para paginación (por defecto 0).',
          default: 0,
        },
        verbose: {
          type: 'boolean',
          description: 'Si true, incluye resumen, artefactos y fecha por KI (más tokens). Por defecto false (solo id — título).',
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_ki',
    description: 'Lee un Knowledge Item por su id. Por defecto incluye todos sus artefactos; usa `artifact` para traer solo uno (recomendado en KIs con muchos artefactos) y `full=false` para truncar a 3000 chars por artefacto.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID del KI (nombre de carpeta, ej: "antigravity-brain-torre-control")',
        },
        full: {
          type: 'boolean',
          description: 'Si true (por defecto), devuelve el contenido completo. Si false, trunca a 3000 chars por artefacto.',
          default: true,
        },
        artifact: {
          type: 'string',
          description: 'Opcional: nombre de un artefacto concreto (ej: "context.md"). Si se omite y el KI tiene >1 artefacto, devuelve un índice de artefactos + solo context.md/content.md; pasa este parámetro para leer los demás.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_kis',
    description: 'VÍA PRINCIPAL para recuperar KIs: busca por texto en título, resumen y contenido, ordena por relevancia (título > resumen > contenido) y devuelve resultados compactos con snippet. Prefiérela frente a list_kis para encontrar conocimiento.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto a buscar (case-insensitive). Puedes pasar varias palabras separadas por espacio (AND).',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (por defecto 10).',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_ki',
    description: 'Crea un nuevo Knowledge Item en el almacén de Antigravity Brain. Si ya existe un KI con el mismo título, falla a menos que force=true.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: {
          type: 'string',
          description: 'Título del KI (se convierte en slug para el id)',
        },
        resumen: {
          type: 'string',
          description: 'Resumen breve del KI (1-2 frases)',
        },
        contenido: {
          type: 'string',
          description: 'Contenido markdown del artefacto principal (context.md)',
        },
        force: {
          type: 'boolean',
          description: 'Si true, sobrescribe el KI si ya existe',
          default: false,
        },
      },
      required: ['titulo', 'resumen', 'contenido'],
    },
  },
  {
    name: 'update_ki',
    description: 'Actualiza el contenido de un KI existente. Actualiza metadata y/o context.md.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID del KI a actualizar',
        },
        resumen: {
          type: 'string',
          description: 'Nuevo resumen (opcional)',
        },
        contenido: {
          type: 'string',
          description: 'Nuevo contenido para context.md (opcional)',
        },
      },
      required: ['id'],
    },
  },
];

/* ─── Handlers de herramientas ───────────────────────────────── */

function shortDate(iso) {
  if (!iso) return '?';
  return String(iso).substring(0, 10);
}

function handleTool(name, args) {
  switch (name) {
    case 'list_kis': {
      const { query = '', limit = 60, offset = 0, verbose = false } = args;
      let items = listKIs();
      const total = items.length;

      // Filtro opcional por texto en id/título/resumen
      let filtered = items;
      if (query && String(query).trim()) {
        const q = String(query).toLowerCase();
        filtered = items.filter(ki =>
          ki.id.toLowerCase().includes(q) ||
          ki.titulo.toLowerCase().includes(q) ||
          (ki.resumen || '').toLowerCase().includes(q)
        );
      }
      const matched = filtered.length;
      const lim = Math.max(1, Number(limit) || 60);
      const off = Math.max(0, Number(offset) || 0);
      const page = filtered.slice(off, off + lim);

      const body = page.length === 0
        ? '(sin resultados en este rango)'
        : verbose
          ? page.map(ki =>
              `**${ki.id}**\n` +
              `  Título: ${ki.titulo}\n` +
              `  Resumen: ${ki.resumen.substring(0, 120)}${ki.resumen.length > 120 ? '…' : ''}\n` +
              `  Artefactos: ${ki.artefactos.join(', ') || '(ninguno)'}\n` +
              `  Actualizado: ${shortDate(ki.actualizadoEn)}`
            ).join('\n\n')
          : page.map(ki => `- ${ki.id} — ${ki.titulo}`).join('\n');

      const shownTo = off + page.length;
      const more = shownTo < matched;
      const header =
        `# KIs en Antigravity Brain\n` +
        `Total: ${total}${query ? ` · Filtrados por "${query}": ${matched}` : ''} · Mostrando ${matched ? off + 1 : 0}–${shownTo}` +
        (more ? ` (hay más: usa offset=${shownTo})` : '') + '\n' +
        (verbose ? '' : `Compacto (id — título). Usa search_kis para buscar, o verbose=true / get_ki para detalle.\n`);

      return { content: [{ type: 'text', text: `${header}\n${body}` }] };
    }

    case 'get_ki': {
      const { id, full = true, artifact = null } = args;
      const ki = getKI(id, { full, artifact });
      if (!ki) {
        return {
          content: [{ type: 'text', text: `KI no encontrado: "${id}"\n\nUsa list_kis o search_kis para ver los IDs disponibles.` }],
          isError: true,
        };
      }
      if (artifact && ki.artefactos.length === 0) {
        return {
          content: [{ type: 'text', text: `El KI "${id}" no tiene un artefacto llamado "${artifact}". Artefactos disponibles: ${ki.artefactosOmitidos.join(', ') || '(ninguno)'}` }],
          isError: true,
        };
      }
      const artText = ki.artefactos.length === 0
        ? '(sin artefactos)'
        : ki.artefactos.map(a =>
            `### ${a.nombre} (${a.tamaño})\n\n${a.contenido || '(vacío)'}`
          ).join('\n\n---\n\n');

      const omittedNote = (ki.artefactosOmitidos && ki.artefactosOmitidos.length)
        ? `\n\n> Este KI tiene ${ki.totalArtefactos} artefactos. Mostrados arriba los principales. Otros (pide con \`get_ki(id, artifact="<nombre>")\`): ${ki.artefactosOmitidos.join(', ')}`
        : '';

      const text =
        `# ${ki.titulo}\n\n` +
        `**ID:** ${ki.id}\n` +
        `**Resumen:** ${ki.resumen}\n` +
        `**Creado:** ${ki.creadoEn || 'desconocido'}\n` +
        `**Actualizado:** ${ki.actualizadoEn || 'desconocido'}\n` +
        (ki.referencias.length > 0 ? `**Referencias:** ${ki.referencias.join(', ')}\n` : '') +
        `\n## Artefactos\n\n${artText}${omittedNote}`;

      return { content: [{ type: 'text', text }] };
    }

    case 'search_kis': {
      const { query, limit = 10 } = args;
      if (!query || !String(query).trim()) {
        return { content: [{ type: 'text', text: 'Falta el parámetro query' }], isError: true };
      }
      const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
      const lim = Math.max(1, Number(limit) || 10);
      const allKIs = listKIs();
      const scored = [];

      for (const ki of allKIs) {
        const titleL = ki.titulo.toLowerCase();
        const summaryL = (ki.resumen || '').toLowerCase();

        // ¿Hace falta leer el contenido? Solo si algún término no está ya en título/resumen.
        const needContent = terms.some(t => !titleL.includes(t) && !summaryL.includes(t));
        const contentL = needContent ? readAllArtifactText(ki.id).toLowerCase() : '';

        // AND: todos los términos deben aparecer en algún campo.
        let score = 0;
        let allMatch = true;
        let bestField = '';
        for (const t of terms) {
          if (titleL.includes(t)) { score += 3; bestField = bestField || 'título'; }
          else if (summaryL.includes(t)) { score += 2; bestField = bestField || 'resumen'; }
          else if (contentL.includes(t)) { score += 1; bestField = bestField || 'contenido'; }
          else { allMatch = false; break; }
        }
        if (!allMatch) continue;

        // Snippet alrededor del primer término no presente en título/resumen.
        let snippet = '';
        const hay = contentL || summaryL;
        const t0 = terms.find(t => hay.includes(t)) || terms[0];
        const idx = hay.indexOf(t0);
        if (idx >= 0 && contentL) {
          const raw = readAllArtifactText(ki.id);
          const s = Math.max(0, idx - 80), e = Math.min(raw.length, idx + 120);
          snippet = `…${raw.substring(s, e).replace(/\s+/g, ' ').trim()}…`;
        }

        scored.push({ id: ki.id, titulo: ki.titulo, resumen: ki.resumen, score, matchIn: bestField, snippet });
      }

      scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
      const top = scored.slice(0, lim);

      const text = top.length === 0
        ? `No se encontraron KIs con "${query}"`
        : top.map(r =>
            `**${r.id}** (match en ${r.matchIn}, score ${r.score})\n` +
            `  ${r.titulo}\n` +
            `  ${r.resumen.substring(0, 100)}${r.resumen.length > 100 ? '…' : ''}` +
            (r.snippet ? `\n  > ${r.snippet}` : '')
          ).join('\n\n');

      const more = scored.length > top.length ? ` (mostrando top ${top.length}; sube limit para ver más)` : '';
      return {
        content: [{ type: 'text', text: `# Búsqueda: "${query}" — ${scored.length} resultado(s)${more}\n\n${text}` }],
      };
    }

    case 'create_ki': {
      const { titulo, resumen, contenido, force = false } = args;
      if (!titulo || !resumen || !contenido) {
        return {
          content: [{ type: 'text', text: 'Faltan parámetros obligatorios: titulo, resumen, contenido' }],
          isError: true,
        };
      }
      try {
        const result = createOrUpdateKI({ titulo, resumen, contenido, force });
        const action = result.created ? 'creado' : 'ya existía (usa force=true para sobrescribir)';
        return {
          content: [{
            type: 'text',
            text: `KI ${action}.\n\n**ID:** ${result.id}\n**Ruta:** ${path.join(AG_KNOWLEDGE, result.id)}\n\nAntigravity Brain lo usará en futuras conversaciones.`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }

    case 'update_ki': {
      const { id, resumen, contenido } = args;
      if (!id) {
        return { content: [{ type: 'text', text: 'Falta el parámetro id' }], isError: true };
      }
      const kiDir = path.join(AG_KNOWLEDGE, id);
      if (!fs.existsSync(kiDir)) {
        return { content: [{ type: 'text', text: `KI no encontrado: "${id}"` }], isError: true };
      }
      try {
        const metaPath = path.join(kiDir, 'metadata.json');
        const meta = safeReadJson(metaPath) || {};
        const updated = {
          ...meta,
          updatedAt: new Date().toISOString(),
        };
        if (resumen) updated.summary = resumen;
        fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2));

        if (contenido) {
          const artDir = path.join(kiDir, 'artifacts');
          fs.mkdirSync(artDir, { recursive: true });
          fs.writeFileSync(path.join(artDir, 'context.md'), contenido, 'utf-8');
        }

        return {
          content: [{
            type: 'text',
            text: `KI "${id}" actualizado correctamente.\n${resumen ? '- Resumen actualizado\n' : ''}${contenido ? '- context.md actualizado\n' : ''}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: 'text', text: `Herramienta desconocida: ${name}` }], isError: true };
  }
}

/* ─── Protocolo MCP (JSON-RPC 2.0 sobre stdio) ───────────────── */

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function handleRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'antigravity-ki-store', version: '1.1.0' },
      },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // No response needed for notifications
    return;
  }

  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      const result = handleTool(name, args || {});
      send({ jsonrpc: '2.0', id, result });
    } catch (err) {
      send({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: `Error interno: ${err.message}` }],
          isError: true,
        },
      });
    }
    return;
  }

  // Unknown method
  send({
    jsonrpc: '2.0', id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

/* ─── Main: leer stdin línea a línea ─────────────────────────── */

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    handleRequest(req);
  } catch (err) {
    send({
      jsonrpc: '2.0', id: null,
      error: { code: -32700, message: `Parse error: ${err.message}` },
    });
  }
});

rl.on('close', () => process.exit(0));

process.stderr.write(`[Antigravity KI MCP] Servidor iniciado. Almacén: ${AG_KNOWLEDGE}\n`);
