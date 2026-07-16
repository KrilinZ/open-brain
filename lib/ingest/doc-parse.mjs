/**
 * doc-parse.mjs — Extrae texto de documentos: PDF (pdf-parse v2), DOCX (mammoth), TXT/MD directos.
 */
import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractPdf(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const res = await parser.getText();
    if (typeof res === 'string') return res;
    return (res && (res.text || res.value)) || '';
  } finally {
    try { await parser.destroy(); } catch { /* noop */ }
  }
}

function titleFrom(content, fallback) {
  const h = content.match(/^#{1,3}\s+(.+)$/m);
  if (h) return h[1].trim().slice(0, 80);
  const firstLine = content.split('\n').map(s => s.trim()).find(Boolean);
  return (firstLine ? firstLine.slice(0, 80) : fallback);
}

/** Parsea un fichero a { title, content, format, chars }. */
export async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath, ext);
  let content = '';

  if (ext === '.txt' || ext === '.md' || ext === '.markdown') {
    content = fs.readFileSync(filePath, 'utf-8');
  } else if (ext === '.pdf') {
    content = await extractPdf(fs.readFileSync(filePath));
  } else if (ext === '.docx') {
    const r = await mammoth.convertToMarkdown({ path: filePath });
    content = r.value || '';
  } else {
    throw new Error(`formato no soportado: ${ext || '(sin extensión)'}`);
  }

  content = String(content).trim();
  if (!content) throw new Error('el documento no contiene texto extraíble');
  return { title: titleFrom(content, base), content, format: ext.slice(1) || 'txt', chars: content.length };
}
