/**
 * claude-client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Integración robusta con Anthropic Claude Sonnet (claude-3-5-sonnet-20241022)
 * Protección completa contra rate limits 429 (30 000 input tokens/min)
 *
 * Características:
 *   • Cola global con concurrencia 1 (configurable)
 *   • Control de presupuesto de input tokens por minuto con ventana deslizante
 *   • Exponential backoff con jitter en 429 y errores 5xx
 *   • Trimming automático de contexto antes del envío
 *   • max_tokens conservador y configurable
 *   • Logs operativos claros en cada fase
 *
 * USO:
 *   import { getClaudeClient } from '@/lib/claude-client';
 *
 *   const client = getClaudeClient({ apiKey: 'sk-ant-...' });
 *   const res = await client.sendMessage({
 *     messages: [{ role: 'user', content: 'Hola' }],
 *     systemPrompt: 'Eres un asistente...',
 *   });
 *   if (res.success) console.log(res.content);
 */

import Anthropic from '@anthropic-ai/sdk';

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN PÚBLICA
   ══════════════════════════════════════════════════════════════ */

export interface ClaudeConfig {
  /** API key de Anthropic (obligatoria) */
  apiKey: string;
  /** Modelo a usar */
  model: string;
  /** Tokens de input máximos por minuto antes de pausar */
  maxInputTokensPerMinute: number;
  /** max_tokens en la respuesta (conservador) */
  maxOutputTokens: number;
  /** Concurrencia de la cola (1 = estrictamente secuencial) */
  concurrency: number;
  /** Intentos máximos por request antes de rendirse */
  retryAttempts: number;
  /** Delay base en ms para el backoff exponencial */
  baseDelayMs: number;
  /** Número de chars en el historial que dispara el trimming */
  contextTrimCharsThreshold: number;
  /** Nivel de log: none | error | warn | info | debug */
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

const DEFAULT_CONFIG: ClaudeConfig = {
  apiKey: '',
  model: 'claude-3-5-sonnet-20241022',
  maxInputTokensPerMinute: 25_000,  // margen bajo el límite de 30 k
  maxOutputTokens: 4_096,           // conservador
  concurrency: 1,                   // cola secuencial, máximo control
  retryAttempts: 5,
  baseDelayMs: 1_000,
  contextTrimCharsThreshold: 120_000, // ≈ 30 k tokens
  logLevel: 'info',
};

/* ══════════════════════════════════════════════════════════════
   TIPOS INTERNOS
   ══════════════════════════════════════════════════════════════ */

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  messages: ClaudeMessage[];
  systemPrompt?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  success: boolean;
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
  rateLimitHit?: boolean;
}

interface QueueItem {
  id: string;
  request: ClaudeRequest;
  estimatedInputTokens: number;
  resolve: (r: ClaudeResponse) => void;
  reject: (e: Error) => void;
}

/* ══════════════════════════════════════════════════════════════
   LOGGER OPERATIVO
   ══════════════════════════════════════════════════════════════ */

const LOG_LEVELS = ['none', 'error', 'warn', 'info', 'debug'] as const;

function makeLogger(level: ClaudeConfig['logLevel']) {
  const currentIdx = LOG_LEVELS.indexOf(level);

  function emit(msgLevel: typeof LOG_LEVELS[number], msg: string, data?: unknown) {
    if (currentIdx <= 0) return;
    if (LOG_LEVELS.indexOf(msgLevel) > currentIdx) return;
    const ts = new Date().toISOString();
    const prefix = `[Claude:${msgLevel.toUpperCase()}] ${ts}`;
    if (data !== undefined) console.log(prefix, msg, data);
    else console.log(prefix, msg);
  }

  return {
    error: (m: string, d?: unknown) => emit('error', m, d),
    warn:  (m: string, d?: unknown) => emit('warn',  m, d),
    info:  (m: string, d?: unknown) => emit('info',  m, d),
    debug: (m: string, d?: unknown) => emit('debug', m, d),
  };
}

type Logger = ReturnType<typeof makeLogger>;

/* ══════════════════════════════════════════════════════════════
   GESTOR DE PRESUPUESTO DE TOKENS/MINUTO
   ══════════════════════════════════════════════════════════════ */

class TokenBudget {
  private used = 0;
  private windowStart = Date.now();
  private readonly windowMs = 60_000;
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  private tick() {
    if (Date.now() - this.windowStart >= this.windowMs) {
      this.used = 0;
      this.windowStart = Date.now();
    }
  }

  canSpend(tokens: number): boolean {
    this.tick();
    return this.used + tokens <= this.max;
  }

  spend(tokens: number) {
    this.tick();
    this.used += tokens;
  }

