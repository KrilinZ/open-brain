/**
 * chunk.mjs — Troceo de texto en fragmentos con solapamiento, respetando párrafos.
 * Compartido por el retriever (RAG) y la ingesta (Fase 4). Sin dependencias.
 */
export function chunkText(text, { maxChars = 1000, overlap = 150 } = {}) {
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const paras = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  const flush = () => { if (buf.trim()) chunks.push(buf.trim()); };

  for (let para of paras) {
    // Párrafo enorme → cortes duros con solapamiento
    while (para.length > maxChars) {
      if (buf) { flush(); buf = ''; }
      chunks.push(para.slice(0, maxChars));
      para = para.slice(maxChars - overlap);
    }
    if (buf && buf.length + para.length + 2 > maxChars) {
      flush();
      const tail = buf.slice(Math.max(0, buf.length - overlap));
      buf = tail + '\n\n' + para;
    } else {
      buf = buf ? buf + '\n\n' + para : para;
    }
  }
  flush();
  return chunks;
}
