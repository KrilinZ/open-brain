import { app, BrowserWindow, Menu, ipcMain, shell, nativeImage, Tray, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

// Lock the app identity immediately
app.name = 'Open Brain';
app.setAppUserModelId('com.openbrain.app');

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AG_BASE = path.join(app.getPath('home'), '.openbrain');
const AG_BRAIN = path.join(AG_BASE, 'brain');
const AG_CONVERSATIONS = path.join(AG_BASE, 'conversations');
const AG_KNOWLEDGE = path.join(AG_BASE, 'knowledge');
const AG_IMPLICIT = path.join(AG_BASE, 'implicit');

const DEBUG_LOG = path.join(AG_BASE, 'openbrain-debug.log');

function debugLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try {
    if (!fs.existsSync(AG_BASE)) fs.mkdirSync(AG_BASE, { recursive: true });
    fs.appendFileSync(DEBUG_LOG, line);
  } catch (e) {}
}

debugLog('>>> APP_STARTUP_INIT <<<');

/* ════════════════════════════════════════════════════════════════
   SINGLE INSTANCE LOCK (Production Only)
   In dev mode we allow multiple runs (e.g. after Cmd+Q restart)
   ════════════════════════════════════════════════════════════════ */

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

if (!isDev) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    debugLog('Lock DENIED — sending focus to existing instance.');
    app.quit();
    process.exit(0);
  }
  debugLog('Lock GRANTED (production).');
} else {
  debugLog('Dev mode — skipping Single Instance Lock.');
}

let mainWindow = null;
let isQuitting = false;

/* ════════════════════════════════════════════════════════════════
   UTILIDADES
   ════════════════════════════════════════════════════════════════ */

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

function getDirectorySize(dirPath) {
  let totalSize = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        try {
          const fullPath = path.join(entry.parentPath || entry.path || dirPath, entry.name);
          totalSize += fs.statSync(fullPath).size;
        } catch { /* skip inaccessible files */ }
      }
    }
  } catch { /* dir not found */ }
  return totalSize;
}

function countFiles(dirPath, extension) {
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
        count++;
      }
    }
  } catch { /* dir not found */ }
  return count;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function countDirectories(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'tempmediaStorage' && !d.name.startsWith('.'))
      .length;
  } catch {
    return 0;
  }
}

/**
 * Extract a human-readable title for a session from its artifacts.
 * Priority: walkthrough summary > implementation_plan summary > task summary > first .md summary > session ID prefix
 */
function extractSessionTitle(sessionPath, sessionId) {
  const priorities = [
    'walkthrough.md.metadata.json',
    'implementation_plan.md.metadata.json',
    'task.md.metadata.json',
  ];

  for (const metaFile of priorities) {
    const meta = safeReadJson(path.join(sessionPath, metaFile));
    if (meta?.summary) {
      // Take first 80 chars of the summary
      const summary = meta.summary.substring(0, 80);
      return summary.length < meta.summary.length ? summary + '…' : summary;
    }
  }

  // Try to read the first line of walkthrough.md or implementation_plan.md
  for (const mdFile of ['walkthrough.md', 'implementation_plan.md']) {
    const content = safeReadText(path.join(sessionPath, mdFile));
    if (content) {
      const firstLine = content.split('\n').find(l => l.trim().startsWith('#'));
      if (firstLine) {
        return firstLine.replace(/^#+\s*/, '').substring(0, 80);
      }
    }
  }

  // Fallback: short ID
  return sessionId.substring(0, 12) + '…';
}

/* ════════════════════════════════════════════════════════════════
   IPC HANDLERS
   ════════════════════════════════════════════════════════════════ */

// Listar sesiones con metadatos reales (brain + implicit)
ipcMain.handle('ag:get-sessions', async () => {
  const sessions = [];

  // Helper to process a conversations directory and brain directory pair
  function processSessionDirs(brainDir, convDir, source) {
    try {
      if (!fs.existsSync(brainDir)) return;
      const brainDirs = fs.readdirSync(brainDir, { withFileTypes: true });
      for (const dir of brainDirs) {
        if (!dir.isDirectory() || dir.name === 'tempmediaStorage' || dir.name.startsWith('.')) continue;

        const sessionId = dir.name;
        const sessionPath = path.join(brainDir, sessionId);
        const convPath = path.join(convDir, `${sessionId}.pb`);

        // Leer metadatos de artefactos
        const artifacts = [];
        let files = [];
        try { files = fs.readdirSync(sessionPath); } catch { continue; }

        for (const file of files) {
          if (file.endsWith('.metadata.json')) {
            const meta = safeReadJson(path.join(sessionPath, file));
            if (meta) {
              artifacts.push({
                name: file.replace('.metadata.json', ''),
                type: meta.artifactType,
                summary: meta.summary,
                updatedAt: meta.updatedAt,
                version: meta.version,
              });
            }
          }
        }

        // Obtener tamaño de conversación PB
        let convSize = 0;
        let convModified = null;
        try {
          const stat = fs.statSync(convPath);
          convSize = stat.size;
          convModified = stat.mtime.toISOString();
        } catch {
          // Try getting modification from the session directory itself
          try {
            const stat = fs.statSync(sessionPath);
            convModified = stat.mtime.toISOString();
          } catch { /* */ }
        }

        // Determinar estado basado en tamaño y antigüedad
        const totalArtifacts = artifacts.length;
        let estado = 'Saludable';
        if (convSize > 5 * 1024 * 1024) estado = 'En riesgo'; // >5MB = riesgo
        if (totalArtifacts === 0 && convSize < 1000) estado = 'Archivado';

        // Extraer título legible
        const titulo = extractSessionTitle(sessionPath, sessionId);

        // Count resolved files  
        const resolvedCount = files.filter(f => f.includes('.resolved')).length;

        sessions.push({
          id: sessionId,
          titulo,
          estado,
          tamañoPB: convSize,
          tamañoPBFormateado: formatBytes(convSize),
          fechaModificacion: convModified,
          totalArtefactos: totalArtifacts,
          artefactos: artifacts,
          archivosResolved: resolvedCount,
          fuente: source, // 'brain' or 'implicit'
        });
      }
    } catch (err) {
      console.error(`Error leyendo sesiones de ${source}:`, err);
    }
  }

  // Process main brain sessions
  processSessionDirs(AG_BRAIN, AG_CONVERSATIONS, 'brain');

  // Process implicit sessions (if exist)
  if (fs.existsSync(AG_IMPLICIT)) {
    processSessionDirs(
      AG_IMPLICIT, // implicit conversations may have their own brain dirs
      AG_IMPLICIT, // and their own .pb files
      'implicit'
    );
  }

  // Deduplicar: si una sesión aparece en brain e implicit, mantener brain
  const seen = new Set();
  const deduped = sessions.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  // Ordenar por fecha de modificación (más recientes primero)
  deduped.sort((a, b) => {
    if (!a.fechaModificacion) return 1;
    if (!b.fechaModificacion) return -1;
    return new Date(b.fechaModificacion).getTime() - new Date(a.fechaModificacion).getTime();
  });

  return deduped;
});

// Leer artefactos de una sesión
ipcMain.handle('ag:get-session-artifacts', async (_event, sessionId) => {
  // Check both brain and implicit
  let sessionPath = path.join(AG_BRAIN, sessionId);
  if (!fs.existsSync(sessionPath)) {
    sessionPath = path.join(AG_IMPLICIT, sessionId);
  }

  const artifacts = [];
  try {
    const files = fs.readdirSync(sessionPath);
    for (const file of files) {
      if (file.endsWith('.metadata.json')) continue;
      if (file.includes('.resolved')) continue;
      if (file.startsWith('.')) continue;

      const filePath = path.join(sessionPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        const ext = path.extname(file);
        const isText = ['.md', '.txt', '.json'].includes(ext);
        artifacts.push({
          nombre: file,
          ruta: filePath,
          tamaño: formatBytes(stat.size),
          tamañoBytes: stat.size,
          fechaModificacion: stat.mtime.toISOString(),
          tipo: ext.replace('.', ''),
          esTexto: isText,
          esImagen: ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) && !file.includes('recording'),
          esVideo: ['.webp'].includes(ext) && file.includes('recording'),
        });
      }
    }
  } catch (err) {
    console.error('Error leyendo artefactos:', err);
  }
  return artifacts;
});

// Leer contenido crudo de la memoria del chat (Transcripción)
ipcMain.handle('ag:get-session-transcript', async (_event, sessionId) => {
  try {
    const overviewPath = path.join(AG_BRAIN, sessionId, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(overviewPath)) {
      return fs.readFileSync(overviewPath, 'utf-8');
    }
    // Also check implicit if it was somehow moved there
    const implicitPath = path.join(AG_IMPLICIT, sessionId, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(implicitPath)) {
      return fs.readFileSync(implicitPath, 'utf-8');
    }
    return null;
  } catch (err) {
    console.error('Error leyendo overview.txt:', err);
    return null;
  }
});

// Leer contenido de un artefacto
ipcMain.handle('ag:read-artifact', async (_event, sessionId, filename) => {
  try {
    let filePath = path.join(AG_BRAIN, sessionId, filename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(AG_IMPLICIT, sessionId, filename);
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
});

// Salud del sistema
ipcMain.handle('ag:get-system-health', async () => {
  const totalSize = getDirectorySize(AG_BASE);
  const totalConversations = countFiles(AG_CONVERSATIONS, '.pb');
  const totalArtifacts = countFiles(AG_BRAIN, '.md');
  const totalImages = countFiles(AG_BRAIN, '.png') + countFiles(AG_BRAIN, '.webp');

  // Count resolved files
  const totalResolved = countFiles(AG_BRAIN, '.resolved');

  // Calcular métricas
  const conversationSizes = [];
  try {
    const files = fs.readdirSync(AG_CONVERSATIONS);
    for (const file of files) {
      if (file.endsWith('.pb')) {
        const stat = fs.statSync(path.join(AG_CONVERSATIONS, file));
        conversationSizes.push(stat.size);
      }
    }
  } catch { /* */ }

  const bigConversations = conversationSizes.filter(s => s > 3 * 1024 * 1024).length;
  const sessionSafety = totalConversations > 0
    ? Math.round(100 - (bigConversations / totalConversations * 100))
    : 100;

  const brainSessions = countDirectories(AG_BRAIN);
  const promptExternalization = totalConversations > 0
    ? Math.min(100, Math.round((totalArtifacts / (totalConversations * 3)) * 100))
    : 0;

  const avgSize = conversationSizes.length > 0
    ? conversationSizes.reduce((a, b) => a + b, 0) / conversationSizes.length
    : 0;
  const contextRisk = Math.min(100, Math.round((avgSize / (5 * 1024 * 1024)) * 100));

  return {
    tamañoTotal: formatBytes(totalSize),
    tamañoTotalBytes: totalSize,
    totalConversaciones: totalConversations,
    totalArtefactos: totalArtifacts,
    totalImagenes: totalImages,
    totalSesionesBrain: brainSessions,
    totalResolved: totalResolved,
    seguridadSesiones: sessionSafety,
    externalizacionPrompts: promptExternalization,
    riesgoContexto: contextRisk,
    conversacionesGrandes: bigConversations,
    basePath: AG_BASE,
  };
});

// Obtener todos los outputs (archivos de la bóveda)
ipcMain.handle('ag:get-all-outputs', async () => {
  const outputs = [];
  try {
    const brainDirs = fs.readdirSync(AG_BRAIN, { withFileTypes: true });
    for (const dir of brainDirs) {
      if (!dir.isDirectory() || dir.name === 'tempmediaStorage' || dir.name.startsWith('.')) continue;

      const sessionPath = path.join(AG_BRAIN, dir.name);
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        if (file.endsWith('.metadata.json') || file.includes('.resolved')) continue;
        if (file.startsWith('.')) continue;

        const filePath = path.join(sessionPath, file);
        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) continue;

          const ext = path.extname(file).toLowerCase();
          let tipo = 'otro';
          if (['.md', '.txt'].includes(ext)) tipo = 'documento';
          if (['.png', '.jpg', '.jpeg'].includes(ext)) tipo = 'imagen';
          if (['.webp'].includes(ext)) tipo = file.includes('recording') ? 'grabación' : 'imagen';
          if (['.json'].includes(ext)) tipo = 'datos';

          outputs.push({
            titulo: file,
            sesionId: dir.name,
            ruta: filePath,
            tipo,
            tamaño: formatBytes(stat.size),
            tamañoBytes: stat.size,
            fechaModificacion: stat.mtime.toISOString(),
            sincronizado: true,
          });
        } catch { /* skip */ }
      }
    }
  } catch (err) {
    console.error('Error leyendo outputs:', err);
  }

  outputs.sort((a, b) => new Date(b.fechaModificacion).getTime() - new Date(a.fechaModificacion).getTime());
  return outputs;
});

// Crear respaldo
ipcMain.handle('ag:create-backup', async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupDir = path.join(app.getPath('desktop'), 'antigravity_backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `antigravity_backup_${timestamp}.zip`);
    execSync(`cd "${AG_BASE}" && zip -r "${backupFile}" . -x "*/node_modules/*"`, { timeout: 60000 });

    return {
      exito: true,
      ruta: backupFile,
      tamaño: formatBytes(fs.statSync(backupFile).size),
      mensaje: `Respaldo creado exitosamente en: ${backupFile}`,
    };
  } catch (err) {
    return {
      exito: false,
      mensaje: `Error al crear respaldo: ${err.message}`,
    };
  }
});

