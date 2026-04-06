#!/usr/bin/env node
/**
 * KI Daemon — Extractor automático de Knowledge Items
 * 
 * Cada 5 minutos (vía launchd) escanea las conversaciones recientes de
 * ~/.gemini/antigravity/brain/, envía el contenido a Ollama Llama 3.2 1B,
 * y crea/actualiza KIs automáticamente en ~/.gemini/antigravity/knowledge/.
 * 
 * Uso manual: node scripts/ki-daemon.mjs [--force] [--dry-run]
 *   --force   Ignora el timestamp de último escaneo y procesa todo
 *   --dry-run Muestra qué haría sin escribir nada
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// ═══ CONFIG ═══
const HOME = os.homedir();
const BRAIN_DIR = path.join(HOME, '.openbrain', 'brain');
const KNOWLEDGE_DIR = path.join(HOME, '.openbrain', 'knowledge');
const STATE_FILE = path.join(HOME, '.openbrain', '.ki-daemon-state.json');
const LOG_FILE = path.join(HOME, '.openbrain', '.ki-daemon.log');
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2:1b';
const MAX_CONTENT_CHARS = 8000; // Límite de contexto para el modelo 1B
const MIN_CONTENT_CHARS = 200;  // Mínimo para que valga la pena analizar
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// ═══ ARGS ═══
const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

// ═══ LOGGING ═══
function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* ignore */ }
}

// ═══ STATE MANAGEMENT ═══
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { lastScan: 0, processed: {} };
  }
}

function saveState(state) {
  if (DRY_RUN) return;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ═══ SCAN CONVERSATIONS ═══
function getRecentConversations(state) {
  if (!fs.existsSync(BRAIN_DIR)) {
    log('WARN', `Brain directory not found: ${BRAIN_DIR}`);
    return [];
  }

  const conversations = [];
  const entries = fs.readdirSync(BRAIN_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const convId = entry.name;
    const overviewPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'overview.txt');
    
    if (!fs.existsSync(overviewPath)) continue;

    const stat = fs.statSync(overviewPath);
    const modifiedMs = stat.mtimeMs;

    // Skip if already processed and not modified since
    if (!FORCE && state.processed[convId] && state.processed[convId] >= modifiedMs) {
      continue;
    }

    conversations.push({
      id: convId,
      overviewPath,
      modifiedMs,
      size: stat.size
    });
  }

  // Sort by most recently modified first
  conversations.sort((a, b) => b.modifiedMs - a.modifiedMs);

  log('INFO', `Found ${conversations.length} conversation(s) to process`);
  return conversations;
}

// ═══ EXTRACT CONTENT ═══
function extractContent(conv) {
  try {
    let content = fs.readFileSync(conv.overviewPath, 'utf-8');
    
    // Take only the tail (most recent activity) if too long
    if (content.length > MAX_CONTENT_CHARS) {
      content = '...[TRUNCADO]...\n' + content.slice(-MAX_CONTENT_CHARS);
    }

    if (content.length < MIN_CONTENT_CHARS) {
      log('SKIP', `Conversation ${conv.id.slice(0, 8)}... too short (${content.length} chars)`);
      return null;
    }

    return content;
  } catch (e) {
    log('ERROR', `Failed to read ${conv.overviewPath}: ${e.message}`);
    return null;
  }
}

// ═══ LIST EXISTING KIs ═══
function getExistingKIs() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [];
  
  const kis = [];
  const entries = fs.readdirSync(KNOWLEDGE_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const metaPath = path.join(KNOWLEDGE_DIR, entry.name, 'metadata.json');
    if (!fs.existsSync(metaPath)) continue;

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      kis.push({
        slug: entry.name,
        title: meta.title || entry.name,
        summary: meta.summary || ''
      });
    } catch { /* skip malformed */ }
  }

  return kis;
}

// ═══ OLLAMA INTERACTION ═══
async function askOllama(conversationContent, existingKIs) {
  const kiList = existingKIs.map(ki => `- "${ki.title}" (${ki.slug})`).join('\n');

  const prompt = `Eres un sistema de extracción de conocimiento. Analiza esta conversación de desarrollo y decide si contiene información que merece guardarse como Knowledge Item (KI) persistente.

REGLAS ESTRICTAS:
- Solo extraer PATRONES TÉCNICOS REUTILIZABLES, BUGS CON FIX, o CAMBIOS ARQUITECTÓNICOS SIGNIFICATIVOS
- NO extraer charla casual, preguntas simples, ni tareas triviales
- NO duplicar KIs existentes. Si el tema ya está cubierto, responde UPDATE
- Ser CONCISO: el context.md no debe superar 100 líneas

KIs EXISTENTES:
${kiList || '(ninguna)'}

CONVERSACIÓN A ANALIZAR:
${conversationContent}

RESPONDE EN FORMATO JSON EXACTO (sin markdown, sin backticks):
Si NO hay nada que guardar:
{"action":"NONE","reason":"breve explicación"}

Si hay que CREAR una KI nueva:
{"action":"CREATE","slug":"nombre-descriptivo-kebab-case","title":"Título Claro","summary":"1-2 frases de resumen","content":"Contenido markdown del context.md"}

Si hay que ACTUALIZAR una KI existente:
{"action":"UPDATE","slug":"slug-existente","appendContent":"Contenido adicional a añadir al context.md existente","newSummary":"Resumen actualizado si cambió significativamente"}

RESPONDE SOLO CON EL JSON, NADA MÁS:`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw = data.response?.trim();

    if (!raw) {
      log('WARN', 'Ollama returned empty response');
      return null;
    }

    // Try to parse JSON from response, handling potential markdown wrapping
    let jsonStr = raw;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    return JSON.parse(jsonStr);
  } catch (e) {
    log('ERROR', `Ollama call failed: ${e.message}`);
    return null;
  }
}

