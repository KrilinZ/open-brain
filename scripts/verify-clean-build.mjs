#!/usr/bin/env node
/**
 * verify-clean-build.mjs — Guard de empaquetado: aborta si el árbol que se metería
 * en el DMG contiene datos personales o secretos. Se corre en app:build ANTES de electron-builder.
 * Garantiza el requisito "DMG vacío": ni KIs, ni keys, ni ficheros del vault.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
// Rutas que electron-builder mete en el bundle (según build.files de package.json).
const SCAN = ['dist', 'main.js', 'preload.cjs', 'main', 'lib', 'scripts', 'src/assets'];

const BAD_FILES = ['apis.json', 'config.json', 'settings.json', 'secrets.enc', 'servers.json', 'prompts.json'];
const BAD_DIRS = ['knowledge', '.openbrain', 'brain', 'chat_logs', 'conversations'];
const BAD_EXT = /\.(key|pem|dmg|blockmap)$/i;
const BAD_STR = [
  { re: /sk-or-v1-[A-Za-z0-9]{16,}/, name: 'OpenRouter key' },
  { re: /sk-ant-[A-Za-z0-9-]{16,}/, name: 'Anthropic key' },
  { re: /GOCSPX-[A-Za-z0-9_-]{10,}/, name: 'Google OAuth secret' },
  { re: /Bearer\s+[a-f0-9]{20,}/, name: 'Bearer token (hex)' },
  { re: /SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/, name: 'SendGrid key' },
];
const TEXT_EXT = /\.(js|mjs|cjs|ts|tsx|json|md|html|css)$/i;

const violations = [];
function scan(p) {
  let st; try { st = fs.statSync(p); } catch { return; }
  const base = path.basename(p);
  if (st.isDirectory()) {
    if (BAD_DIRS.includes(base)) { violations.push(`carpeta sensible en el bundle: ${rel(p)}`); return; }
    for (const e of fs.readdirSync(p)) scan(path.join(p, e));
    return;
  }
  if (BAD_FILES.includes(base)) { violations.push(`fichero de datos en el bundle: ${rel(p)}`); return; }
  if (BAD_EXT.test(base)) { violations.push(`credencial/artefacto en el bundle: ${rel(p)}`); return; }
  if (st.size < 512 * 1024 && TEXT_EXT.test(base)) {
    let txt = ''; try { txt = fs.readFileSync(p, 'utf-8'); } catch { return; }
    for (const { re, name } of BAD_STR) {
      if (re.test(txt)) { violations.push(`${name} embebido en ${rel(p)}`); break; }
    }
  }
}
const rel = p => path.relative(ROOT, p);

for (const s of SCAN) scan(path.join(ROOT, s));

if (violations.length) {
  console.error('\n🚫 verify-clean-build: el DMG NO puede empaquetarse, contiene datos sensibles:\n');
  for (const v of violations) console.error('  ✗ ' + v);
  console.error('\nEl vault y las keys deben vivir SOLO en ~/.openbrain (fuera del bundle). Limpia y reintenta.\n');
  process.exit(1);
}
console.log('✅ verify-clean-build: árbol de build limpio (0 KIs, 0 keys, 0 datos del autor).');
