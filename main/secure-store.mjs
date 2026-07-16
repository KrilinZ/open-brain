/**
 * secure-store.mjs — Cifrado de API keys en reposo con Electron safeStorage (Keychain de macOS).
 *
 * Es el ÚNICO punto del sistema que descifra keys, y solo en el proceso main.
 * Persiste ~/.openbrain/secrets.enc = { "<apiId>": "<base64 de safeStorage.encryptString>" }, chmod 600.
 * El renderer nunca recibe la key en claro (salvo revealConfigKey, bajo click explícito del usuario).
 */
import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

const AG_BASE = path.join(os.homedir(), '.openbrain');
const SECRETS_FILE = path.join(AG_BASE, 'secrets.enc');
const APIS_FILE = path.join(AG_BASE, 'apis.json');

export function isEncryptionAvailable() {
  try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
}

function readStore() {
  try { if (fs.existsSync(SECRETS_FILE)) return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')); }
  catch { /* corrupto → tratar como vacío */ }
  return {};
}

function writeStore(obj) {
  fs.mkdirSync(AG_BASE, { recursive: true });
  const tmp = SECRETS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, SECRETS_FILE);
  try { fs.chmodSync(SECRETS_FILE, 0o600); } catch { /* best-effort */ }
}

export function maskString(v) {
  if (!v) return null;
  const s = String(v);
  if (s.length <= 8) return '••••';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

export function setSecret(id, plain) {
  if (!id || typeof plain !== 'string' || plain.trim() === '') return false;
  if (!isEncryptionAvailable()) return false;
  const store = readStore();
  store[id] = safeStorage.encryptString(plain.trim()).toString('base64');
  writeStore(store);
  return true;
}

export function getSecret(id) {
  const b64 = readStore()[id];
  if (!b64 || !isEncryptionAvailable()) return null;
  try { return safeStorage.decryptString(Buffer.from(b64, 'base64')); }
  catch { return null; }
}

export function hasSecret(id) {
  return !!readStore()[id];
}

export function deleteSecret(id) {
  const store = readStore();
  if (store[id] === undefined) return false;
  delete store[id];
  writeStore(store);
  return true;
}

export function maskOf(id) {
  return maskString(getSecret(id));
}

/**
 * Migra idempotentemente las keys en claro de apis.json → secrets.enc.
 * Solo vacía apiKey si el round-trip (encrypt→decrypt) coincide exactamente.
 * Devuelve { available, migrated, skipped }.
 */
export function migrateFromApisJson() {
  if (!isEncryptionAvailable()) return { available: false, migrated: 0, skipped: 0 };

  let apis;
  try { apis = JSON.parse(fs.readFileSync(APIS_FILE, 'utf-8')); }
  catch { return { available: true, migrated: 0, skipped: 0 }; }
  if (!Array.isArray(apis)) return { available: true, migrated: 0, skipped: 0 };

  let migrated = 0, skipped = 0, changed = false;
  for (const api of apis) {
    if (!api || !api.id) continue;
    const key = (api.apiKey || '').trim();
    if (key) {
      const ok = setSecret(api.id, key);
      if (ok && getSecret(api.id) === key) {
        api.apiKey = '';
        api.hasKey = true;
        api.keyMask = maskString(key);
        migrated++; changed = true;
      } else {
        skipped++; // no vaciar si no se pudo verificar el cifrado
      }
    } else {
      const has = hasSecret(api.id);
      if (api.hasKey !== has) { api.hasKey = has; changed = true; }
      if (has && !api.keyMask) { api.keyMask = maskOf(api.id); changed = true; }
    }
  }
  if (changed) { try { fs.writeFileSync(APIS_FILE, JSON.stringify(apis, null, 2)); } catch { /* best-effort */ } }
  return { available: true, migrated, skipped };
}