// Base de conocimiento
ipcMain.handle('ag:get-knowledge', async () => {
  const items = [];
  try {
    const entries = fs.readdirSync(AG_KNOWLEDGE, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = path.join(AG_KNOWLEDGE, entry.name, 'metadata.json');
        const meta = safeReadJson(metaPath);
        if (meta) {
          // Read artifact files in the knowledge item
          const artifactsDir = path.join(AG_KNOWLEDGE, entry.name, 'artifacts');
          const artifactFiles = [];
          try {
            const aFiles = fs.readdirSync(artifactsDir, { withFileTypes: true });
            for (const af of aFiles) {
              if (af.isFile()) {
                const afPath = path.join(artifactsDir, af.name);
                const afContent = safeReadText(afPath);
                artifactFiles.push({
                  nombre: af.name,
                  contenido: afContent ? afContent.substring(0, 250000) : null,
                  tamaño: formatBytes(fs.statSync(afPath).size),
                });
              }
            }
          } catch { /* no artifacts dir */ }

          items.push({
            id: entry.name,
            titulo: meta.title || meta.summary?.substring(0, 60) || entry.name,
            resumen: meta.summary || '',
            referencias: meta.references || [],
            creadoEn: meta.createdAt || null,
            actualizadoEn: meta.updatedAt || null,
            artefactos: artifactFiles,
          });
        }
      }
    }
  } catch { /* knowledge dir may not exist */ }
  return items;
});

// Abrir en Finder
ipcMain.handle('ag:open-in-finder', async (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ═══════════ NUEVOS HANDLERS ═══════════

// Abrir conversación en Antigravity (VS Code)
ipcMain.handle('ag:open-conversation', async (_event, sessionId) => {
  try {
    // Try to open the conversation's brain folder in VS Code / Antigravity
    const sessionPath = path.join(AG_BRAIN, sessionId);
    if (!fs.existsSync(sessionPath)) {
      return { exito: false, mensaje: 'No se encontró la sesión' };
    }

    // Try opening a relevant file (walkthrough > implementation_plan > first .md)
    const priority = ['walkthrough.md', 'implementation_plan.md', 'task.md'];
    let fileToOpen = null;
    for (const f of priority) {
      const fp = path.join(sessionPath, f);
      if (fs.existsSync(fp)) { fileToOpen = fp; break; }
    }

    if (!fileToOpen) {
      // Fallback: open the folder
      shell.openPath(sessionPath);
      return { exito: true, mensaje: `Carpeta abierta: ${sessionPath}` };
    }

    // Open in Antigravity IDE first, then VS Code, then default
    try {
      execSync(`open -a "Antigravity" "${fileToOpen}"`, { timeout: 5000 });
      return { exito: true, mensaje: `Abierto en Antigravity: ${path.basename(fileToOpen)}` };
    } catch {
      try {
        execSync(`open -a "Visual Studio Code" "${fileToOpen}"`, { timeout: 5000 });
        return { exito: true, mensaje: `Abierto en VS Code: ${path.basename(fileToOpen)}` };
      } catch {
        shell.openPath(fileToOpen);
        return { exito: true, mensaje: `Abierto: ${path.basename(fileToOpen)}` };
      }
    }
  } catch (err) {
    return { exito: false, mensaje: `Error: ${err.message}` };
  }
});

ipcMain.handle('ag:open-vault', async () => {
  try {
    const { shell } = require('electron');
    shell.openPath(AG_BASE);
    return { exito: true };
  } catch (err) {
    return { exito: false, mensaje: err.message };
  }
});

// Limpiar archivos .resolved
ipcMain.handle('ag:clean-resolved', async () => {
  let deleted = 0;
  let freedBytes = 0;
  const errors = [];

  try {
    const brainDirs = fs.readdirSync(AG_BRAIN, { withFileTypes: true });
    for (const dir of brainDirs) {
      if (!dir.isDirectory() || dir.name === 'tempmediaStorage') continue;

      const sessionPath = path.join(AG_BRAIN, dir.name);
      try {
        const files = fs.readdirSync(sessionPath);
        for (const file of files) {
          if (file.includes('.resolved')) {
            const filePath = path.join(sessionPath, file);
            try {
              const stat = fs.statSync(filePath);
              freedBytes += stat.size;
              fs.unlinkSync(filePath);
              deleted++;
            } catch (e) {
              errors.push(`No se pudo eliminar ${file}: ${e.message}`);
            }
          }
        }
      } catch { /* skip */ }
    }
  } catch (err) {
    return { exito: false, eliminados: 0, mensaje: `Error: ${err.message}` };
  }

  return {
    exito: true,
    eliminados: deleted,
    espacioLiberado: formatBytes(freedBytes),
    errores: errors,
    mensaje: deleted > 0
      ? `✅ Eliminados ${deleted} archivos .resolved (${formatBytes(freedBytes)} liberados)`
      : '✨ No se encontraron archivos .resolved para limpiar',
  };
});

// Verificar integridad
ipcMain.handle('ag:verify-integrity', async () => {
  const resultado = {
    conversacionesSinBrain: [],
    brainSinConversacion: [],
    artefactosSinMetadata: [],
    metadataSinArtefacto: [],
    archivosCorruptos: [],
    estadisticas: {},
  };

  try {
    // Get all conversation IDs
    const convIds = new Set();
    try {
      const convFiles = fs.readdirSync(AG_CONVERSATIONS);
      for (const f of convFiles) {
        if (f.endsWith('.pb')) convIds.add(f.replace('.pb', ''));
      }
    } catch { /* */ }

    // Get all brain session IDs
    const brainIds = new Set();
    try {
      const brainDirs = fs.readdirSync(AG_BRAIN, { withFileTypes: true });
      for (const d of brainDirs) {
        if (d.isDirectory() && d.name !== 'tempmediaStorage' && !d.name.startsWith('.')) {
          brainIds.add(d.name);
        }
      }
    } catch { /* */ }

    // Cross-reference
    for (const id of convIds) {
      if (!brainIds.has(id)) {
        resultado.conversacionesSinBrain.push(id.substring(0, 12) + '…');
      }
    }
    for (const id of brainIds) {
      if (!convIds.has(id)) {
        resultado.brainSinConversacion.push(id.substring(0, 12) + '…');
      }
    }

    // Check artifacts have metadata and vice versa
    for (const id of brainIds) {
      const sessionPath = path.join(AG_BRAIN, id);
      try {
        const files = fs.readdirSync(sessionPath);
        const mdFiles = files.filter(f => f.endsWith('.md') && !f.includes('.resolved') && !f.includes('.metadata'));
        const metaFiles = files.filter(f => f.endsWith('.metadata.json'));

        for (const md of mdFiles) {
          const expectedMeta = md + '.metadata.json';
          if (!files.includes(expectedMeta)) {
            resultado.artefactosSinMetadata.push(`${id.substring(0, 8)}…/${md}`);
          }
        }

        for (const meta of metaFiles) {
          const expectedMd = meta.replace('.metadata.json', '');
          if (!files.includes(expectedMd)) {
            resultado.metadataSinArtefacto.push(`${id.substring(0, 8)}…/${meta}`);
          }
        }

        // Check for corrupted JSON files
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = safeReadJson(path.join(sessionPath, file));
            if (content === null) {
              resultado.archivosCorruptos.push(`${id.substring(0, 8)}…/${file}`);
            }
          }
        }
      } catch { /* skip */ }
    }

    resultado.estadisticas = {
      totalConversaciones: convIds.size,
      totalSesionesBrain: brainIds.size,
      problemas: resultado.conversacionesSinBrain.length +
                 resultado.brainSinConversacion.length +
                 resultado.artefactosSinMetadata.length +
                 resultado.metadataSinArtefacto.length +
                 resultado.archivosCorruptos.length,
    };
  } catch (err) {
    return { error: err.message };
  }

  return resultado;
});

// ═══════════ KNOWLEDGE ITEM MANAGEMENT ═══════════
// These write directly to ~/.gemini/antigravity/knowledge/
// Antigravity reads these at the start of EVERY conversation

// Crear un Knowledge Item nuevo
ipcMain.handle('ag:create-ki', async (_event, { titulo, resumen, contenido }) => {
  try {
    // Generate a slug ID from title
    const id = titulo.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const kiDir = path.join(AG_KNOWLEDGE, id);
    const artifactsDir = path.join(kiDir, 'artifacts');

    if (!fs.existsSync(kiDir)) {
      fs.mkdirSync(kiDir, { recursive: true });
    }
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Write metadata.json (Antigravity reads this)
    const metadata = {
      title: titulo,
      summary: resumen,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      references: [],
    };
    fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    // Write the content as an artifact
    if (contenido) {
      fs.writeFileSync(path.join(artifactsDir, 'context.md'), contenido);
    }

    return { exito: true, id, mensaje: `✅ Knowledge Item "${titulo}" creado. Antigravity lo usará en futuras conversaciones.` };
  } catch (err) {
    return { exito: false, mensaje: `Error: ${err.message}` };
  }
});

// Generar KI desde una sesión existente — Llama resume el contenido antes de guardarlo
ipcMain.handle('ag:generate-ki-from-session', async (_event, sessionId) => {
  try {
    const sessionPath = path.join(AG_BRAIN, sessionId);
    if (!fs.existsSync(sessionPath)) {
      return { exito: false, mensaje: 'Sesión no encontrada' };
    }

    // Read all artifacts from the session
    const files = fs.readdirSync(sessionPath);
    const parts = [];
    let title = sessionId.substring(0, 12);

    // Extract content from walkthrough (best summary)
    const walkthrough = safeReadText(path.join(sessionPath, 'walkthrough.md'));
    if (walkthrough) {
      parts.push('## Walkthrough\n' + walkthrough);
      const firstLine = walkthrough.split('\n').find(l => l.startsWith('#'));
      if (firstLine) title = firstLine.replace(/^#+\s*/, '').substring(0, 60);
    }

    // Extract from implementation plan
    const plan = safeReadText(path.join(sessionPath, 'implementation_plan.md'));
    if (plan) {
      parts.push('## Implementation Plan\n' + plan);
      if (!walkthrough) {
        const firstLine = plan.split('\n').find(l => l.startsWith('#'));
        if (firstLine) title = firstLine.replace(/^#+\s*/, '').substring(0, 60);
      }
    }

    // Extract from task
    const task = safeReadText(path.join(sessionPath, 'task.md'));
    if (task) parts.push('## Tasks\n' + task);

    if (parts.length === 0) {
      return { exito: false, mensaje: 'No se encontraron artefactos con contenido útil en esta sesión' };
    }

    const rawContent = parts.join('\n\n---\n\n');

    // Get existing metadata summaries for the KI title
    const metaSummaries = [];
    for (const file of files) {
      if (file.endsWith('.metadata.json')) {
        const meta = safeReadJson(path.join(sessionPath, file));
        if (meta?.summary) metaSummaries.push(meta.summary);
      }
    }

    const kiTitle = `Sesión: ${title}`;
    let kiContent = rawContent;
    let kiResumen = metaSummaries.length > 0 ? metaSummaries.join(' | ') : `Conocimiento extraído de la sesión: ${title}.`;

    // === MEJORA: Pasar por Llama para generar un KI inteligente ===
    try {
      const llamaAvailable = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (llamaAvailable.ok) {
        const summaryPrompt = `Eres un asistente que genera Knowledge Items (KIs) técnicos concisos. 
Analiza el siguiente contenido de una sesión de desarrollo y genera:
1. Un RESUMEN de una sola línea (<120 chars) que capture la esencia técnica.
2. Un CUERPO en Markdown estructurado con las decisiones de arquitectura clave, tecnologías usadas y puntos importantes.

Responde SOLO con el JSON siguiente, sin texto adicional fuera del JSON:
{"resumen": "...", "cuerpo": "..."}

CONTENIDO DE LA SESIÓN:
${rawContent.substring(0, 8000)}`;

        const llamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: readSettings().localAiModel, prompt: summaryPrompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });

        if (llamaRes.ok) {
          const jsonLlama = await llamaRes.json();
          const raw = jsonLlama.response || '';
          // Extract JSON from response (Llama may add extra text)
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.resumen) kiResumen = parsed.resumen.substring(0, 200);
            if (parsed.cuerpo) kiContent = `# ${kiTitle}\n\n> ${kiResumen}\n\n${parsed.cuerpo}`;
          }
        }
      }
    } catch (llamaErr) {
      console.log('[KI Encode] Llama no disponible, usando contenido raw:', llamaErr.message);
      // Fall through to raw content — no problem
    }

    // Create the KI
    const id = 'session-' + sessionId.substring(0, 12);
    const kiDir = path.join(AG_KNOWLEDGE, id);
    const artifactsDir = path.join(kiDir, 'artifacts');

    fs.mkdirSync(kiDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });

    fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify({
      title: kiTitle,
      summary: kiResumen,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      references: [`session:${sessionId}`],
    }, null, 2));

    fs.writeFileSync(path.join(artifactsDir, 'session-knowledge.md'), kiContent);

    return {
      exito: true,
      id,
      mensaje: `KI generado con resumen inteligente: "${kiTitle}"`,
    };
  } catch (err) {
    return { exito: false, mensaje: `Error: ${err.message}` };
  }
});

// ═══════════ CHAT LOG PERSISTENCE (Mejora 2) ═══════════
const AG_CHAT_LOGS = path.join(AG_BASE, 'chat_logs');

