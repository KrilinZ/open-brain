/**
 * config-store.mjs — config.json canónico de ajustes de producto de OpenBrain.
 *
 * IMPORTANTE: la API key de OpenRouter NO vive aquí. Vive cifrada en secure-store
 * (secrets.enc, id "openrouter") como ÚNICA fuente de verdad. Aquí solo modelo,
 * baseUrl, flags, límites de coste, privacidad y onboarding.
 * Deep-merge por sección (evita que un guardado anidado borre otras claves) + escritura atómica.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as secureStore from './secure-store.mjs';

const AG_BASE = path.join(os.homedir(), '.openbrain');
const CONFIG_FILE = path.join(AG_BASE, 'config.json');

export const DEFAULT_CONFIG = {
  version: 1,
  openrouter: {
    model: 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
    enabled: true,
  },
  paths: {
    base: AG_BASE,
    knowledge: path.join(AG_BASE, 'knowledge'),
  },
  flags: {
    onlyLocalEmbeddings: true,
    autoIngest: false,
    launchAtLogin: true,
    keyEncryption: true,
  },
  brain: {
    maxSpendPerSessionUsd: 1,
    temperature: 0.3,
    maxTokens: 1024,
    privacy: {
      localOnly: false,
      sendKiContext: true,
      redactOutbound: true,
      maxContextChars: 12000,
    },
  },
  onboarding: { completed: false, completedAt: null },
};

function deepMerge(base, over) {
  if (Array.isArray(over)) return over.slice();
  if (over && typeof over === 'object') {
    const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
    for (const k of Object.keys(over)) out[k] = deepMerge(out[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}

function readRaw() {
  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); }
  catch { /* corrupto → defaults */ }
  return null;
}

export function readConfig() {
  return deepMerge(DEFAULT_CONFIG, readRaw() || {});
}

function writeAtomic(obj) {
  fs.mkdirSync(AG_BASE, { recursive: true });
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, CONFIG_FILE);
}

/** Versión sanitizada para el renderer: jamás la key en claro. */
export function sanitize(cfg = readConfig()) {
  const clone = deepMerge(DEFAULT_CONFIG, cfg);
  clone.openrouter = {
    model: clone.openrouter.model,
    baseUrl: clone.openrouter.baseUrl,
    enabled: clone.openrouter.enabled,
    hasKey: secureStore.hasSecret('openrouter'),
    apiKeyMasked: secureStore.maskOf('openrouter'),
  };
  return clone;
}

export function getConfig() { return sanitize(readConfig()); }

/**
 * saveConfig(partial): deep-merge por sección. Si partial.openrouter.apiKey viene,
 * se cifra en secure-store (id "openrouter") y NUNCA se escribe en config.json.
 * Devuelve la config sanitizada.
 */
export function saveConfig(partial = {}) {
  const p = JSON.parse(JSON.stringify(partial || {}));
  if (p.openrouter && typeof p.openrouter.apiKey === 'string') {
    const key = p.openrouter.apiKey.trim();
    delete p.openrouter.apiKey;
    if (key) secureStore.setSecret('openrouter', key);
  }
  const merged = deepMerge(readConfig(), p);
  writeAtomic(merged);
  return sanitize(merged);
}

/** Siembra config.json en primer arranque (idempotente). Marca keyEncryption según disponibilidad real. */
export function ensureConfig() {
  if (!readRaw()) {
    const cfg = deepMerge(DEFAULT_CONFIG, {});
    cfg.flags.keyEncryption = secureStore.isEncryptionAvailable();
    writeAtomic(cfg);
  }
  return getConfig();
}
