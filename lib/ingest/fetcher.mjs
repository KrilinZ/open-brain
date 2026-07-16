/**
 * fetcher.mjs — Descarga de URLs con guarda anti-SSRF.
 * Bloquea esquemas no http/https, IPs privadas/loopback/link-local/metadata (169.254.169.254),
 * valida CADA redirect, y limita el tamaño. NUNCA renderiza el contenido remoto.
 */
import dns from 'dns/promises';
import net from 'net';

const MAX_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15000;

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 127) return true;                 // this-host / loopback
    if (a === 10) return true;                             // privada
    if (a === 172 && b >= 16 && b <= 31) return true;      // privada
    if (a === 192 && b === 168) return true;               // privada
    if (a === 169 && b === 254) return true;               // link-local + metadata cloud
    if (a >= 224) return true;                             // multicast/reservado
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fe80')) return true;               // link-local
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // ULA
    const m = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);    // IPv4-mapeada
    if (m) return isPrivateIP(m[1]);
    return false;
  }
  return true; // desconocido → bloquear
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error('IP no permitida (privada/local)');
    return;
  }
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length) throw new Error('el host no resuelve');
  for (const a of addrs) {
    if (isPrivateIP(a.address)) throw new Error(`el host resuelve a una IP privada (${a.address})`);
  }
}

export async function safeFetch(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('URL inválida'); }

  let redirects = 0;
  for (;;) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('solo se permiten http/https');
    await assertPublicHost(url.hostname);

    const res = await fetch(url.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'OpenBrain/2.0 (+https://openbrain.local)', 'Accept': 'text/html,application/xhtml+xml,application/pdf,text/plain,*/*' },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (++redirects > MAX_REDIRECTS) throw new Error('demasiados redirects');
      url = new URL(res.headers.get('location'), url.href); // se re-valida en la siguiente vuelta
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) { try { await reader.cancel(); } catch { /* noop */ } throw new Error('respuesta demasiado grande (>5MB)'); }
      chunks.push(Buffer.from(value));
    }
    return { finalUrl: url.href, contentType, buffer: Buffer.concat(chunks) };
  }
}