ipcMain.handle('ag:save-chat-log', async (_event, logs) => {
  try {
    if (!fs.existsSync(AG_CHAT_LOGS)) fs.mkdirSync(AG_CHAT_LOGS, { recursive: true });
    const fileName = `chat_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.json`;
    const file = path.join(AG_CHAT_LOGS, fileName);
    fs.writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString(), logs }, null, 2));
    return { exito: true, file: fileName };
  } catch (err) {
    return { exito: false, mensaje: err.message };
  }
});

ipcMain.handle('ag:load-last-chat-log', async () => {
  try {
    if (!fs.existsSync(AG_CHAT_LOGS)) return { logs: [] };
    const files = fs.readdirSync(AG_CHAT_LOGS)
      .filter(f => f.startsWith('chat_') && f.endsWith('.json'))
      .sort().reverse();
    if (files.length === 0) return { logs: [] };
    const content = safeReadJson(path.join(AG_CHAT_LOGS, files[0]));
    return { logs: content?.logs || [], savedAt: content?.savedAt || null };
  } catch { return { logs: [] }; }
});

ipcMain.handle('ag:get-chat-sessions', async () => {
  try {
    if (!fs.existsSync(AG_CHAT_LOGS)) return [];
    return fs.readdirSync(AG_CHAT_LOGS)
      .filter(f => f.startsWith('chat_') && f.endsWith('.json'))
      .sort().reverse()
      .map(f => {
        const data = safeReadJson(path.join(AG_CHAT_LOGS, f));
        return { file: f, savedAt: data?.savedAt || null, count: data?.logs?.length || 0 };
      });
  } catch { return []; }
});

ipcMain.handle('ag:load-chat-session', async (_event, fileName) => {
  try {
    const content = safeReadJson(path.join(AG_CHAT_LOGS, fileName));
    return { logs: content?.logs || [], savedAt: content?.savedAt || null };
  } catch { return { logs: [] }; }
});

ipcMain.handle('ag:delete-chat-session', async (_event, fileName) => {
  try {
    fs.unlinkSync(path.join(AG_CHAT_LOGS, fileName));
    return { exito: true };
  } catch (err) { return { exito: false, mensaje: err.message }; }
});

// ═══════════ AUTO-SYNC PROJECTS (DISABLED — AI manages KIs) ═══════════
// Previously auto-created proyecto-* KIs from session walkthroughs.
// Now disabled because Antigravity AI curates KIs manually per the regla-memoria-ki rule.
// This handler only reports stats for the UI button.
ipcMain.handle('ag:auto-sync-projects', async () => {
  const kiCount = fs.existsSync(AG_KNOWLEDGE)
    ? fs.readdirSync(AG_KNOWLEDGE, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'knowledge.lock').length
    : 0;

  return {
    exito: true,
    creados: 0,
    actualizados: 0,
    saltados: 0,
    log: [`ℹ️ KIs gestionados por Antigravity AI: ${kiCount} KIs activos`],
    mensaje: `✅ ${kiCount} KIs activos. La optimización de KIs la gestiona Antigravity AI en cada conversación.`,
  };
});
ipcMain.handle('ag:delete-ki', async (_event, kiId) => {
  try {
    const kiDir = path.join(AG_KNOWLEDGE, kiId);
    if (!fs.existsSync(kiDir)) {
      return { exito: false, mensaje: 'KI no encontrado' };
    }
    fs.rmSync(kiDir, { recursive: true, force: true });
    return { exito: true, mensaje: `KI "${kiId}" eliminado.` };
  } catch (err) {
    return { exito: false, mensaje: `Error: ${err.message}` };
  }
});

/* ════════════════════════════════════════════════════════════════
   SERVIDORES — CRUD con persistencia JSON
   ════════════════════════════════════════════════════════════════ */

const SERVERS_FILE = path.join(AG_BASE, 'servers.json');

const DEFAULT_SERVERS = [];
// Servers start empty — users add via the UI

function readServers() {
  try {
    if (fs.existsSync(SERVERS_FILE)) {
      return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'));
    }
    // First run: create with defaults
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(DEFAULT_SERVERS, null, 2));
    return DEFAULT_SERVERS;
  } catch (err) {
    console.error('[Servers] Error reading:', err);
    return DEFAULT_SERVERS;
  }
}

function writeServers(servers) {
  try {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2));
    return true;
  } catch (err) {
    console.error('[Servers] Error writing:', err);
    return false;
  }
}

/* ════════════════════════════════════════════════════════════════
   PROYECTOS RADAR (GIT TRACKING)
   ════════════════════════════════════════════════════════════════ */
const PROJECTS_FILE = path.join(AG_BASE, 'projects.json');
function readProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2));
    return [];
  } catch(e) { return []; }
}
function writeProjects(projs) {
  try { fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projs, null, 2)); } catch(e){}
}
ipcMain.handle('ag:get-projects', () => readProjects());
ipcMain.handle('ag:add-project', (_e, pathStr) => {
  const ps = readProjects();
  if(!ps.includes(pathStr)) { ps.push(pathStr); writeProjects(ps); }
  return ps;
});
ipcMain.handle('ag:delete-project', (_e, pathStr) => {
  let ps = readProjects();
  ps = ps.filter(p => p !== pathStr);
  writeProjects(ps);
  return ps;
});

ipcMain.handle('ag:force-scan-radars', async () => {
    try {
        const logs = [];
        const capture = await toolScanGitRadars((msg) => {
            logs.push(msg);
            console.log(msg);
        });
        return { ok: true, logs, capturados: capture };
    } catch(e) {
        return { ok: false, error: e.message };
    }
});

/* ════════════════════════════════════════════════════════════════
   SETTINGS GLOBALES
   ════════════════════════════════════════════════════════════════ */
const SETTINGS_FILE = path.join(AG_BASE, 'settings.json');

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch(e) {}
  const def = { localAiModel: 'llama3.2:1b' };
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(def, null, 2)); } catch(e){}
  return def;
}

function writeSettings(newSet) {
  const current = readSettings();
  const merged = { ...current, ...newSet };
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2)); } catch(e){}
  return merged;
}

ipcMain.handle('ag:get-settings', () => readSettings());
ipcMain.handle('ag:set-settings', (_e, s) => writeSettings(s));

ipcMain.handle('ag:get-ollama-models', async () => {
    try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.models || []).map(m => m.name);
    } catch(e) {
        return [];
    }
});

/* ════════════════════════════════════════════════════════════════
   PROMPT REPOSITORY
   ════════════════════════════════════════════════════════════════ */
const PROMPTS_FILE = path.join(AG_BASE, 'prompts.json');

function readPrompts() {
  try {
    if (fs.existsSync(PROMPTS_FILE)) return JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
    fs.writeFileSync(PROMPTS_FILE, JSON.stringify([], null, 2));
    return [];
  } catch(e) { return []; }
}

function writePrompts(prompts) {
  try { fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2)); } catch(e){}
}

ipcMain.handle('ag:get-prompts', () => readPrompts());
ipcMain.handle('ag:save-prompt', (_e, prompt) => {
  const ps = readPrompts();
  const idx = ps.findIndex(p => p.id === prompt.id);
  if (idx >= 0) ps[idx] = { ...prompt, updatedAt: new Date().toISOString() };
  else ps.push({ ...prompt, updatedAt: new Date().toISOString() });
  writePrompts(ps);
  return ps;
});
ipcMain.handle('ag:delete-prompt', (_e, id) => {
  let ps = readPrompts();
  ps = ps.filter(p => p.id !== id);
  writePrompts(ps);
  return ps;
});

ipcMain.handle('ag:get-servers', async () => {
  return readServers();
});

ipcMain.handle('ag:save-server', async (_event, server) => {
  try {
    const servers = readServers();
    const idx = servers.findIndex(s => s.id === server.id);
    if (idx >= 0) {
      servers[idx] = server;
    } else {
      servers.push(server);
    }
    writeServers(servers);
    return { exito: true, mensaje: idx >= 0 ? 'Servidor actualizado' : 'Servidor añadido' };
  } catch (err) {
    return { exito: false, mensaje: err.message };
  }
});

ipcMain.handle('ag:delete-server', async (_event, serverId) => {
  try {
    let servers = readServers();
    servers = servers.filter(s => s.id !== serverId);
    writeServers(servers);
    return { exito: true, mensaje: 'Servidor eliminado' };
  } catch (err) {
    return { exito: false, mensaje: err.message };
  }
});

ipcMain.handle('ag:check-server', async (_event, server) => {
  try {
    // Parse SSH command to extract key and host
    const sshParts = server.ssh.trim().split(/\s+/);
    let sshCmd = `ssh -o ConnectTimeout=8 -o StrictHostKeyChecking=no -o BatchMode=yes`;
    
    // Find -i flag and host from the stored SSH command
    for (let i = 1; i < sshParts.length; i++) {
      if (sshParts[i] === '-i' && sshParts[i + 1]) {
        sshCmd += ` -i ${sshParts[i + 1]}`;
        i++;
      }
    }
    const host = sshParts[sshParts.length - 1]; // last part is user@host
    sshCmd += ` ${host}`;

    // Remote script: gather system info in one SSH call
    // Write to temp file to avoid all shell quoting issues
    const tmpScript = path.join(app.getPath('temp'), `ag-check-${server.id}.sh`);
    fs.writeFileSync(tmpScript, `#!/bin/bash
echo ===UPTIME===
uptime -p 2>/dev/null || uptime
echo ===MEMORY===
free -m | awk '/Mem/{printf "%d/%dMB (%.0f%%)", \$3, \$2, \$3/\$2*100}'
echo
echo ===DISK===
df -h / | awk 'NR==2{printf "%s/%s (%s)", \$3, \$2, \$5}'
echo
echo ===DOCKER===
docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}' 2>/dev/null || echo NO_DOCKER
echo ===PM2===
pm2 jlist 2>/dev/null || echo NO_PM2
echo ===CADDY===
if command -v caddy &>/dev/null; then
  CADDYFILE=""
  for cf in /etc/caddy/Caddyfile /root/Caddyfile /opt/caddy/Caddyfile; do
    [ -f "$cf" ] && CADDYFILE="$cf" && break
  done
  if [ -n "$CADDYFILE" ]; then
    grep -E '^[a-zA-Z0-9]' "$CADDYFILE" | grep -E '\.' | sed 's/[[:space:]]*{.*//' | sed 's/,[[:space:]]*/\n/g' | sort -u
  else
    echo NO_CADDY
  fi
else
  echo NO_CADDY
fi
echo ===NGINX===
if command -v nginx &>/dev/null && [ -d /etc/nginx ]; then
  grep -rh server_name /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -v '#' | grep -v server_name_ | sed 's/.*server_name//' | sed 's/;//' | tr ' ' '\n' | tr ',' '\n' | grep '\.' | grep -v '_' | grep -v example | grep -v localhost | sort -u || echo NO_NGINX
else
  echo NO_NGINX
fi
echo ===SYSTEMD===
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | grep -vE '(ssh|cron|systemd|dbus|getty|ufw|snap|polkit|rsyslog|multipathd|networkd|resolved|timesyncd|unattended|docker|containerd|fstrim|logind|user@|accounts-daemon|irqbalance|ModemManager|thermald|udisks2|packagekit|power-profiles|switcheroo|wpa_supplicant|avahi|cups|bolt|colord|kerneloops|low-memory|atd|blk-availability|finalrd|setvtrgb|console-setup|keyboard-setup|kmod-static-nodes|lvm2-monitor|open-vm-tools|plymouth|qemu-guest-agent)' | awk '{print \$1}' | sed 's/\.service//' | head -20 || echo NO_SYSTEMD
echo ===END===
`);

    const fullCmd = `cat "${tmpScript}" | ${sshCmd} bash`;
    console.log(`[Servers] Checking ${server.nombre} (${host})...`);
    
    const { stdout } = await execAsync(fullCmd, { timeout: 25000, maxBuffer: 1024 * 1024 });
    
    // Parse response
    const sections = {};
    let currentSection = '';
    for (const line of stdout.split('\n')) {
      if (line.startsWith('===') && line.endsWith('===')) {
        currentSection = line.replace(/===/g, '').trim();
        sections[currentSection] = [];
      } else if (currentSection && line.trim()) {
        sections[currentSection].push(line.trim());
      }
    }

    // Parse Docker containers
    const containers = [];
    if (sections.DOCKER && sections.DOCKER[0] !== 'NO_DOCKER') {
      for (const line of sections.DOCKER) {
        const [nombre, status] = line.split('|');
        if (nombre) {
          const activo = status ? status.toLowerCase().includes('up') : false;
          const puerto = line.split('|')[2] || '';
          // Extract port numbers
          const ports = puerto.match(/:([0-9]+)->/g)?.map(p => p.replace(':->', '').replace(':', '')) || [];
          containers.push({
            nombre: nombre.trim(),
            puerto: ports.join(', ') || '-',
            activo,
          });
        }
      }
    }

    // Parse PM2 processes
    const pm2Projects = [];
    if (sections.PM2 && sections.PM2[0] !== 'NO_PM2') {
      try {
        const pm2Data = JSON.parse(sections.PM2.join(''));
        for (const proc of pm2Data) {
          pm2Projects.push({
            nombre: proc.name,
            desc: `PM2 · ${proc.pm2_env?.exec_interpreter || 'node'} · pid ${proc.pid}`,
            color: proc.pm2_env?.status === 'online' ? 'text-emerald-400' : 'text-rose-400',
            activo: proc.pm2_env?.status === 'online',
          });
        }
      } catch (e) { /* ignore parse errors */ }
    }

    // Parse Caddy sites
    const caddyProjects = [];
    if (sections.CADDY && sections.CADDY[0] !== 'NO_CADDY') {
      for (const domain of sections.CADDY) {
        if (domain && domain.includes('.')) {
          const name = domain.split('.')[0].replace(/^www\./, '');
          caddyProjects.push({
            nombre: name.charAt(0).toUpperCase() + name.slice(1),
            desc: `Caddy · ${domain}`,
            color: 'text-cyan-400',
            activo: true,
          });
        }
      }
    }

    // Parse Nginx sites
    const nginxProjects = [];
    if (sections.NGINX && sections.NGINX[0] !== 'NO_NGINX') {
      for (const domain of sections.NGINX) {
        if (domain && domain.includes('.') && !domain.includes('_')) {
          const name = domain.split('.')[0].replace(/^www\./, '');
          nginxProjects.push({
            nombre: name.charAt(0).toUpperCase() + name.slice(1),
            desc: `Nginx · ${domain}`,
            color: 'text-violet-400',
            activo: true,
          });
        }
      }
    }

    // Parse Systemd services (custom ones only, system services are filtered out)
    const systemdProjects = [];
    if (sections.SYSTEMD && sections.SYSTEMD[0] !== 'NO_SYSTEMD') {
      for (const svc of sections.SYSTEMD) {
        if (svc && svc.trim()) {
          const svcName = svc.trim();
          systemdProjects.push({
            nombre: svcName.charAt(0).toUpperCase() + svcName.slice(1),
            desc: `Systemd · ${svcName}.service`,
            color: 'text-amber-400',
            activo: true,
          });
        }
      }
    }

    // Build updated server
    const ram = sections.MEMORY?.[0] || server.ram;
    const disk = sections.DISK?.[0] || '';
    const uptime = sections.UPTIME?.[0] || '';

    // Merge: keep manually-added projects, add PM2/Caddy/Nginx/Systemd ones if not already there
    const existingNames = new Set(server.proyectos.map(p => p.nombre.toLowerCase()));
    const mergedProjects = [...server.proyectos];
    for (const p of [...pm2Projects, ...caddyProjects, ...nginxProjects, ...systemdProjects]) {
      const nameLower = p.nombre.toLowerCase();
      if (!existingNames.has(nameLower)) {
        mergedProjects.push(p);
        existingNames.add(nameLower);
      } else {
        // Update status of existing
        const idx = mergedProjects.findIndex(e => e.nombre.toLowerCase() === nameLower);
        if (idx >= 0) mergedProjects[idx].activo = p.activo;
      }
    }

    const updatedServer = {
      ...server,
      ram: ram,
      containers: containers.length > 0 ? containers : server.containers,
      proyectos: mergedProjects,
      notas: [
        ...server.notas.filter(n => !n.startsWith('⏱') && !n.startsWith('💾')),
        `⏱ ${uptime}`,
        disk ? `💾 Disco: ${disk}` : null,
      ].filter(Boolean),
    };

    // Auto-save
    const allServers = readServers();
    const idx = allServers.findIndex(s => s.id === server.id);
    if (idx >= 0) {
      allServers[idx] = updatedServer;
      writeServers(allServers);
    }

    console.log(`[Servers] ✅ ${server.nombre} checked OK — PM2: ${pm2Projects.length}, Caddy: ${caddyProjects.length}, Nginx: ${nginxProjects.length}, Systemd: ${systemdProjects.length}, Docker: ${containers.length}, Total proyectos: ${mergedProjects.length}`);
    return { exito: true, servidor: updatedServer, mensaje: `${server.nombre} actualizado` };
  } catch (err) {
    console.error(`[Servers] ❌ ${server.nombre} error:`, err.message);
    return { exito: false, servidor: server, mensaje: `Error: ${err.message.split('\n')[0]}` };
  }
});

