/**
 * extract.mjs — Convierte una URL en markdown limpio.
 * HTML → (strip scripts) → jsdom → Readability (artículo principal) → turndown (markdown).
 * PDF → doc-parse. El contenido remoto se trata como DATOS no confiables (nunca se ejecuta ni renderiza).
 */
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import crypto from 'crypto';
import { safeFetch } from './fetcher.mjs';
import { extractPdf } from './doc-parse.mjs';

function stripDangerous(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '');
}

const md5 = s => crypto.createHash('md5').update(String(s)).digest('hex');

export async function fetchAndExtract(rawUrl) {
  const { finalUrl, contentType, buffer } = await safeFetch(rawUrl);

  // PDF remoto
  if (contentType.includes('application/pdf') || finalUrl.toLowerCase().split('?')[0].endsWith('.pdf')) {
    const text = (await extractPdf(buffer)).trim();
    return {
      title: decodeURIComponent(finalUrl.split('/').pop() || finalUrl),
      markdown: text, excerpt: text.slice(0, 200),
      finalUrl, contentType, wordCount: text.split(/\s+/).filter(Boolean).length, contentHash: md5(text),
    };
  }

  const html = stripDangerous(buffer.toString('utf-8'));
  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  let article = null;
  try { article = new Readability(doc).parse(); } catch { /* fallback abajo */ }

  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

  if (article && article.content) {
    const markdown = td.turndown(article.content).trim();
    return {
      title: (article.title || doc.title || finalUrl).trim(),
      excerpt: article.excerpt || markdown.slice(0, 200),
      markdown, finalUrl, contentType,
      wordCount: (article.textContent || '').split(/\s+/).filter(Boolean).length,
      contentHash: md5(markdown),
    };
  }

  // Fallback: texto plano del body
  const text = (doc.body && doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000);
  return {
    title: (doc.title || finalUrl).trim(), excerpt: text.slice(0, 200),
    markdown: text, finalUrl, contentType, wordCount: text.split(/\s+/).filter(Boolean).length, contentHash: md5(text),
  };
}