// ═══ WRITE KI ═══
function writeKI(action) {
  const now = new Date().toISOString();

  if (action.action === 'CREATE') {
    const kiDir = path.join(KNOWLEDGE_DIR, action.slug);
    const artifactsDir = path.join(kiDir, 'artifacts');

    if (fs.existsSync(kiDir)) {
      log('WARN', `KI ${action.slug} already exists, skipping CREATE`);
      return false;
    }

    if (DRY_RUN) {
      log('DRY', `Would CREATE KI: ${action.slug} — "${action.title}"`);
      return true;
    }

    fs.mkdirSync(artifactsDir, { recursive: true });

    const metadata = {
      title: action.title,
      summary: action.summary,
      createdAt: now,
      updatedAt: now,
      source: 'ki-daemon-auto'
    };
    fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    fs.writeFileSync(path.join(artifactsDir, 'context.md'), action.content);

    log('CREATE', `New KI: ${action.slug} — "${action.title}"`);
    return true;

  } else if (action.action === 'UPDATE') {
    const kiDir = path.join(KNOWLEDGE_DIR, action.slug);
    const contextPath = path.join(kiDir, 'artifacts', 'context.md');
    const metaPath = path.join(kiDir, 'metadata.json');

    if (!fs.existsSync(kiDir)) {
      log('WARN', `KI ${action.slug} not found for UPDATE`);
      return false;
    }

    if (DRY_RUN) {
      log('DRY', `Would UPDATE KI: ${action.slug}`);
      return true;
    }

    // Append content
    if (action.appendContent && fs.existsSync(contextPath)) {
      const existing = fs.readFileSync(contextPath, 'utf-8');
      fs.writeFileSync(contextPath, existing + '\n\n---\n\n' + action.appendContent);
    }

    // Update metadata
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        meta.updatedAt = now;
        if (action.newSummary) meta.summary = action.newSummary;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      } catch { /* ignore */ }
    }

    log('UPDATE', `Updated KI: ${action.slug}`);
    return true;
  }

  return false;
}

// ═══ HEALTH CHECK ═══
async function checkOllama() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) return false;
    const data = await res.json();
    const hasModel = data.models?.some(m => m.name?.startsWith('llama3.2'));
    if (!hasModel) {
      log('WARN', `Model ${MODEL} not found in Ollama`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ═══ MAIN ═══
async function main() {
  log('INFO', `=== KI Daemon started (force=${FORCE}, dry=${DRY_RUN}) ===`);

  // Health check
  const ollamaOk = await checkOllama();
  if (!ollamaOk) {
    log('ABORT', 'Ollama not running or model not available. Exiting.');
    process.exit(0); // Exit clean so launchd doesn't spam retries
  }

  // Load state
  const state = loadState();

  // Scan conversations
  const conversations = getRecentConversations(state);
  if (conversations.length === 0) {
    log('INFO', 'No new conversations to process. Done.');
    state.lastScan = Date.now();
    saveState(state);
    process.exit(0);
  }

  // Get existing KIs for dedup
  const existingKIs = getExistingKIs();
  log('INFO', `${existingKIs.length} existing KIs loaded for dedup`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Process each conversation (limit to 3 per run to avoid overloading)
  const batch = conversations.slice(0, 3);

  for (const conv of batch) {
    log('INFO', `Processing conversation ${conv.id.slice(0, 8)}...`);

    const content = extractContent(conv);
    if (!content) {
      state.processed[conv.id] = conv.modifiedMs;
      continue;
    }

    const decision = await askOllama(content, existingKIs);
    if (!decision) {
      log('WARN', `No decision from Ollama for ${conv.id.slice(0, 8)}...`);
      continue;
    }

    if (decision.action === 'NONE') {
      log('SKIP', `${conv.id.slice(0, 8)}... — ${decision.reason || 'no KI-worthy content'}`);
      skipped++;
    } else if (decision.action === 'CREATE' || decision.action === 'UPDATE') {
      const ok = writeKI(decision);
      if (ok) {
        if (decision.action === 'CREATE') {
          created++;
          existingKIs.push({ slug: decision.slug, title: decision.title, summary: decision.summary });
        } else {
          updated++;
        }
      }
    }

    // Mark as processed
    state.processed[conv.id] = conv.modifiedMs;
  }

  // Save state
  state.lastScan = Date.now();
  saveState(state);

  log('INFO', `=== Done: ${created} created, ${updated} updated, ${skipped} skipped ===`);
}

main().catch(e => {
  log('FATAL', e.message);
  process.exit(1);
});
