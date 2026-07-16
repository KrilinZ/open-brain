/**
 * openrouter-chat.mjs — Cliente OpenRouter (API OpenAI-compatible) para el proceso main.
 *
 * SIN dependencias: usa fetch nativo (undici de Electron 41) y parseo manual de SSE.
 * Es "tonto": recibe `messages` ya compuestos; la inyección de contexto RAG la hace
 * un orquestador aguas arriba (Fase 3). La key nunca sale del proceso main.
 */

const BASE = 'https://openrouter.ai/api/v1';

function headers(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    // Atribución recomendada por OpenRouter
    'HTTP-Referer': 'https://openbrain.local',
    'X-Title': 'Open Brain',
  };
}

function codeFromStatus(status) {
  if (status === 401) return 'INVALID_KEY';
  if (status === 402) return 'INSUFFICIENT_CREDITS';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400) return 'BAD_REQUEST';
  if (status >= 500) return 'UPSTREAM';
  return 'NETWORK';
}

async function errorFromResponse(res) {
  let msg = `HTTP ${res.status}`;
  try { const j = await res.json(); msg = (j && j.error && j.error.message) || msg; } catch { /* body no JSON */ }
  const err = new Error(msg);
  err.code = codeFromStatus(res.status);
  return err;
}

/**
 * Chat con STREAMING. Llama onDelta(texto) por cada fragmento, onDone({finishReason,usage})
 * al terminar y onError(err) con err.code en caso de fallo (o CANCELLED si se aborta).
 */
export async function streamChat({
  apiKey, model, messages,
  temperature = 0.3, maxTokens = 1024, baseUrl = BASE,
  signal, onDelta, onDone, onError,
}) {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        model, messages, temperature, max_tokens: maxTokens,
        stream: true, usage: { include: true },
      }),
      signal,
    });
    if (!res.ok || !res.body) { onError && onError(await errorFromResponse(res)); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage = null;
    let finishReason = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Procesa por líneas COMPLETAS; conserva la última línea parcial entre chunks.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith(':')) continue;        // keep-alive / comentario SSE
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') { onDone && onDone({ finishReason, usage }); return; }
        let json;
        try { json = JSON.parse(data); } catch { continue; } // fragmento partido raro → sigue
        const choice = json.choices && json.choices[0];
        if (choice) {
          const delta = choice.delta && choice.delta.content;
          if (delta) onDelta && onDelta(delta);
          if (choice.finish_reason) finishReason = choice.finish_reason;
        }
        if (json.usage) usage = json.usage;
      }
    }
    onDone && onDone({ finishReason, usage });
  } catch (e) {
    const err = new Error(e && e.name === 'AbortError' ? 'cancelado' : (e.message || 'error de red'));
    err.code = e && e.name === 'AbortError' ? 'CANCELLED' : (e.code || 'NETWORK');
    onError && onError(err);
  }
}

/** Chat NO-streaming (una respuesta completa). Útil para resumir en la ingesta (Fase 4). */
export async function chatOnce({ apiKey, model, messages, temperature = 0.3, maxTokens = 1024, baseUrl = BASE, signal }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    signal,
  });
  if (!res.ok) throw await errorFromResponse(res);
  const json = await res.json();
  return {
    content: (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '',
    usage: json.usage || null,
  };
}

/** Lista de modelos disponibles en OpenRouter. */
export async function listModels(apiKey, baseUrl = BASE) {
  const res = await fetch(`${baseUrl}/models`, { headers: headers(apiKey), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw await errorFromResponse(res);
  const json = await res.json();
  return (json.data || []).map(m => ({
    id: m.id,
    name: m.name || m.id,
    context: m.context_length || null,
    promptPrice: m.pricing && m.pricing.prompt,
    completionPrice: m.pricing && m.pricing.completion,
  }));
}

/** Saldo restante en OpenRouter (créditos - uso). */
export async function getCredits(apiKey, baseUrl = BASE) {
  const res = await fetch(`${baseUrl}/credits`, { headers: headers(apiKey), signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw await errorFromResponse(res);
  const json = await res.json();
  const d = json.data || {};
  const total = d.total_credits || 0;
  const usage = d.total_usage || 0;
  return { total, usage, saldo: Math.max(0, total - usage) };
}