  status(): { used: number; max: number; remaining: number; resetInMs: number } {
    this.tick();
    return {
      used: this.used,
      max: this.max,
      remaining: this.max - this.used,
      resetInMs: Math.max(0, this.windowMs - (Date.now() - this.windowStart)),
    };
  }
}

/* ══════════════════════════════════════════════════════════════
   CLIENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */

export class ClaudeClient {
  private readonly anthropic: Anthropic;
  private readonly cfg: ClaudeConfig;
  private readonly budget: TokenBudget;
  private readonly log: Logger;

  private queue: QueueItem[] = [];
  private active = 0;
  private running = false;

  constructor(config: Partial<ClaudeConfig> & { apiKey: string }) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    if (!this.cfg.apiKey) throw new Error('[Claude] apiKey es obligatorio');

    this.anthropic = new Anthropic({ apiKey: this.cfg.apiKey, dangerouslyAllowBrowser: true });
    this.budget = new TokenBudget(this.cfg.maxInputTokensPerMinute);
    this.log = makeLogger(this.cfg.logLevel);

    this.log.info('Cliente inicializado', {
      model: this.cfg.model,
      maxInputTokensPerMinute: this.cfg.maxInputTokensPerMinute,
      maxOutputTokens: this.cfg.maxOutputTokens,
      concurrency: this.cfg.concurrency,
      retryAttempts: this.cfg.retryAttempts,
    });
  }

  /* ── Estimación de tokens (4 chars ≈ 1 token) ─────────────── */

  private estimate(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateRequest(req: ClaudeRequest): number {
    let n = req.messages.reduce((acc, m) => acc + this.estimate(m.content), 0);
    if (req.systemPrompt) n += this.estimate(req.systemPrompt);
    n += req.messages.length * 10; // overhead de estructura
    return n;
  }

  /* ── Trimming automático de contexto ──────────────────────── */

  private trim(req: ClaudeRequest): ClaudeRequest {
    const totalChars = req.messages.reduce((s, m) => s + m.content.length, 0);

    if (totalChars <= this.cfg.contextTrimCharsThreshold) return req;

    this.log.warn('Contexto demasiado largo, aplicando trim', {
      totalChars,
      threshold: this.cfg.contextTrimCharsThreshold,
    });

    const target = Math.floor(this.cfg.contextTrimCharsThreshold * 0.75);
    const msgs = [...req.messages];
    const last = msgs.pop()!; // siempre preservamos el último mensaje
    const kept: ClaudeMessage[] = [];
    let acc = last.content.length;

    // Añadir mensajes desde el final hacia atrás hasta llenar el presupuesto
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (acc + m.content.length > target) break;
      kept.unshift(m);
      acc += m.content.length;
    }

    kept.push(last);

    this.log.info('Trim completado', {
      messagesBefore: req.messages.length,
      messagesAfter: kept.length,
    });

    return { ...req, messages: kept };
  }

  /* ── Backoff exponencial con jitter ───────────────────────── */

  private backoff(attempt: number, base = this.cfg.baseDelayMs): number {
    const exp = Math.min(base * 2 ** attempt, 30_000);
    const jitter = exp * (Math.random() * 0.2 - 0.1); // ±10 %
    return Math.round(exp + jitter);
  }

  private sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  /* ── Llamada real a la API con retry ─────────────────────── */

  private async callApi(req: ClaudeRequest, attempt = 0): Promise<ClaudeResponse> {
    const t0 = Date.now();

    try {
      const res = await this.anthropic.messages.create({
        model: this.cfg.model,
        max_tokens: req.maxOutputTokens ?? this.cfg.maxOutputTokens,
        temperature: req.temperature ?? 0.1,
        ...(req.systemPrompt ? { system: req.systemPrompt } : {}),
        messages: req.messages,
      });

      const inputTokens  = res.usage?.input_tokens  ?? 0;
      const outputTokens = res.usage?.output_tokens ?? 0;

      // Registrar tokens consumidos reales en el presupuesto
      this.budget.spend(inputTokens);

      this.log.info('Llamada exitosa', {
        ms: Date.now() - t0,
        inputTokens,
        outputTokens,
        budgetRemaining: this.budget.status().remaining,
      });

      return {
        success: true,
        content: res.content[0]?.type === 'text' ? res.content[0].text : '',
        inputTokens,
        outputTokens,
      };

    } catch (err: unknown) {
      const e = err as { status?: number; headers?: Record<string, string>; message?: string };

      /* 429 — Rate limit */
      if (e.status === 429) {
        const retryAfterSec = parseInt(e.headers?.['retry-after'] ?? '60', 10);
        const retryAfterMs  = retryAfterSec * 1_000;

        this.log.warn('429 Rate limit hit', {
          attempt: attempt + 1,
          retryAfterMs,
          ms: Date.now() - t0,
        });

        if (attempt >= this.cfg.retryAttempts) {
          this.log.error('Reintentos agotados tras 429');
          return { success: false, error: 'Rate limit: reintentos agotados', rateLimitHit: true };
        }

        const delay = Math.max(retryAfterMs, this.backoff(attempt));
        this.log.info(`Esperando ${delay} ms antes del reintento ${attempt + 2}…`);
        await this.sleep(delay);
        return this.callApi(req, attempt + 1);
      }

      /* 5xx / red — backoff y retry */
      const isTransient = (e.status ?? 0) >= 500;
      if (isTransient && attempt < this.cfg.retryAttempts) {
        const delay = this.backoff(attempt);
        this.log.warn(`Error transitorio (${e.status}), retry en ${delay} ms`, {
          attempt: attempt + 1,
        });
        await this.sleep(delay);
        return this.callApi(req, attempt + 1);
      }

      this.log.error('API call fallida definitivamente', {
        status: e.status,
        message: e.message,
        attempt: attempt + 1,
        ms: Date.now() - t0,
      });

      return { success: false, error: e.message ?? 'Error desconocido' };
    }
  }

  /* ── Procesamiento de la cola ─────────────────────────────── */

  private schedule() {
    if (this.running) return;
    this.running = true;
    this.drainQueue();
  }

  private async drainQueue() {
    while (this.queue.length > 0) {
      // Respetar concurrencia
      if (this.active >= this.cfg.concurrency) {
        await this.sleep(50);
        continue;
      }

      const item = this.queue[0];

      // Verificar presupuesto de tokens
      if (!this.budget.canSpend(item.estimatedInputTokens)) {
        const { resetInMs, remaining } = this.budget.status();
        this.log.warn('Presupuesto insuficiente, esperando ventana de minuto', {
          estimated: item.estimatedInputTokens,
          remaining,
          resetInMs,
        });
        await this.sleep(Math.min(resetInMs + 500, 10_000));
        continue;
      }

      // Sacar de la cola y procesar
      this.queue.shift();
      this.active++;

      // Pre-gasto estimado para no solapar otros requests
      this.budget.spend(item.estimatedInputTokens);

      this.log.debug('Procesando request de cola', {
        id: item.id,
        estimatedInputTokens: item.estimatedInputTokens,
        queueLength: this.queue.length,
      });

      const trimmed = this.trim(item.request);

      this.callApi(trimmed)
        .then(res => item.resolve(res))
        .catch(e  => item.reject(e))
        .finally(() => { this.active--; });

      // Pequeña pausa entre requests para no saturar
      await this.sleep(200);
    }

    this.running = false;
  }

  /* ══════════════════════════════════════════════════════════
     API PÚBLICA
  ══════════════════════════════════════════════════════════ */

  /**
   * Envía un mensaje a Claude. La llamada se encola y se procesa
   * respetando la concurrencia y el presupuesto de tokens/min.
   */
  sendMessage(request: ClaudeRequest): Promise<ClaudeResponse> {
    const id = Math.random().toString(36).slice(2, 10);
    const estimatedInputTokens = this.estimateRequest(request);

    this.log.debug('Encolando request', {
      id,
      estimatedInputTokens,
      queueLength: this.queue.length,
    });

    return new Promise<ClaudeResponse>((resolve, reject) => {
      this.queue.push({ id, request, estimatedInputTokens, resolve, reject });
      this.schedule();
    });
  }

  /** Estado actual del presupuesto de tokens */
  budgetStatus() {
    return this.budget.status();
  }

  /** Estado actual de la cola */
  queueStatus() {
    return {
      pending: this.queue.length,
      active: this.active,
      concurrency: this.cfg.concurrency,
    };
  }

  /** Actualiza parámetros en caliente (sin perder la cola) */
  updateConfig(patch: Partial<ClaudeConfig>) {
    Object.assign(this.cfg, patch);
    this.log.info('Configuración actualizada', patch);
  }
}

/* ══════════════════════════════════════════════════════════════
   SINGLETON GLOBAL
   ══════════════════════════════════════════════════════════════ */

let _instance: ClaudeClient | null = null;

/**
 * Devuelve la instancia singleton del cliente.
 * En el primer uso se debe pasar `{ apiKey: '...' }`.
 * Los siguientes usos sin argumentos devuelven la instancia existente.
 */
export function getClaudeClient(config?: Partial<ClaudeConfig> & { apiKey?: string }): ClaudeClient {
  if (!_instance) {
    if (!config?.apiKey) {
      throw new Error('[Claude] Debes pasar apiKey en el primer uso de getClaudeClient()');
    }
    _instance = new ClaudeClient(config as ClaudeConfig & { apiKey: string });
  } else if (config) {
    _instance.updateConfig(config);
  }
  return _instance;
}

/** Destruye el singleton (útil en tests) */
export function resetClaudeClient() {
  _instance = null;
}