/* ════════════════════════════════════════════════════════════════
   APIs — CRUD con persistencia JSON
   ════════════════════════════════════════════════════════════════ */

const APIS_FILE = path.join(AG_BASE, 'apis.json');

const DEFAULT_APIS = [];
// APIs start empty — users add their own via the UI

function readApis() {
  try {
    if (fs.existsSync(APIS_FILE)) return JSON.parse(fs.readFileSync(APIS_FILE, 'utf-8'));
    fs.writeFileSync(APIS_FILE, JSON.stringify(DEFAULT_APIS, null, 2));
    return DEFAULT_APIS;
  } catch (err) { console.error('[APIs] Error:', err); return DEFAULT_APIS; }
}

function writeApis(apis) {
  try { fs.writeFileSync(APIS_FILE, JSON.stringify(apis, null, 2)); return true; }
  catch (err) { console.error('[APIs] Error writing:', err); return false; }
}

ipcMain.handle('ag:get-apis', async () => readApis());

ipcMain.handle('ag:save-api', async (_event, api) => {
  try {
    const apis = readApis();
    const idx = apis.findIndex(a => a.id === api.id);
    if (idx >= 0) apis[idx] = api; else apis.push(api);
    writeApis(apis);
    return { exito: true, mensaje: idx >= 0 ? 'API actualizada' : 'API añadida' };
  } catch (err) { return { exito: false, mensaje: err.message }; }
});

ipcMain.handle('ag:delete-api', async (_event, apiId) => {
  try {
    let apis = readApis();
    apis = apis.filter(a => a.id !== apiId);
    writeApis(apis);
    return { exito: true, mensaje: 'API eliminada' };
  } catch (err) { return { exito: false, mensaje: err.message }; }
});

ipcMain.handle('ag:sync-apis', async () => {
  try {
    let apis = readApis();
    for (let i = 0; i < apis.length; i++) {
      const api = apis[i];
      if (!api.apiKey || api.apiKey.trim() === '') {
        api.status = 'UNKNOWN';
        continue;
      }
      try {
        if (api.nombre.includes('OpenRouter')) {
          const res = await fetch('https://openrouter.ai/api/v1/credits', { headers: { 'Authorization': `Bearer ${api.apiKey}` }, signal: AbortSignal.timeout(5000) });
          if (!res.ok) throw new Error('Auth fail');
          const json = await res.json();
          if (json && json.data) {
             const total_credits = json.data.total_credits || 0;
             const total_usage = json.data.total_usage || 0;
             api.saldo = Math.max(0, total_credits - total_usage);
             api.status = 'OK';
          } else api.status = 'ERROR';
        } else if (api.nombre.includes('BrightData') || api.nombre.includes('Bright Data')) {
          const res = await fetch('https://api.brightdata.com/customer/balance', { headers: { 'Authorization': `Bearer ${api.apiKey}` }, signal: AbortSignal.timeout(5000) });
          if (!res.ok) throw new Error('Auth fail');
          const json = await res.json();
          if (json && typeof json.balance !== 'undefined') {
             api.saldo = parseFloat(json.balance);
             api.status = 'OK';
          } else api.status = 'ERROR';
        } else if (api.nombre.includes('Gemini') || api.nombre.includes('Antigravity')) {
          api.status = 'OK'; // Gemini gives no quota endpoint natively without complex OAuth
        } else if (api.nombre.includes('Google API')) {
          api.status = 'OK'; // Cloud console UI required
        } else if (api.nombre.includes('Data Impulse') || api.nombre.includes('DataImpulse')) {
          const res = await fetch('https://data.dataimpulse.com/api/plans/get_plans', { headers: { 'Authorization': `Bearer ${api.apiKey}` }, signal: AbortSignal.timeout(5000) });
          if (!res.ok) throw new Error('Auth fail');
          const json = await res.json();
          if (json && json.data && json.data.length > 0) {
             const firstPlan = json.data[0];
             let gb = 0;
             if (firstPlan.balance) {
                gb = firstPlan.balance / (1024 * 1024 * 1024);
             }
             api.saldo = gb;
             api.status = 'OK';
          } else api.status = 'ERROR';
        } else {
          api.status = 'UNKNOWN';
        }
      } catch (err) {
        console.error(`[APIs] Fetch error for ${api.nombre}:`, err.message);
        api.status = 'ERROR';
      }
    }
    writeApis(apis);
    console.log('[APIs] Sync completed');
    return apis;
  } catch (err) {
    console.error('[APIs] Sync master error:', err);
    return readApis();
  }
});

// ════════════ AGENT TOOLS — funciones de sistema que el agente puede invocar ════════════

async function toolDetectEditors() {
  try {
    const { stdout } = await execAsync('ps aux | grep -iE "(Cursor|Windsurf|Code Helper|Code\\\\.app|claude|aider)" | grep -v grep || true', { timeout: 5000 });
    const editors = [];
    const lines = stdout.split('\n').filter(l => l.trim());
    const seen = new Set();
    for (const line of lines) {
      let name = null;
      if (line.toLowerCase().includes('cursor') && !line.includes('grep')) name = 'Cursor';
      else if (line.toLowerCase().includes('windsurf')) name = 'Windsurf';
      else if ((line.includes('/Code ') || line.includes('Code.app') || line.includes('code-helper')) && !line.includes('grep')) name = 'VS Code';
      else if (line.toLowerCase().includes('claude') && !line.includes('grep')) name = 'Claude Code (Terminal)';
      else if (line.toLowerCase().includes('aider') && !line.includes('grep')) name = 'Aider (Terminal)';
      if (name && !seen.has(name)) { seen.add(name); editors.push(name); }
    }
    return { ok: true, editores: editors.length > 0 ? editors : ['Ningún editor detectado actualmente'] };
  } catch (e) {
    return { ok: false, editores: [], error: e.message };
  }
}

async function toolGetOrphanSessions(limit = 5) {
  // Sessions that exist in brain/ but have NO corresponding KI
  const kiIds = new Set(
    fs.existsSync(AG_KNOWLEDGE) ? fs.readdirSync(AG_KNOWLEDGE).filter(f => !f.startsWith('.')) : []
  );
  // session-<first12chars> is the KI naming convention
  const orphans = [];
  try {
    const brainDirs = fs.readdirSync(AG_BRAIN, { withFileTypes: true });
    for (const dir of brainDirs) {
      if (!dir.isDirectory() || dir.name.startsWith('.') || dir.name === 'tempmediaStorage') continue;
      const kiId = `session-${dir.name.substring(0, 12)}`;
      if (!kiIds.has(kiId)) {
        const sessionPath = path.join(AG_BRAIN, dir.name);
        const hasWalkthrough = fs.existsSync(path.join(sessionPath, 'walkthrough.md'));
        const hasPlan = fs.existsSync(path.join(sessionPath, 'implementation_plan.md'));
        if (hasWalkthrough || hasPlan) {
          const title = extractSessionTitle(sessionPath, dir.name);
          orphans.push({ id: dir.name, title, hasWalkthrough, hasPlan });
        }
      }
    }
  } catch (e) { /* ignore */ }
  return orphans.slice(0, limit);
}

async function toolAutoCapture(sessionId) {
  // Reuse generate-ki-from-session logic inline
  const sessionPath = path.join(AG_BRAIN, sessionId);
  if (!fs.existsSync(sessionPath)) return { ok: false, msg: 'Sesión no encontrada' };

  const parts = [];
  let title = sessionId.substring(0, 12);

  const walkthrough = safeReadText(path.join(sessionPath, 'walkthrough.md'));
  if (walkthrough) {
    parts.push('## Walkthrough\n' + walkthrough);
    const fl = walkthrough.split('\n').find(l => l.startsWith('#'));
    if (fl) title = fl.replace(/^#+\s*/, '').substring(0, 60);
  }
  const plan = safeReadText(path.join(sessionPath, 'implementation_plan.md'));
  if (plan) {
    parts.push('## Plan\n' + plan);
    if (!walkthrough) {
      const fl = plan.split('\n').find(l => l.startsWith('#'));
      if (fl) title = fl.replace(/^#+\s*/, '').substring(0, 60);
    }
  }
  const task = safeReadText(path.join(sessionPath, 'task.md'));
  if (task) parts.push('## Tasks\n' + task);

  if (parts.length === 0) return { ok: false, msg: 'Sin contenido útil' };

  const rawContent = parts.join('\n\n---\n\n');
  const kiTitle = `Sesión: ${title}`;
  let kiContent = rawContent;
  let kiResumen = `Captura automática del agente. Sesión: ${title}`;

  // Try Llama summarization
  try {
    const llamaR = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: readSettings().localAiModel,
        prompt: `Resume este contenido técnico en un JSON {"resumen":"<1 línea>","cuerpo":"<markdown estructurado>"}. Solo JSON, sin texto extra.\n\n${rawContent.substring(0, 6000)}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (llamaR.ok) {
      const jr = await llamaR.json();
      const match = (jr.response || '').match(/\{[\s\S]*\}/);
      if (match) {
        const p = JSON.parse(match[0]);
        if (p.resumen) kiResumen = p.resumen.substring(0, 200);
        if (p.cuerpo) kiContent = `# ${kiTitle}\n\n> ${kiResumen}\n\n${p.cuerpo}`;
      }
    }
  } catch (e) { /* fallback to raw */ }

  const id = `session-${sessionId.substring(0, 12)}`;
  const kiDir = path.join(AG_KNOWLEDGE, id);
  const artDir = path.join(kiDir, 'artifacts');
  fs.mkdirSync(kiDir, { recursive: true });
  fs.mkdirSync(artDir, { recursive: true });
  fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify({
    title: kiTitle, summary: kiResumen,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    references: [`session:${sessionId}`],
  }, null, 2));
  fs.writeFileSync(path.join(artDir, 'session-knowledge.md'), kiContent);
  return { ok: true, id, title: kiTitle };
}

