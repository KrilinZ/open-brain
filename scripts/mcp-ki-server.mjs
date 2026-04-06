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

const AG_KNOWLEDGE = path.join(os.homedir(), '.gemini', 'antigravity', 'knowledge');

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

function getKI(id, { full = true } = {}) {
  const kiDir = path.join(AG_KNOWLEDGE, id);
  const metaPath = path.join(kiDir, 'metadata.json');
  const meta = safeReadJson(metaPath);
  if (!meta) return null;

  const artifactsDir = path.join(kiDir, 'artifacts');
  const artifactFiles = [];
  try {
    const aFiles = fs.readdirSync(artifactsDir, { withFileTypes: true });
    for (const af of aFiles) {
      if (!af.isFile()) continue;
      const afPath = path.join(artifactsDir, af.name);
      let contenido = safeReadText(afPath);
      if (!full && contenido && contenido.length > 3000) {
        contenido = contenido.substring(0, 3000) + '\n\n[... truncado, usa get_ki con full=true para ver completo]';
      }
      artifactFiles.push({
        nombre: af.name,
        contenido,
        tamaño: formatBytes(fs.statSync(afPath).size),
      });
    }
  } catch { /* no dir */ }

  return {
    id,
    titulo: meta.title || id,
    resumen: meta.summary || '',
    referencias: meta.references || [],
    creadoEn: meta.createdAt || null,
    actualizadoEn: meta.updatedAt || null,
    artefactos: artifactFiles,
  };
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
    description: 'Lista todos los Knowledge Items (KIs) del almacén de Antigravity Brain. Devuelve id, título, resumen, artefactos y fechas de cada KI.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_ki',
    description: 'Lee el contenido completo de un Knowledge Item por su id. Incluye metadata y el contenido de todos sus artefactos (context.md, etc.).',
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
      },
      required: ['id'],
    },
  },
  {
    name: 'search_kis',
    description: 'Busca KIs cuyo título, resumen o contenido de artefactos contenga el texto buscado.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto a buscar (case-insensitive)',
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

function handleTool(name, args) {
  switch (name) {
    case 'list_kis': {
      const items = listKIs();
      const text = items.length === 0
        ? `No hay KIs en ${AG_KNOWLEDGE}`
        : items.map(ki =>
            `**${ki.id}**\n` +
            `  Título: ${ki.titulo}\n` +
            `  Resumen: ${ki.resumen.substring(0, 120)}${ki.resumen.length > 120 ? '…' : ''}\n` +
            `  Artefactos: ${ki.artefactos.join(', ') || '(ninguno)'}\n` +
            `  Actualizado: ${ki.actualizadoEn || 'desconocido'}`
          ).join('\n\n');
      return {
        content: [{ type: 'text', text: `# KIs en Antigravity Brain (${items.length} total)\n\nAlmacén: ${AG_KNOWLEDGE}\n\n${text}` }],
      };
    }

    case 'get_ki': {
      const { id, full = true } = args;
      const ki = getKI(id, { full });
      if (!ki) {
        return {
          content: [{ type: 'text', text: `KI no encontrado: "${id}"\n\nUsa list_kis para ver los IDs disponibles.` }],
          isError: true,
        };
      }
      const artText = ki.artefactos.length === 0
        ? '(sin artefactos)'
        : ki.artefactos.map(a =>
            `### ${a.nombre} (${a.tamaño})\n\n${a.contenido || '(vacío)'}`
          ).join('\n\n---\n\n');

      const text =
        `# ${ki.titulo}\n\n` +
        `**ID:** ${ki.id}\n` +
        `**Resumen:** ${ki.resumen}\n` +
        `**Creado:** ${ki.creadoEn || 'desconocido'}\n` +
        `**Actualizado:** ${ki.actualizadoEn || 'desconocido'}\n` +
        (ki.referencias.length > 0 ? `**Referencias:** ${ki.referencias.join(', ')}\n` : '') +
        `\n## Artefactos\n\n${artText}`;

      return { content: [{ type: 'text', text }] };
    }

    case 'search_kis': {
      const { query } = args;
      if (!query) {
        return { content: [{ type: 'text', text: 'Falta el parámetro query' }], isError: true };
      }
      const q = query.toLowerCase();
      const allKIs = listKIs();
      const results = [];

      for (const ki of allKIs) {
        const inTitle = ki.titulo.toLowerCase().includes(q);
        const inSummary = ki.resumen.toLowerCase().includes(q);
        let inContent = false;
        let matchSnippet = '';

        if (!inTitle && !inSummary) {
          // Search in artifact content
          const full = getKI(ki.id, { full: true });
          for (const art of full?.artefactos || []) {
            if (art.contenido?.toLowerCase().includes(q)) {
              inContent = true;
              const idx = art.contenido.toLowerCase().indexOf(q);
              const start = Math.max(0, idx - 80);
              const end = Math.min(art.contenido.length, idx + 120);
              matchSnippet = `…${art.contenido.substring(start, end)}…`;
              break;
            }
          }
        }

        if (inTitle || inSummary || inContent) {
          results.push({
            id: ki.id,
            titulo: ki.titulo,
            resumen: ki.resumen,
            matchIn: inTitle ? 'título' : inSummary ? 'resumen' : 'contenido',
            snippet: matchSnippet,
          });
        }
      }

      const text = results.length === 0
        ? `No se encontraron KIs con "${query}"`
        : results.map(r =>
            `**${r.id}** (match en ${r.matchIn})\n` +
            `  ${r.titulo}\n` +
            `  ${r.resumen.substring(0, 100)}${r.resumen.length > 100 ? '…' : ''}` +
            (r.snippet ? `\n  > ${r.snippet}` : '')
          ).join('\n\n');

      return {
        content: [{ type: 'text', text: `# Búsqueda: "${query}" — ${results.length} resultado(s)\n\n${text}` }],
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
        serverInfo: { name: 'antigravity-ki-store', version: '1.0.0' },
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
