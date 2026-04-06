#!/usr/bin/env node
/**
 * CLI para leer/escribir KIs en el mismo almacén que Antigravity Brain
 * (~/.openbrain/knowledge/). Misma forma que ipc ag:create-ki / ag:get-knowledge.
 */
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const AG_KNOWLEDGE = path.join(os.homedir(), '.gemini', 'antigravity', 'knowledge');

function safeReadJson(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function safeReadText(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch {
    return null;
  }
}

function slugFromTitle(titulo) {
  return titulo
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function listKIs() {
  const items = [];
  if (!fs.existsSync(AG_KNOWLEDGE)) {
    return items;
  }
  const entries = fs.readdirSync(AG_KNOWLEDGE, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'knowledge.lock') continue;
    const metaPath = path.join(AG_KNOWLEDGE, entry.name, 'metadata.json');
    const meta = safeReadJson(metaPath);
    if (!meta) continue;
    const artifactsDir = path.join(AG_KNOWLEDGE, entry.name, 'artifacts');
    let artifactNames = [];
    try {
      artifactNames = fs
        .readdirSync(artifactsDir, { withFileTypes: true })
        .filter((a) => a.isFile())
        .map((a) => a.name);
    } catch {
      /* no artifacts */
    }
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
  items.sort((a, b) => (a.id < b.id ? -1 : 1));
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
      if (!full && contenido && contenido.length > 2000) {
        contenido = contenido.substring(0, 2000);
      }
      artifactFiles.push({
        nombre: af.name,
        contenido,
        tamaño: fs.statSync(afPath).size,
      });
    }
  } catch {
    /* no dir */
  }
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

function createKI({ titulo, resumen, contenido, force }) {
  const id = slugFromTitle(titulo);
  const kiDir = path.join(AG_KNOWLEDGE, id);
  if (fs.existsSync(kiDir) && !force) {
    throw new Error(`Ya existe KI "${id}". Usa --force para sobrescribir.`);
  }
  const artifactsDir = path.join(kiDir, 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  const now = new Date().toISOString();
  const metadata = {
    title: titulo,
    summary: resumen,
    createdAt: now,
    updatedAt: now,
    references: [],
  };
  fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  if (contenido) {
    fs.writeFileSync(path.join(artifactsDir, 'context.md'), contenido, 'utf-8');
  }
  return id;
}

function printHelp() {
  console.log(`Uso: node scripts/ki-cli.mjs <comando> [opciones]

Almacén: ${AG_KNOWLEDGE}

Comandos:
  list                    Lista todos los KIs (id, título, resumen, archivos en artifacts/)
  get <id>                Muestra metadata + contenido completo de artifacts (JSON)
  create                  Crea un KI (misma lógica que la app Electron)

Opciones create:
  --title "..."           Obligatorio
  --summary "..."         Obligatorio
  --content "..."         Texto del artifact principal (context.md)
  --file <ruta>           Leer contenido desde archivo (prioridad sobre --content)
  --force                 Sobrescribir carpeta si ya existe
`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--title') out.title = argv[++i];
    else if (a === '--summary') out.summary = argv[++i];
    else if (a === '--content') out.content = argv[++i];
    else if (a === '--file') out.file = argv[++i];
    else if (a === '--force') out.force = true;
    else if (a.startsWith('-')) throw new Error(`Opción desconocida: ${a}`);
    else out._.push(a);
  }
  return out;
}

const [, , cmd, ...rest] = process.argv;

try {
  if (!cmd || cmd === 'help' || cmd === '-h') {
    printHelp();
    process.exit(0);
  }

  if (cmd === 'list') {
    const items = listKIs();
    console.log(JSON.stringify({ base: AG_KNOWLEDGE, total: items.length, items }, null, 2));
    process.exit(0);
  }

  if (cmd === 'get') {
    const id = rest[0];
    if (!id) {
      console.error('Falta id: ki-cli get <id>');
      process.exit(1);
    }
    const ki = getKI(id, { full: true });
    if (!ki) {
      console.error(`KI no encontrado: ${id}`);
      process.exit(1);
    }
    console.log(JSON.stringify(ki, null, 2));
    process.exit(0);
  }

  if (cmd === 'create') {
    const args = parseArgs(rest);
    if (!args.title || !args.summary) {
      console.error('create requiere --title y --summary');
      printHelp();
      process.exit(1);
    }
    let contenido = args.content || '';
    if (args.file) {
      contenido = safeReadText(path.resolve(args.file));
      if (contenido === null) {
        console.error(`No se pudo leer: ${args.file}`);
        process.exit(1);
      }
    }
    const id = createKI({
      titulo: args.title,
      resumen: args.summary,
      contenido,
      force: args.force,
    });
    console.log(JSON.stringify({ exito: true, id, mensaje: `KI creado: ${id}`, ruta: path.join(AG_KNOWLEDGE, id) }, null, 2));
    process.exit(0);
  }

  console.error(`Comando desconocido: ${cmd}`);
  printHelp();
  process.exit(1);
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