async function toolScanGitRadars(log) {
  const projects = readProjects();
  const capturados = [];
  if (projects.length === 0) return capturados;

  for (const p of projects) {
      log(`[ RADAR ] Escaneando proyecto: ${p}`);
      try {
          const { stdout: diffStd } = await execAsync(`git -C "${p}" diff`, { timeout: 10000 });
          if (diffStd && diffStd.trim().length > 20) {
               log(`[ RADAR ] Cambios detectados en ${p}. Analizando...`);
               const projectName = path.basename(p);
               const prompt = `Analiza este diff git de un proyecto llamado ${projectName}. Genera un Knowledge Item técnico resumiendo qué se está programando/modificando. Devuelve un JSON {"resumen":"<1 linea>","cuerpo":"<markdown con el análisis del diff>"}.\n\nDiff:\n${diffStd.substring(0,6000)}`;
               const llamaR = await fetch('http://localhost:11434/api/generate', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ model: readSettings().localAiModel, prompt, stream: false })
               });
               if(llamaR.ok) {
                  const jr = await llamaR.json();
                  const match = (jr.response || '').match(/\{[\s\S]*\}/);
                  if (match) {
                     const parsed = JSON.parse(match[0]);
                     const kiId = `radar-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().substring(5)}`;
                     const kiDir = path.join(AG_KNOWLEDGE, kiId);
                     fs.mkdirSync(path.join(kiDir, 'artifacts'), {recursive: true});
                     fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify({
                        title: `Radar: ${projectName}`,
                        summary: parsed.resumen || "Git Radar auto-captura",
                        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                        references: [`radar:${p}`]
                     }, null, 2));
                     fs.writeFileSync(path.join(kiDir, 'artifacts', 'context.md'), `# Radar: ${projectName}\n\n> ${parsed.resumen}\n\n${parsed.cuerpo}\n\n## Diff Original\n\`\`\`diff\n${diffStd.substring(0, 3000)}\n\`\`\``);
                     capturados.push({ id: kiId, title: `Radar: ${projectName}` });
                     log(`[ RADAR ✅ ] KI extraído desde Git: ${kiId}`);
                  }
               }
          } else {
               log(`[ RADAR ] Sin cambios en ${path.basename(p)}`);
          }
      } catch(e) {
          log(`[ RADAR ] Error escaneando ${p}: ${e.message.split('\\n')[0]}`);
      }
  }
  return capturados;
}

// ════════════ CHATBOT OLLAMA LOCAL ════════════
ipcMain.handle('ag:ask-llama', async (_event, question) => {
  try {
    const apis = readApis();
    const servers = readServers();
    const existingKIs = fs.existsSync(AG_KNOWLEDGE) ? fs.readdirSync(AG_KNOWLEDGE).filter(f => !f.startsWith('.')) : [];
    let kisData = '';
    for (let ki of existingKIs) {
       const metaPath = path.join(AG_KNOWLEDGE, ki, 'metadata.json');
       if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            kisData += `- ${meta.title}: ${meta.summary}\n`;
          } catch(e){}
       }
    }

    const p = `Eres "Open Brain", la Inteligencia Artificial operativa de supervisión central de la plataforma de desarrollo Open Brain.
Tu trabajo principal es ser el "Copiloto Jefe" del Administrador del Sistema. Debes asimilar la información técnica en tiempo real, monitorizar caídas, vigilar gastos de APIs y dominar su memoria de arquitectura técnica persistente (Knowledge Items). 

CONSCIENCIA DE ENJAMBRE (Jerarquía Multi-IDE):
Eres la "Torre de Control". Por debajo de ti operan agentes IA ejecutores que viven encapsulados en los IDEs (Cursor, Windsurf, VS Code). Tu deber es entender que esos agentes crean "Memorias (KIs)" para ti y dependen de tu supervisión. Tú dictas el contexto general para que ellos ejecuten código.

SISTEMA DE CONTROL DE LA INTERFAZ:
Puedes controlar la aplicación Desktop. Añade al final de tu mensaje alguna de estas etiquetas secretas para que la matriz actúe si el usuario te pide hacer algo:
- <CMD>GOTO:UNION</CMD> -> (Para unir nuevos editores o crear prompts .cursorrules)
- <CMD>GOTO:SERVIDORES</CMD> -> (Para añadir o ver VPS / unirlos a la flota)
- <CMD>GOTO:CONOCIMIENTO</CMD> -> (Para la bóveda de KIs manual)
- <CMD>GOTO:APIS</CMD> -> (Para gestionar tokens y proveedores LLM)
- <CMD>RUN_AGENT</CMD> -> (Para escanear IDEs, forzar recolección y sacar/extraer KIs de forma autónoma)

REGLAS DE IDENTIDAD Y COMPORTAMIENTO:
1. Responde SIEMPRE en español. Sé extremadamente analítico, técnico y directo. NUNCA uses saludos, introducciones ni cortesías (nada de "¡Hola!", "Claro que sí", "Aquí tienes"). Responde únicamente con datos útiles.
2. Estructura TUS RESPUESTAS EXCLUSIVAMENTE en formato Markdown legible (listas limpias, bloques de código, negritas para IDs clave).
3. Eres un asistente técnico basado en DATOS LOCALES. Si te pregunta algo que no está en la telemetría, responde fríamente: "Dato no disponible en memoria local."

A continuación se inyecta la telemetría viva de tu sistema nervioso. Interpreta esto para contestarle.

[ TELEMETRÍA DE RED: NODOS VPS ]
${servers.map(s => `- Instancia: ${s.nombre} | Status: ${serverStatuses[s.id]?.ok ? 'ONLINE 🟢' : 'OFFLINE 🔴'} | RAM Utilizada: ${serverStatuses[s.id]?.ram || 'No detectable'}`).join('\n')}

[ ECONOMÍA Y CÓMPUTO: APIS ]
${apis.map(a => `- Proveedor: ${a.nombre} | Saldo: ${a.saldo.toFixed(2)} | Status API: ${a.status}`).join('\n')}

[ MEMORIA CRISTALIZADA: KNOWLEDGE ITEMS (KIs) ]
Esta es la indexación base de la historia técnica. Úsala de glosario y brújula tecnológica:
${kisData.substring(0, 10000)}

[ MANTENIMIENTO: CAPACIDADES EJECUTIVAS ]
Puedes realizar estas acciones tácticas si el usuario lo solicita:
- <CMD>GOTO:TAB_NAME</CMD> -> Cambiar de pestaña (SESIONES, PROMPTS, SALIDAS, REPARAR, APIS, SERVIDORES, CONOCIMIENTO, UNION, IA, INFO).
- <CMD>GET_ZOMBIES</CMD> -> Escanear el sistema buscando procesos bloqueados (defunct).
- <CMD>KILL_PROCESSES:[PID1, PID2...]</CMD> -> Ejecutar eliminación forzada de procesos padre de zombies. SIEMPRE debes usar GET_ZOMBIES primero e informar al usuario de los nombres de las aplicaciones afectadas antes de pedir permiso para matarlas.

=== FIN DE LA TELEMETRÍA ===

COMANDO DEL USUARIO MAESTRO (ROOT_ADMIN):
"${question}"

Genera el reporte de terminal a continuación:`;

    const llamaRes = await fetch('http://localhost:11434/api/generate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ model: readSettings().localAiModel, prompt: p, stream: false })
    });

    if (!llamaRes.ok) return "⚠️ Error de conexión con la Terminal Neuronal Local (Ollama).";
    const jsonRes = await llamaRes.json();
    return jsonRes.response;
  } catch (e) {
    console.error("[Llama Ask Error]", e);
    return "⚠️ Fallo crítico en el clúster Llama local: " + e.message;
  }
});

// ════════════ AGENTE AUTÓNOMO ════════════
ipcMain.handle('ag:run-agent', async (_event, command) => {
  const results = [];
  const log = (msg) => { results.push(msg); console.log('[Agent]', msg); };

  try {
    // FASE 1: Detectar editores activos
    log('[ SCAN ] Detectando editores activos...');
    const editorScan = await toolDetectEditors();
    const editorReport = editorScan.editores.join(', ');
    log(`[ IDE ] Detectados: ${editorReport}`);

    // FASE 2: Encontrar sesiones sin KI
    log('[ SCAN ] Buscando sesiones sin Knowledge Item...');
    const orphans = await toolGetOrphanSessions(command === 'full' ? 10 : 5);
    log(`[ FOUND ] ${orphans.length} sesiones huérfanas encontradas`);

    if (orphans.length === 0) {
      log('[ OK ] Todas las sesiones ya tienen KI. Memoria al día.');
      return {
        ok: true,
        editores: editorScan.editores,
        capturados: [],
        fallidos: [],
        log: results,
        resumen: `IDEs activos: ${editorReport}. Memoria al día: ${fs.existsSync(AG_KNOWLEDGE) ? fs.readdirSync(AG_KNOWLEDGE).filter(f => !f.startsWith('.')).length : 0} KIs.`,
      };
    }

    // FASE 3: Capturar KIs para cada sesión huérfana
    const capturados = [];
    const fallidos = [];

    for (const orphan of orphans) {
      log(`[ ENCODE ] Procesando: "${orphan.title.substring(0, 50)}..."`)
      const result = await toolAutoCapture(orphan.id);
      if (result.ok) {
        log(`[ KI ✅ ] Creado: ${result.id}`);
        capturados.push({ id: result.id, title: result.title });
      } else {
        log(`[ SKIP ] ${orphan.id}: ${result.msg}`);
        fallidos.push(orphan.title);
      }
    }

    // FASE 3.5: Escanear Proyectos Radar
    log('[ SCAN ] Analizando Radares OS-Level...');
    const radarCapturados = await toolScanGitRadars(log);
    capturados.push(...radarCapturados);

    // FASE 4: Pedir a Llama que genere un resumen ejecutivo
    log('[ LLAMA ] Generando resumen ejecutivo del agente...');
    let resumenFinal = `Agente completado. Editores: ${editorReport}. KIs sesión: ${capturados.length - radarCapturados.length}. KIs radar: ${radarCapturados.length}.`;
    try {
      const llamaAvail = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
      if (llamaAvail.ok) {
        const execPrompt = `Eres Open Brain. Informa al usuario ROOT_ADMIN en 2-3 líneas estilo terminal sobre la operación del agente autónomo:
- IDEs detectados: ${editorReport}
- Sesiones huérfanas encontradas: ${orphans.length}
- KIs generados exitosamente: ${capturados.length} — Títulos: ${capturados.map(c => c.title).join(' | ')}
- Fallidos: ${fallidos.length}
Responde en español, estilo técnico, sin saludos, directo al grano.`;
        const lr = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: readSettings().localAiModel, prompt: execPrompt, stream: false }),
          signal: AbortSignal.timeout(15000),
        });
        if (lr.ok) {
          const jr = await lr.json();
          resumenFinal = jr.response || resumenFinal;
        }
      }
    } catch (e) { /* use default summary */ }

    return {
      ok: true,
      editores: editorScan.editores,
      capturados,
      fallidos,
      log: results,
      resumen: resumenFinal,
    };
  } catch (err) {
    console.error('[Agent] Fatal error:', err);
    return { ok: false, editores: [], capturados: [], fallidos: [], log: results, resumen: `Error del agente: ${err.message}` };
  }
});


ipcMain.handle('ag:check-llama', async () => {
   try {
      const res = await fetch('http://localhost:11434/api/tags');
      return res.ok;
   } catch(e) { return false; }
});

ipcMain.handle('ag:install-llama', async () => {
   try {
      // Instalador nativo de macOS vía Homebrew o script
      await execAsync(`curl -fsSL https://ollama.com/install.sh | sh && sleep 3 && /usr/local/bin/ollama pull llama3.2:1b || /opt/homebrew/bin/ollama pull llama3.2:1b || ollama pull llama3.2:1b`);
      return true;
   } catch(e) {
      console.error("[Llama Install Error]", e);
      return false;
   }
});

/* ════════════════════════════════════════════════════════════════
   VENTANA PRINCIPAL
   ════════════════════════════════════════════════════════════════ */

function createWindow() {
  debugLog('createWindow() called');
  isQuitting = false; // Reset quit flag — allows new windows to use hide-on-close policy
  const isDev = process.env.NODE_ENV === 'development';
  const preloadPath = path.join(__dirname, 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false, // Don't show the window until it's ready, prevent white screen
    title: 'Open Brain',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0b10',
    icon: path.join(__dirname, 'src/assets/logo-brain.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
    },
  });

  // Failsafe: only show when ready
  mainWindow.once('ready-to-show', () => {
    debugLog('ready-to-show triggered');
    mainWindow.show();
    mainWindow.focus();
  });

  // Set macOS dock icon
  const dockIconPath = path.join(__dirname, 'src', 'assets', 'logo-brain.png');
  if (fs.existsSync(dockIconPath)) {
    const dockIcon = nativeImage.createFromPath(dockIconPath);
    if (!dockIcon.isEmpty() && process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(dockIcon);
    }
  }

  mainWindow.webContents.on('preload-error', (event, p, error) => {
    debugLog(`PRELOAD ERROR: ${error}`);
  });

  // macOS Hide-on-Close Policy
  mainWindow.on('close', (event) => {
    debugLog(`mainWindow.on('close') triggered. isQuitting: ${isQuitting}`);
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      debugLog('Window HIDDEN (macOS Policy)');
    }
  });

  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    debugLog(`[RENDERER] ${message} (${sourceId}:${line})`);
  });
  mainWindow.on('closed', () => {
    debugLog('mainWindow.on("closed") triggered');
    mainWindow = null;
  });

  if (isDev) {
    debugLog('Loading URL: http://localhost:5173 (isDev=true)');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // __dirname works correctly inside asar — no special path needed
    const htmlPath = path.join(__dirname, 'dist', 'index.html');
    
    debugLog(`Loading file: ${htmlPath} (app.isPackaged=${app.isPackaged})`);
    mainWindow.loadFile(htmlPath).catch(err => {
      debugLog(`loadFile ERROR: ${err.message}`);
    });
  }
}

