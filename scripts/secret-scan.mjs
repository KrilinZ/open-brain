#!/usr/bin/env node
/**
 * secret-scan.mjs — Escáner de secretos para pre-commit (cero dependencias).
 * Falla el commit si el contenido STAGED contiene claves reales.
 * Instalación del hook:  git config core.hooksPath .githooks   (ver .githooks/pre-commit)
 * Uso manual:            node scripts/secret-scan.mjs
 */
import { execSync } from 'child_process';

const PATTERNS = [
  { re: /sk-or-v1-[A-Za-z0-9]{16,}/, name: 'OpenRouter key' },
  { re: /sk-ant-[A-Za-z0-9-]{16,}/, name: 'Anthropic key' },
  { re: /GOCSPX-[A-Za-z0-9_-]{10,}/, name: 'Google OAuth secret' },
  { re: /Bearer\s+[a-f0-9]{20,}/, name: 'Bearer token (hex)' },
  { re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/, name: 'JWT' },
  { re: /SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/, name: 'SendGrid key' },
];

let staged = '';
try {
  const files = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
    .split('\n').map(f => f.trim()).filter(Boolean);
  for (const f of files) {
    let content = '';
    try { content = execSync(`git show :${JSON.stringify(f)}`, { encoding: 'utf-8' }); } catch { continue; }
    staged += `\n===FILE:${f}===\n${content}`;
  }
} catch (e) {
  console.error('secret-scan: no se pudo leer el diff staged:', e.message);
  process.exit(0); // no bloquear si no hay repo/diff
}

const hits = [];
for (const line of staged.split('\n')) {
  for (const p of PATTERNS) if (p.re.test(line)) hits.push(`${p.name}: ${line.trim().slice(0, 80)}`);
}

if (hits.length) {
  console.error('\n🚫 secret-scan: se detectaron posibles secretos en el commit:\n');
  for (const h of hits) console.error('  ✗ ' + h);
  console.error('\nQuita los secretos (usa variables/keychain) antes de commitear.\n');
  process.exit(1);
}
console.log('✅ secret-scan: sin secretos en el staging.');