/* ════════════════════════════════════════════════════════════════
   MENÚ EN ESPAÑOL
   ════════════════════════════════════════════════════════════════ */

function setSpanishMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: 'Acerca de Antigravity Brain', role: 'about' },
        { type: 'separator' },
        { label: 'Ocultar Antigravity Brain', role: 'hide' },
        { label: 'Ocultar otros', role: 'hideOthers' },
        { label: 'Mostrar todo', role: 'unhide' },
        { type: 'separator' },
        { label: 'Salir', role: 'quit' },
      ],
    }] : []),
    {
      label: 'Archivo',
      submenu: [
        isMac ? { label: 'Cerrar ventana', role: 'close' } : { label: 'Salir', role: 'quit' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', role: 'undo' },
        { label: 'Rehacer', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Pegar', role: 'paste' },
        { label: 'Seleccionar todo', role: 'selectAll' },
      ],
    },
    {
      label: 'Vista',
      submenu: [
        { label: 'Recargar', role: 'reload' },
        { label: 'Forzar recarga', role: 'forceReload' },
        { label: 'Herramientas de Desarrollo', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Restablecer zoom', role: 'resetZoom' },
        { label: 'Acercar', role: 'zoomIn' },
        { label: 'Alejar', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Pantalla completa', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { label: 'Minimizar', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { label: 'Traer todo al frente', role: 'front' },
        ] : [
          { label: 'Cerrar', role: 'close' },
        ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/* ════════════════════════════════════════════════════════════════
   AUTO-SYNC: Escribir KIs desde datos actuales (servidores, APIs)
   Se ejecuta cada 5 minutos para mantener el conocimiento actualizado
   ════════════════════════════════════════════════════════════════ */

function autoSyncKnowledge() {
  try {
    const now = new Date().toISOString();

    // SAFE writeKI: ONLY writes metadata.json, NEVER touches context.md
    // context.md is managed exclusively by Antigravity AI
    function writeMetadataOnly(folder, title, summary, refs) {
      const kiDir = path.join(AG_KNOWLEDGE, folder);
      if (!fs.existsSync(kiDir)) fs.mkdirSync(kiDir, { recursive: true });
      const artDir = path.join(kiDir, 'artifacts');
      if (!fs.existsSync(artDir)) fs.mkdirSync(artDir, { recursive: true });

      const metaPath = path.join(kiDir, 'metadata.json');
      let createdAt = now;
      // Preserve existing createdAt and manually-edited summary/title
      if (fs.existsSync(metaPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          createdAt = existing.createdAt || now;
          // If summary was manually curated (doesn't start with auto-pattern), keep it
          if (existing.summary && existing.summary.length > summary.length * 1.2) {
            console.log(`[AutoSync] Keeping manually curated metadata for ${folder}`);
            return;
          }
        } catch {}
      }

      fs.writeFileSync(metaPath, JSON.stringify({
        title, summary, createdAt, updatedAt: now, references: refs
      }, null, 2));
    }

    // ── 1. KI de APIs — update api-keys-centralizadas context.md (this one IS auto-generated) ──
    const apis = readApis();
    let apiContent = '# API Keys — Registro Centralizado\n\n';
    apiContent += `Última actualización automática: ${now}\n\n`;
    for (const api of apis) {
      apiContent += `## ${api.nombre} (${api.tipo})\n`;
      if (api.limiteAlerta > 0) apiContent += `- **Alerta cuando <**: ${api.limiteAlerta}€\n`;
      if (api.url) apiContent += `- **Dashboard**: ${api.url}\n`;
      if (api.proyectos.length > 0) {
        apiContent += `- **Proyectos**: ${api.proyectos.map(p => `${p.proyecto} (${p.consumoMensual.toFixed(2)}€/mes)`).join(', ')}\n`;
      }
      apiContent += '\n';
    }
    const totalCoste = apis.reduce((a, api) => a + api.proyectos.reduce((b, p) => b + p.consumoMensual, 0), 0);
    apiContent += `## Resumen\n- Total APIs: ${apis.length}\n- Coste mensual total: ${totalCoste.toFixed(2)}€\n`;

    // API KI: OK to write context.md because it's fully auto-generated data
    const apiArtDir = path.join(AG_KNOWLEDGE, 'api-keys-centralizadas', 'artifacts');
    if (!fs.existsSync(apiArtDir)) fs.mkdirSync(apiArtDir, { recursive: true });
    fs.writeFileSync(path.join(apiArtDir, 'context.md'), apiContent);
    writeMetadataOnly('api-keys-centralizadas',
      'API Keys — Todas las Credenciales Centralizadas',
      `Registro centralizado de ${apis.length} APIs. Coste mensual: ${totalCoste.toFixed(2)}€. Servicios: ${apis.map(a => a.nombre).join(', ')}. Auto-sincronizado.`,
      []
    );

    // ── 2. Servidor KIs — ONLY update metadata, NEVER touch context.md ──
    const servers = readServers();
    for (const srv of servers) {
      const kiFolder = `servidor-${srv.id}`;
      writeMetadataOnly(kiFolder,
        `${srv.nombre} (${srv.ip})`,
        `Servidor ${srv.proveedor} ${srv.ip}. ${srv.os}, ${srv.ram}. ${srv.proyectos.length} proyectos, ${srv.containers.length} containers.`,
        []
      );
    }

    // ── 3. NO TOCAR nada más ──
    // - Brain KI (antigravity-brain-torre-control): managed by AI
    // - Project KIs (optppc-saas-platform, deliveryrecovery, etc): managed by AI
    // - Rule KIs (regla-*): managed by AI
    // - NO crear proyecto-* KIs

    console.log(`[AutoSync] ✅ APIs (${apis.length}) + Servidores (${servers.length}) metadata actualizado (${now})`);
  } catch (err) {
    console.error('[AutoSync] ❌ Error:', err.message);
  }
}

// ═══════════ AUTO-CLEAN RESOLVED FILES ═══════════
function autoCleanResolved() {
  try {
    let deleted = 0;
    const brainDirs = fs.readdirSync(AG_BRAIN, { withFileTypes: true });
    for (const dir of brainDirs) {
      if (!dir.isDirectory() || dir.name === 'tempmediaStorage') continue;
      const sessionPath = path.join(AG_BRAIN, dir.name);
      try {
        const files = fs.readdirSync(sessionPath);
        for (const file of files) {
          if (file.includes('.resolved')) {
            try {
              fs.unlinkSync(path.join(sessionPath, file));
              deleted++;
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }
    if (deleted > 0) {
      console.log(`[AutoClean] ✅ Eliminados ${deleted} archivos .resolved`);
    }
  } catch (err) {
    console.error('[AutoClean] ❌ Error:', err.message);
  }
}

// ═══════════ MANTENIMIENTO PROFUNDO ═══════════

const AG_EXTENSIONS = path.join(app.getPath('home'), '.antigravity', 'extensions');
const AG_BROWSER_PROFILE = path.join(app.getPath('home'), '.gemini', 'antigravity-browser-profile');
const AG_APP_SUPPORT = path.join(app.getPath('home'), 'Library', 'Application Support', 'Antigravity');

// Extensiones esenciales que NO se deben borrar (actualizado abril 2026 post-limpieza)
const ESSENTIAL_EXTENSIONS = [
  'dbaeumer.vscode-eslint',
  'christian-kohler.npm-intellisense',
  'ms-azuretools.vscode-docker',
  'ms-python.python',
  'ms-python.debugpy',
  'davidanson.vscode-markdownlint',
  'redhat.vscode-yaml',
];

// Obtener info de mantenimiento
ipcMain.handle('ag:get-maintenance-info', async () => {
  const info = {
    extensiones: { total: 0, innecesarias: 0, listaInnecesarias: [], tamañoTotal: '0 B', tamañoInnecesarias: '0 B' },
    browserProfile: { tamaño: '0 B', tamañoBytes: 0, cacheLimpiable: '0 B', cacheLimpiableBytes: 0 },
    appSupport: { tamaño: '0 B', tamañoBytes: 0 },
  };

  // Extensiones
  try {
    if (fs.existsSync(AG_EXTENSIONS)) {
      const dirs = fs.readdirSync(AG_EXTENSIONS).filter(d => !d.endsWith('.json'));
      info.extensiones.total = dirs.length;
      let totalSize = 0;
      let innecesariasSize = 0;
      const innecesarias = [];

      for (const dir of dirs) {
        const dirPath = path.join(AG_EXTENSIONS, dir);
        const size = getDirectorySize(dirPath);
        totalSize += size;
        // Check if it's essential (match by prefix)
        const isEssential = ESSENTIAL_EXTENSIONS.some(e => dir.startsWith(e)) ||
                           dir.includes('theme') || dir.includes('material');
        if (!isEssential) {
          innecesarias.push({ nombre: dir, tamaño: formatBytes(size) });
          innecesariasSize += size;
        }
      }

      info.extensiones.total = dirs.length;
      info.extensiones.innecesarias = innecesarias.length;
      info.extensiones.listaInnecesarias = innecesarias;
      info.extensiones.tamañoTotal = formatBytes(totalSize);
      info.extensiones.tamañoInnecesarias = formatBytes(innecesariasSize);
    }
  } catch (err) { console.error('Error leyendo extensiones:', err.message); }

  // Browser profile
  try {
    if (fs.existsSync(AG_BROWSER_PROFILE)) {
      const totalSize = getDirectorySize(AG_BROWSER_PROFILE);
      info.browserProfile.tamaño = formatBytes(totalSize);
      info.browserProfile.tamañoBytes = totalSize;

      // Calcular cache limpiable
      let cacheSize = 0;
      const cacheDirs = [
        'OptGuideOnDeviceModel', 'optimization_guide_model_store', 'WasmTtsEngine',
        'GraphiteDawnCache', 'OnDeviceHeadSuggestModel', 'component_crx_cache',
        'extensions_crx_cache', 'Safe Browsing', 'Crashpad', 'recovery',
      ];
      for (const cd of cacheDirs) {
        const p = path.join(AG_BROWSER_PROFILE, cd);
        if (fs.existsSync(p)) cacheSize += getDirectorySize(p);
      }
      // Profile subdirs
      for (const profile of ['Default', 'Profile 1']) {
        const profileDir = path.join(AG_BROWSER_PROFILE, profile);
        if (!fs.existsSync(profileDir)) continue;
        for (const sub of ['Cache', 'Code Cache', 'Service Worker', 'GPUCache', 'DawnWebGPUCache', 'DawnGraphiteCache', 'blob_storage']) {
          const p = path.join(profileDir, sub);
          if (fs.existsSync(p)) cacheSize += getDirectorySize(p);
        }
      }
      info.browserProfile.cacheLimpiable = formatBytes(cacheSize);
      info.browserProfile.cacheLimpiableBytes = cacheSize;
    }
  } catch (err) { console.error('Error leyendo browser profile:', err.message); }

  // App Support
  try {
    if (fs.existsSync(AG_APP_SUPPORT)) {
      const size = getDirectorySize(AG_APP_SUPPORT);
      info.appSupport.tamaño = formatBytes(size);
      info.appSupport.tamañoBytes = size;
    }
  } catch (err) { console.error('Error leyendo app support:', err.message); }

  return info;
});

// Limpiar extensiones innecesarias
ipcMain.handle('ag:clean-extensions', async () => {
  let deleted = 0;
  let freedBytes = 0;
  const errors = [];

  try {
    if (!fs.existsSync(AG_EXTENSIONS)) {
      return { exito: true, eliminados: 0, espacioLiberado: '0 B', mensaje: 'No se encontró el directorio de extensiones' };
    }

    const dirs = fs.readdirSync(AG_EXTENSIONS).filter(d => !d.endsWith('.json'));
    for (const dir of dirs) {
      const isEssential = ESSENTIAL_EXTENSIONS.some(e => dir.startsWith(e)) ||
                         dir.includes('theme') || dir.includes('material');
      if (!isEssential) {
        const dirPath = path.join(AG_EXTENSIONS, dir);
        try {
          const size = getDirectorySize(dirPath);
          fs.rmSync(dirPath, { recursive: true, force: true });
          freedBytes += size;
          deleted++;
        } catch (e) {
          errors.push(`No se pudo eliminar ${dir}: ${e.message}`);
        }
      }
    }
  } catch (err) {
    return { exito: false, eliminados: 0, mensaje: `Error: ${err.message}` };
  }

  return {
    exito: true,
    eliminados: deleted,
    espacioLiberado: formatBytes(freedBytes),
    errores: errors,
    mensaje: deleted > 0
      ? `Eliminadas ${deleted} extensiones innecesarias (${formatBytes(freedBytes)} liberados). Reinicia Antigravity para aplicar.`
      : 'No se encontraron extensiones innecesarias.',
  };
});

// Limpiar cache del browser profile
ipcMain.handle('ag:clean-browser-cache', async () => {
  let freedBytes = 0;
  const errors = [];

  try {
    if (!fs.existsSync(AG_BROWSER_PROFILE)) {
      return { exito: true, espacioLiberado: '0 B', mensaje: 'No se encontró el browser profile' };
    }

    // Top-level cache dirs
    const topCacheDirs = [
      'OptGuideOnDeviceModel', 'optimization_guide_model_store', 'WasmTtsEngine',
      'GraphiteDawnCache', 'OnDeviceHeadSuggestModel', 'component_crx_cache',
      'extensions_crx_cache', 'Safe Browsing', 'Crashpad', 'BrowserMetrics',
      'recovery', 'hyphen-data', 'CertificateRevocation', 'SSLErrorAssistant',
      'MEIPreload', 'ZxcvbnData', 'OriginTrials', 'TrustTokenKeyCommitments',
      'FileTypePolicies', 'ThirdPartyModuleList64', 'pnacl',
    ];

    for (const dir of topCacheDirs) {
      const p = path.join(AG_BROWSER_PROFILE, dir);
      if (fs.existsSync(p)) {
        try {
          const size = getDirectorySize(p);
          fs.rmSync(p, { recursive: true, force: true });
          freedBytes += size;
        } catch (e) { errors.push(`${dir}: ${e.message}`); }
      }
    }

    // Profile subdirs
    const profileCacheDirs = [
      'Cache', 'Code Cache', 'Service Worker', 'GPUCache',
      'DawnWebGPUCache', 'DawnGraphiteCache', 'Shared Dictionary',
      'blob_storage', 'File System',
    ];

    for (const profile of ['Default', 'Profile 1']) {
      const profileDir = path.join(AG_BROWSER_PROFILE, profile);
      if (!fs.existsSync(profileDir)) continue;
      for (const sub of profileCacheDirs) {
        const p = path.join(profileDir, sub);
        if (fs.existsSync(p)) {
          try {
            const size = getDirectorySize(p);
            fs.rmSync(p, { recursive: true, force: true });
            freedBytes += size;
          } catch (e) { errors.push(`${profile}/${sub}: ${e.message}`); }
        }
      }
    }

    // App Support caches
    for (const sub of ['CachedData', 'CachedExtensions', 'CachedExtensionVSIXs', 'Cache', 'GPUCache', 'Code Cache']) {
      const p = path.join(AG_APP_SUPPORT, sub);
      if (fs.existsSync(p)) {
        try {
          const size = getDirectorySize(p);
          fs.rmSync(p, { recursive: true, force: true });
          freedBytes += size;
        } catch (e) { errors.push(`AppSupport/${sub}: ${e.message}`); }
      }
    }
  } catch (err) {
    return { exito: false, espacioLiberado: '0 B', mensaje: `Error: ${err.message}` };
  }

  return {
    exito: true,
    espacioLiberado: formatBytes(freedBytes),
    errores: errors,
    mensaje: freedBytes > 0
      ? `Cache limpiado: ${formatBytes(freedBytes)} liberados. Reinicia Antigravity para aplicar.`
      : 'No se encontró cache para limpiar.',
  };
});

// ═══════════ LIMPIEZA CACHE ANTIGRAVITY IDE ═══════════
// IMPORTANT: Only clean actual caches, NEVER delete user state
// (Local Storage, Session Storage, Preferences, User/, Cookies, Backups, machineid)
ipcMain.handle('ag:clean-antigravity-cache', async () => {
  let freedBytes = 0;
  const errors = [];

  const AG_IDE_SUPPORT = path.join(app.getPath('home'), 'Library', 'Application Support', 'Antigravity');

  // Subdirectories inside Application Support/Antigravity that are SAFE to delete (caches only)
  const safeCacheSubdirs = [
    'Cache', 'Code Cache', 'GPUCache', 'CachedData', 'CachedExtensionVSIXs',
    'DawnGraphiteCache', 'DawnWebGPUCache', 'Crashpad', 'blob_storage',
    'Shared Dictionary', 'logs', 'DIPS', 'DIPS-wal', 'DIPS-journal',
    'Trust Tokens', 'Trust Tokens-journal', 'SharedStorage', 'SharedStorage-wal',
    'Network Persistent State',
  ];

  // Clean only cache subdirs inside Application Support/Antigravity (preserve user state!)
  if (fs.existsSync(AG_IDE_SUPPORT)) {
    for (const sub of safeCacheSubdirs) {
      const p = path.join(AG_IDE_SUPPORT, sub);
      if (fs.existsSync(p)) {
        try {
          const stat = fs.statSync(p);
          const size = stat.isDirectory() ? getDirectorySize(p) : stat.size;
          fs.rmSync(p, { recursive: true, force: true });
          freedBytes += size;
        } catch (e) { errors.push(`Antigravity/${sub}: ${e.message}`); }
      }
    }
  }

  // These external dirs are safe to fully delete (system caches, not user state)
  const externalDirsToClean = [
    path.join(app.getPath('home'), 'Library', 'Caches', 'com.google.antigravity'),
    path.join(app.getPath('home'), 'Library', 'Caches', 'com.google.antigravity.ShipIt'),
    path.join(app.getPath('home'), 'Library', 'Caches', 'Antigravity'),
    path.join(app.getPath('home'), 'Library', 'Logs', 'Antigravity'),
  ];

  for (const dir of externalDirsToClean) {
    if (fs.existsSync(dir)) {
      try {
        const size = getDirectorySize(dir);
        fs.rmSync(dir, { recursive: true, force: true });
        freedBytes += size;
      } catch (e) { errors.push(`${path.basename(dir)}: ${e.message}`); }
    }
  }

  // NEVER delete these (they store user state):
  // - Application Support/Antigravity/Local Storage
  // - Application Support/Antigravity/Session Storage
  // - Application Support/Antigravity/Preferences
  // - Application Support/Antigravity/User/
  // - Application Support/Antigravity/Cookies
  // - Application Support/Antigravity/CachedProfilesData
  // - Application Support/Antigravity/Backups
  // - Application Support/Antigravity/machineid
  // - Library/Saved Application State/com.google.antigravity.savedState

  return {
    exito: true,
    espacioLiberado: formatBytes(freedBytes),
    errores: errors,
    mensaje: freedBytes > 0
      ? `Cache IDE limpiado: ${formatBytes(freedBytes)} liberados (estado de usuario preservado). Reinicia Antigravity IDE para aplicar.`
      : 'No se encontró cache de Antigravity IDE.',
  };
});

// ═══════════ KILL ZOMBIE PROCESSES (INFORMED) ═══════════
ipcMain.handle('ag:get-zombie-processes', async () => {
  try {
    // List all zombies and their parents (PPID)
    const { stdout } = await execAsync("ps -A -o stat,ppid,pid,comm | grep -e '^[Zz]' | grep -v grep", { timeout: 5000 });
    const lines = stdout.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return { ok: true, zombies: [] };

    const zombies = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const stat = parts[0];
      const ppid = parts[1];
      const pid = parts[2];
      const comm = parts.slice(3).join(' ');

      // Get parent name
      let parentName = "Unknown Process";
      try {
        const { stdout: pInfo } = await execAsync(`ps -p ${ppid} -o comm=`, { timeout: 2000 });
        parentName = pInfo.trim();
      } catch(e) {}

      zombies.push({ pid, ppid, stat, comm, parentName });
    }

    return { ok: true, zombies };
  } catch (e) {
    return { ok: true, zombies: [] };
  }
});

ipcMain.handle('ag:kill-processes', async (_e, pids) => {
  if (!Array.isArray(pids) || pids.length === 0) return { ok: false, error: "No PIDs provided" };
  try {
    await execAsync(`kill -9 ${pids.join(' ')}`, { timeout: 5000 });
    return { ok: true, mensaje: `SIGNAL_TERMINATED: ${pids.length} procesos eliminados.` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ═══════════ LISTAR EXTENSIONES INSTALADAS ═══════════
ipcMain.handle('ag:list-extensions', async () => {
  const extensions = [];
  try {
    const extJsonPath = path.join(app.getPath('home'), '.antigravity', 'extensions', 'extensions.json');
    if (fs.existsSync(extJsonPath)) {
      const data = JSON.parse(fs.readFileSync(extJsonPath, 'utf-8'));
      for (const ext of data) {
        const id = ext.identifier?.id || 'unknown';
        const version = ext.version || '?';
        const isEssential = ESSENTIAL_EXTENSIONS.some(e => id.startsWith(e)) || id.includes('theme') || id.includes('material');
        let size = 0;
        if (ext.location?.path) {
          try { size = getDirectorySize(ext.location.path); } catch {}
        }
        extensions.push({
          id,
          version,
          esencial: isEssential,
          tamaño: formatBytes(size),
          tamañoBytes: size,
        });
      }
    }
  } catch (err) {
    console.error('[Extensions] Error listing:', err.message);
  }
  return {
    total: extensions.length,
    esenciales: extensions.filter(e => e.esencial).length,
    innecesarias: extensions.filter(e => !e.esencial).length,
    extensiones: extensions,
  };
});

/* ════════════════════════════════════════════════════════════════
   AUTO-CHECK SERVIDORES (cada 30 minutos)
   ════════════════════════════════════════════════════════════════ */

let serverStatuses = {}; // { serverId: { ok: boolean, lastCheck: ISO, ram: string } }

async function autoCheckServers() {
  const servers = readServers();
  if (servers.length === 0) return;

  console.log(`[AutoCheck] Verificando ${servers.length} servidores...`);

  for (const server of servers) {
    try {
      // Parse SSH command
      const sshParts = server.ssh.trim().split(/\s+/);
      let sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes`;
      for (let i = 1; i < sshParts.length; i++) {
        if (sshParts[i] === '-i' && sshParts[i + 1]) {
          let keyPath = sshParts[i + 1];
          if (keyPath.startsWith('~')) {
            keyPath = keyPath.replace(/^~/, app.getPath('home'));
          }
          sshCmd += ` -i "${keyPath}"`;
          i++;
        }
      }
      const host = sshParts[sshParts.length - 1];
      sshCmd += ` ${host}`;

      // Quick check: just uptime + memory
      const { stdout } = await execAsync(`${sshCmd} "uptime -p 2>/dev/null || uptime; free -m | awk '/Mem/{printf \\"%d/%dMB\\", \\$3, \\$2}'"`, { timeout: 15000 });

      const lines = stdout.trim().split('\n');
      const ram = lines[lines.length - 1] || '';

      serverStatuses[server.id] = { ok: true, lastCheck: new Date().toISOString(), ram, nombre: server.nombre };
      console.log(`[AutoCheck] ✅ ${server.nombre} OK — ${ram}`);
    } catch (err) {
      const wasOk = serverStatuses[server.id]?.ok !== false;
      serverStatuses[server.id] = { ok: false, lastCheck: new Date().toISOString(), ram: `[ERR: ${err.message.substring(0, 40).replace(/\n/g, ' ')}]`, nombre: server.nombre };
      console.log(`[AutoCheck] ❌ ${server.nombre} NO RESPONDE: ${err.message}`);
      fs.appendFileSync('/tmp/brain_ssh_error.log', `[${server.nombre}] ERR: ${err.message}\n`);

      // Notify only on transition OK → FAIL
      if (wasOk && Notification.isSupported()) {
        new Notification({
          title: `⚠️ ${server.nombre} no responde`,
          body: `El servidor ${server.ip} no respondió al check SSH.`,
          silent: false,
        }).show();
      }
    }
  }

  // Update tray menu
  updateTrayMenu();

  // Send status to renderer
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('ag:server-statuses', serverStatuses);
  }
}

// IPC to get server statuses from renderer
ipcMain.handle('ag:get-server-statuses', async () => serverStatuses);

// IPC to force check all servers now
ipcMain.handle('ag:force-check-servers', async () => {
  await autoCheckServers();
  return serverStatuses;
});

/* ════════════════════════════════════════════════════════════════
   KI DAEMON (Auto-Extractor)
   ════════════════════════════════════════════════════════════════ */
// We use a config file to persist state
const KI_DAEMON_CONFIG = path.join(AG_BASE, 'ki-daemon-config.json');
let isKiAutoMode = true;
try {
  if (fs.existsSync(KI_DAEMON_CONFIG)) {
    const data = JSON.parse(fs.readFileSync(KI_DAEMON_CONFIG, 'utf-8'));
    if (typeof data.autoMode === 'boolean') isKiAutoMode = data.autoMode;
  }
} catch (err) {}

let kiDaemonInterval = null;

function runKiDaemon() {
  if (!isKiAutoMode) return;
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'ki-daemon.mjs');
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
         debugLog(`[KI Daemon] Error: ${error.message}`);
         return;
      }
      if (stdout && stdout.trim().length > 0) {
         debugLog(`[KI Daemon] ${stdout.trim()}`);
      }
    });
  } catch (err) {
    debugLog(`[KI Daemon] Spawn exception: ${err.message}`);
  }
}

// Check every 5 minutes (300,000 ms)
kiDaemonInterval = setInterval(runKiDaemon, 5 * 60 * 1000);

// Also run once 15 seconds after app startup if enabled
setTimeout(runKiDaemon, 15000);

ipcMain.handle('ag:get-ki-auto-mode', () => {
  return isKiAutoMode;
});

ipcMain.handle('ag:set-ki-auto-mode', (event, auto) => {
  isKiAutoMode = auto;
  fs.writeFileSync(KI_DAEMON_CONFIG, JSON.stringify({ autoMode: auto }), 'utf-8');
  debugLog(`KI Daemon auto mode set to: ${auto}`);
  if (auto) {
     runKiDaemon(); // trigger immediately
  }
  return isKiAutoMode;
});

/* ════════════════════════════════════════════════════════════════
   SYSTEM TRAY (Menu Bar)
   ════════════════════════════════════════════════════════════════ */

let tray = null;
let globalTrayIcon = null;
let globalTrayIconDim = null;

function createTray() {
  // Create a 16x16 template icon for macOS menu bar
  globalTrayIcon = nativeImage.createFromPath(
    path.join(__dirname, 'src', 'assets', 'logo-brain.png')
  ).resize({ width: 18, height: 18 });
  
  globalTrayIconDim = nativeImage.createFromPath(
    path.join(__dirname, 'src', 'assets', 'logo-brain-dim.png')
  ).resize({ width: 18, height: 18 });

  // Removed setTemplateImage(true) to keep the original logo colors

  tray = new Tray(globalTrayIcon);
  tray.setToolTip('Antigravity Brain');
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const servers = readServers();
  const serverItems = servers.map(s => {
    const status = serverStatuses[s.id];
    let indicator = '⚪';
    if (status) {
       indicator = status.ok ? '🟢' : '🔴';
    }
    let ram = status?.ram ? ` — ${status.ram}` : '';
    // Show offline reason if red
    if (status && !status.ok && !ram) ram = ' [Timeout/Offline]';
    const lastCheck = status?.lastCheck ? ` (${new Date(status.lastCheck).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})` : '';
    return {
      label: `${indicator} ${s.nombre}${ram}${lastCheck}`,
    };
  });
  const apis = readApis();
  const apiItems = apis.map(api => {
    const isLow = api.limiteAlerta > 0 && api.saldo < api.limiteAlerta;
    let indicator = isLow ? '[LOW_FUNDS]' : '[UPLINK_OK]';
    const isGemini = api.nombre.includes('Gemini') || api.nombre.includes('Antigravity');
    const isGoogle = api.nombre.includes('Google API');
    
    let displayValue = `${api.saldo.toFixed(2)}€`;
    if (api.nombre.includes('Impulse')) displayValue = `${api.saldo.toFixed(2)}GB`;
    if (api.nombre.includes('OpenRouter')) displayValue = `${api.saldo.toFixed(2)}$`;
    
    if (isGemini) {
      displayValue = 'FREE_TIER';
      indicator = '[SYS_API]';
    } else if (isGoogle) {
      displayValue = 'PREMIUM';
      indicator = '[SYS_API]';
    }
    
    return {
      label: `${indicator} ${api.nombre}: ${displayValue}`,
    };
  });

  const contextMenu = Menu.buildFromTemplate([
    { label: '[ ANTIGRAVITY BRAIN CACHE V2 ]', enabled: false },
    { type: 'separator' },
    ...serverItems,
    { type: 'separator' },
    ...apiItems,
    { type: 'separator' },
    {
      label: '> Check_Servers_Now',
      click: () => autoCheckServers(),
    },
    {
      label: '> Execute_Fast_Backup',
      click: async () => {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
          const backupDir = path.join(app.getPath('desktop'), 'antigravity_backups');
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          const backupFile = path.join(backupDir, `antigravity_backup_${timestamp}.zip`);
          execSync(`cd "${AG_BASE}" && zip -r "${backupFile}" . -x "*/node_modules/*"`, { timeout: 60000 });
          if (Notification.isSupported()) {
            new Notification({ title: 'Backup completado', body: `Guardado en ${backupFile}` }).show();
          }
        } catch (err) {
          console.error('[Tray] Backup error:', err.message);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Abrir Antigravity Brain',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) { win.show(); win.focus(); }
      },
    },
    {
      label: 'Salir',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/* ════════════════════════════════════════════════════════════════
   NOTIFICACIONES — API balance alerts
   ════════════════════════════════════════════════════════════════ */

function checkApiBalanceAlerts() {
  const apis = readApis();
  for (const api of apis) {
    if (api.saldo > 0 && api.limiteAlerta > 0 && api.saldo < api.limiteAlerta) {
      if (Notification.isSupported()) {
        new Notification({
          title: `⚠️ Saldo bajo: ${api.nombre}`,
          body: `Saldo: ${api.saldo.toFixed(2)}€ (alerta: <${api.limiteAlerta}€)`,
          silent: false,
        }).show();
      }
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   ANTIGRAVITY LIFECYCLE SYNC
   Brain se enciende con Antigravity y se apaga cuando cierra.
   - Watcher en brain/ para detectar nuevas sesiones → auto-show
   - Poll de proceso Antigravity cada 30s → auto-hide al cerrar
   ════════════════════════════════════════════════════════════════ */

let brainWatcher = null;
let antigravityProcessChecker = null;
let antigravityWasRunning = false;
let trayBlinkInterval = null;
let trayBlinkState = false;

function manageTrayBlink() {
  if (antigravityWasRunning) {
    if (!trayBlinkInterval) {
      trayBlinkInterval = setInterval(() => {
        trayBlinkState = !trayBlinkState;
        if (tray && globalTrayIcon && globalTrayIconDim) {
          tray.setImage(trayBlinkState ? globalTrayIcon : globalTrayIconDim);
        }
      }, 1000);
    }
  } else {
    if (trayBlinkInterval) {
      clearInterval(trayBlinkInterval);
      trayBlinkInterval = null;
      if (tray && globalTrayIcon) tray.setImage(globalTrayIcon);
    }
  }
}

function startAntigravityLifecycleSync() {
  // 1. Watch for new session folders in brain/ → Antigravity started a conversation
  try {
    brainWatcher = fs.watch(AG_BRAIN, { persistent: false }, (eventType, filename) => {
      if (eventType === 'rename' && filename && !filename.startsWith('.') && filename !== 'tempmediaStorage') {
        const sessionPath = path.join(AG_BRAIN, filename);
        try {
          if (fs.existsSync(sessionPath) && fs.statSync(sessionPath).isDirectory()) {
            // New session detected — Antigravity is active, show Brain
            console.log(`[Lifecycle] Antigravity session detected: ${filename.substring(0, 12)}…`);
            const win = BrowserWindow.getAllWindows()[0];
            if (win && !win.isVisible()) {
              win.show();
              win.focus();
            }
            if (!antigravityWasRunning) {
               antigravityWasRunning = true;
               manageTrayBlink();
            }
          }
        } catch { /* race condition, folder may be gone */ }
      }
    });
    console.log('[Lifecycle] Open Brain watcher active on', AG_BRAIN);
  } catch (err) {
    console.error('[Lifecycle] Failed to watch brain dir:', err.message);
  }

  // 2. Poll for ANY IDE process every 30s
  antigravityProcessChecker = setInterval(async () => {
    try {
      // Check if Antigravity, Cursor, Windsurf or Code is running
      const { stdout } = await execAsync(
        'pgrep -fl "Antigravity" 2>/dev/null || pgrep -fl "antigravity" 2>/dev/null || pgrep -fl "Cursor" 2>/dev/null || pgrep -fl "Windsurf" 2>/dev/null || pgrep -fl "Code" 2>/dev/null || echo ""',
        { timeout: 5000 }
      );
      const isRunning = stdout.trim().length > 0;

      if (isRunning && !antigravityWasRunning) {
        // IDE just started → show Brain
        console.log('[Lifecycle] Coding IDE detected — showing Open Brain');
        const win = BrowserWindow.getAllWindows()[0];
        if (win && !win.isVisible()) {
          win.show();
        }
        antigravityWasRunning = true;
        manageTrayBlink();
      } else if (!isRunning && antigravityWasRunning) {
        // IDE just closed → hide Brain to tray
        console.log('[Lifecycle] Coding IDE closed — hiding Open Brain to tray');
        const win = BrowserWindow.getAllWindows()[0];
        if (win && win.isVisible()) {
          win.hide();
        }
        antigravityWasRunning = false;
        manageTrayBlink();
        autoProcessMemoriesWithLlama();
      }
    } catch { /* pgrep not available or timeout */ }
  }, 30000);
}

// ════════════ AUTOMATIZACION OLLAMA LOCAL ════════════
async function autoProcessMemoriesWithLlama() {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    const notifyUI = (status) => win && win.webContents.send('ag:ollama-status', status);

    const ollamaCheck = await fetch('http://localhost:11434/api/tags').catch(()=>null);
    if (!ollamaCheck || !ollamaCheck.ok) return;

    if (!fs.existsSync(AG_BRAIN) || !fs.existsSync(AG_KNOWLEDGE)) return;
    const sessions = fs.readdirSync(AG_BRAIN).filter(f => !f.startsWith('.') && f !== 'tempmediaStorage');
    const existingKIs = fs.readdirSync(AG_KNOWLEDGE).filter(f => !f.startsWith('.'));

    for (let sessionId of sessions) {
       let hasKI = false;
       for (let kiFolder of existingKIs) {
         const metaPath = path.join(AG_KNOWLEDGE, kiFolder, 'metadata.json');
         if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              if (meta.references && meta.references.some(r => r.includes(sessionId))) {
                 hasKI = true; break;
              }
            } catch(e){}
         }
       }
       
       if (!hasKI) {
          const overviewPath = path.join(AG_BRAIN, sessionId, '.system_generated', 'logs', 'overview.txt');
          if (fs.existsSync(overviewPath)) {
             try {
                notifyUI({ active: true, processingSession: sessionId });
                const transcript = fs.readFileSync(overviewPath, 'utf8');
                const p = `Actúas como Antigravity Brain y extraes conocimiento. Resúmelo en español. Estructura el resumen final solo con ## Goal y ## Summary. Aquí está la sesión:\n\n${transcript.substring(0, 15000)}`;
                
                const llamaRes = await fetch('http://localhost:11434/api/generate', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ model: readSettings().localAiModel, prompt: p, stream: false })
                });

                if (llamaRes.ok) {
                   const jsonRes = await llamaRes.json();
                   const summaryText = jsonRes.response;
                   const cleanTitle = `Memoria Automática [${sessionId.substring(0,6)}]`;
                   
                   const slug = "session-" + sessionId;
                   const kiPath = path.join(AG_KNOWLEDGE, slug);
                   if (!fs.existsSync(kiPath)) fs.mkdirSync(kiPath, { recursive: true });
                   
                   const artifactsDir = path.join(kiPath, 'artifacts');
                   if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
                   fs.writeFileSync(path.join(artifactsDir, 'context.md'), summaryText);
                   fs.writeFileSync(path.join(kiPath, 'metadata.json'), JSON.stringify({
                      title: cleanTitle,
                      summary: "Generado localmente vía Llama 3.2 1B (Ollama)",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      references: [`session:${sessionId}`]
                   }, null, 2));
                   console.log(`[Ollama] KI Auto-generado para ${sessionId}`);
                }
             } catch(e) {
                console.error("[Ollama] Error generando resumen", e);
             }
          }
       }
    }
    notifyUI({ active: false, processingSession: null });
  } catch(e) {
    console.error("[Ollama System Exception]", e);
  }
}
// ═════════════════════════════════════════════════════

function stopAntigravityLifecycleSync() {
  if (brainWatcher) { brainWatcher.close(); brainWatcher = null; }
  if (antigravityProcessChecker) { clearInterval(antigravityProcessChecker); antigravityProcessChecker = null; }
  antigravityWasRunning = false;
  manageTrayBlink();
}

function revealWindow() {
  debugLog('revealWindow() called');
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    debugLog('Window revealed (existing instance)');
  } else {
    mainWindow = null; // clean up stale reference
    createWindow();
    debugLog('Window revealed (new instance created)');
  }
}

app.on('before-quit', () => {
  debugLog('before-quit triggered');
  isQuitting = true;
  stopAntigravityLifecycleSync();
});

// Only register second-instance handler in production
if (!isDev) {
  app.on('second-instance', () => {
    debugLog('second-instance (another instance launched)');
    revealWindow();
  });
}

app.whenReady().then(() => {
  debugLog('app.whenReady() triggered');

  // Set dock icon at the app level for brand consistency
  const dockIconPath = path.join(__dirname, 'src', 'assets', 'logo-brain.png');
  if (fs.existsSync(dockIconPath) && process.platform === 'darwin' && app.dock) {
    const dockIcon = nativeImage.createFromPath(dockIconPath);
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
      debugLog('Dock icon set at app level');
    }
  }

  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      name: 'Open Brain',
    });
  }

  setSpanishMenu();
  createWindow();
  createTray();

  autoSyncKnowledge();
  autoCleanResolved();
  setInterval(autoSyncKnowledge, 5 * 60 * 1000);
  setInterval(autoCleanResolved, 5 * 60 * 1000);

  setTimeout(() => {
    autoCheckServers();
    checkApiBalanceAlerts();
  }, 10000);
  setInterval(autoCheckServers, 30 * 60 * 1000);
  setInterval(checkApiBalanceAlerts, 30 * 60 * 1000);

  startAntigravityLifecycleSync();

  app.on('activate', () => {
    debugLog('app.on("activate") triggered (Dock click)');
    revealWindow();
  });
});

app.on('window-all-closed', () => {
  // In dev mode, quit normally so there are no zombie processes
  // In production on macOS, keep the process alive for tray/dock access
  if (process.platform !== 'darwin' || isDev) {
    app.quit();
  }
});
