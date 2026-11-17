/**
 * Dedicated Ollama Cloud client for Shreeji AI 2.0.
 * Handles timeouts, bounded retries, exponential backoff, circuit breaker, and correlation IDs.
 */

const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = Number(process.env.ASSISTANT_MODEL_TIMEOUT_MS) || 25_000;
const MAX_RETRIES = Number(process.env.ASSISTANT_MODEL_RETRIES) || 2;
const BASE_BACKOFF_MS = 400;
const CIRCUIT_OPEN_MS = Number(process.env.ASSISTANT_MODEL_PAUSE_MS) || 5 * 60 * 1000;
const BILLING_CIRCUIT_OPEN_MS = Number(process.env.ASSISTANT_MODEL_BILLING_PAUSE_MS) || 15 * 60 * 1000;
const CIRCUIT_FAILURE_THRESHOLD = 3;

const circuit = {
  openUntil: 0,
  consecutiveAuthFailures: 0,
  consecutiveTransientFailures: 0,
  lastError: null,
  lastErrorDetail: null,
  lastSuccessAt: 0,
  halfOpen: false,
  providerActionRequired: false,
};

function correlationId() {
  return crypto.randomBytes(8).toString('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bodyLooksLikeBilling(message) {
  return /usage credit|subscribe|billing|payment required|extra usage|quota|plans/i.test(String(message || ''));
}

function classifyError(status, message, name) {
  if (name === 'TimeoutError' || /timed? ?out/i.test(message || '')) {
    return { code: 'MODEL_TIMEOUT', retryable: true, message: 'The AI service did not respond in time.' };
  }
  if (status === 401 || status === 403) {
    return { code: 'MODEL_AUTH', retryable: false, message: 'The AI service rejected the API credentials.' };
  }
  if (status === 402 || bodyLooksLikeBilling(message)) {
    return {
      code: 'MODEL_BILLING',
      retryable: false,
      providerActionRequired: true,
      message: 'The AI service requires usage credits or an active Ollama plan. Add credits at ollama.com/plans. Your database has not been changed.',
    };
  }
  if (status === 429) {
    return { code: 'MODEL_RATE_LIMIT', retryable: true, message: 'The AI service rate limit was reached.' };
  }
  if (status === 404 || status === 503 || status === 502) {
    return { code: 'MODEL_UNAVAILABLE', retryable: true, message: 'The AI model is temporarily unavailable.' };
  }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|network/i.test(message || '')) {
    return { code: 'MODEL_NETWORK', retryable: true, message: 'Could not reach the AI service.' };
  }
  return { code: 'MODEL_ERROR', retryable: false, message: message || 'The AI service failed.' };
}

function getModelConfig() {
  return {
    apiKey: process.env.OLLAMA_API_KEY || '',
    baseUrl: (process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1').replace(/\/$/, ''),
    model: process.env.OLLAMA_MODEL || 'deepseek-v4.1-flash',
  };
}

function getCircuitStatus() {
  const now = Date.now();
  const open = now < circuit.openUntil;
  return {
    open,
    halfOpen: !open && circuit.halfOpen === true,
    openUntil: circuit.openUntil || null,
    lastError: circuit.lastError,
    lastErrorDetail: circuit.lastErrorDetail,
    lastSuccessAt: circuit.lastSuccessAt || null,
    providerActionRequired: circuit.providerActionRequired === true,
    available: Boolean(process.env.OLLAMA_API_KEY) && (!open || circuit.halfOpen === true),
  };
}

function tripCircuit(reason, ms = CIRCUIT_OPEN_MS, detail = null) {
  circuit.openUntil = Date.now() + ms;
  circuit.lastError = reason;
  circuit.lastErrorDetail = detail ? String(detail).slice(0, 300) : null;
  circuit.halfOpen = false;
  circuit.providerActionRequired = reason === 'MODEL_BILLING' || reason === 'MODEL_AUTH';
}

function recordSuccess() {
  circuit.consecutiveAuthFailures = 0;
  circuit.consecutiveTransientFailures = 0;
  circuit.lastSuccessAt = Date.now();
  circuit.openUntil = 0;
  circuit.halfOpen = false;
  circuit.providerActionRequired = false;
  circuit.lastError = null;
  circuit.lastErrorDetail = null;
}

function resetCircuit() {
  circuit.openUntil = 0;
  circuit.consecutiveAuthFailures = 0;
  circuit.consecutiveTransientFailures = 0;
  circuit.lastError = null;
  circuit.lastErrorDetail = null;
  circuit.halfOpen = false;
  circuit.providerActionRequired = false;
}

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * @param {{ messages: Array<{role:string, content:string}>, temperature?: number, json?: boolean, timeoutMs?: number, signal?: AbortSignal, bypassCircuit?: boolean }} options
 */
async function chatCompletions(options = {}) {
  const id = correlationId();
  const config = getModelConfig();
  if (!config.apiKey) {
    return {
      ok: false,
      correlationId: id,
      error: { code: 'MODEL_NOT_CONFIGURED', message: 'OLLAMA_API_KEY is not set.', retryable: false },
    };
  }

  const now = Date.now();
  if (!options.bypassCircuit && now < circuit.openUntil) {
    return {
      ok: false,
      quiet: true,
      correlationId: id,
      error: {
        code: circuit.lastError === 'MODEL_BILLING' ? 'MODEL_BILLING' : 'MODEL_CIRCUIT_OPEN',
        message: circuit.lastError === 'MODEL_BILLING'
          ? 'The AI service requires usage credits or an active Ollama plan. Your database has not been changed.'
          : 'The AI service is temporarily paused after repeated failures. Your database has not been changed.',
        retryable: circuit.lastError !== 'MODEL_BILLING' && circuit.lastError !== 'MODEL_AUTH',
        providerActionRequired: circuit.providerActionRequired === true,
      },
    };
  }

  // Half-open: after pause expires, allow one probe before fully closing.
  if (!options.bypassCircuit && circuit.openUntil && now >= circuit.openUntil) {
    circuit.halfOpen = true;
    circuit.openUntil = 0;
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxAttempts = 1 + Math.max(0, Math.min(MAX_RETRIES, 3));
  let lastFailure = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timer);
        return {
          ok: false,
          correlationId: id,
          error: { code: 'MODEL_CANCELLED', message: 'The AI request was cancelled.', retryable: false },
        };
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'X-Request-Id': id,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          temperature: options.temperature ?? 0,
          ...(options.json === false ? {} : { response_format: { type: 'json_object' } }),
          messages: options.messages,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const classified = classifyError(response.status, body.slice(0, 300), null);
        lastFailure = classified;

        // Never retry auth/billing/quota failures.
        if (!classified.retryable || [401, 402, 403].includes(response.status)) {
          circuit.consecutiveAuthFailures += 1;
          const pauseMs = classified.code === 'MODEL_BILLING' ? BILLING_CIRCUIT_OPEN_MS : CIRCUIT_OPEN_MS;
          tripCircuit(classified.code, pauseMs, body.slice(0, 200));
          break;
        }

        if (classified.retryable && attempt < maxAttempts) {
          circuit.consecutiveTransientFailures += 1;
          await sleep(BASE_BACKOFF_MS * (2 ** (attempt - 1)));
          continue;
        }
        if (circuit.consecutiveTransientFailures + 1 >= CIRCUIT_FAILURE_THRESHOLD) {
          tripCircuit(classified.code, Math.min(CIRCUIT_OPEN_MS, 60_000), body.slice(0, 200));
        }
        break;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      recordSuccess();
      return {
        ok: true,
        correlationId: id,
        content,
        parsed: options.json === false ? null : extractJson(content),
        raw: data,
      };
    } catch (error) {
      const name = error?.name === 'AbortError' ? 'TimeoutError' : error?.name;
      const classified = classifyError(null, error?.message, name);
      lastFailure = classified;
      if (classified.retryable && attempt < maxAttempts && !options.signal?.aborted) {
        circuit.consecutiveTransientFailures += 1;
        await sleep(BASE_BACKOFF_MS * (2 ** (attempt - 1)));
        continue;
      }
      if (!classified.retryable) {
        tripCircuit(classified.code, CIRCUIT_OPEN_MS, error?.message);
      } else if (circuit.consecutiveTransientFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        tripCircuit(classified.code, Math.min(CIRCUIT_OPEN_MS, 60_000), error?.message);
      }
      break;
    } finally {
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
    }
  }

  return {
    ok: false,
    correlationId: id,
    quiet: lastFailure?.code === 'MODEL_CIRCUIT_OPEN' || lastFailure?.code === 'MODEL_BILLING',
    error: lastFailure || { code: 'MODEL_ERROR', message: 'The AI service failed.', retryable: false },
  };
}

/**
 * Safe health probe used by /assistant/health. Never logs secrets.
 */
async function probeModelAvailability() {
  const config = getModelConfig();
  if (!config.apiKey) {
    return {
      available: false,
      code: 'MODEL_NOT_CONFIGURED',
      message: 'OLLAMA_API_KEY is not set.',
      providerActionRequired: false,
    };
  }

  const response = await chatCompletions({
    bypassCircuit: true,
    timeoutMs: 12_000,
    temperature: 0,
    json: true,
    messages: [
      { role: 'system', content: 'Return only JSON: {"ok":true}' },
      { role: 'user', content: 'ping' },
    ],
  });

  if (response.ok) {
    return {
      available: true,
      code: 'OK',
      message: 'Model is reachable.',
      providerActionRequired: false,
      correlationId: response.correlationId,
      model: config.model,
      baseUrl: config.baseUrl,
    };
  }

  return {
    available: false,
    code: response.error?.code || 'MODEL_ERROR',
    message: response.error?.message || 'Model probe failed.',
    providerActionRequired: response.error?.providerActionRequired === true
      || response.error?.code === 'MODEL_BILLING'
      || response.error?.code === 'MODEL_AUTH',
    correlationId: response.correlationId,
    model: config.model,
    baseUrl: config.baseUrl,
  };
}

module.exports = {
  chatCompletions,
  extractJson,
  getCircuitStatus,
  getModelConfig,
  correlationId,
  classifyError,
  probeModelAvailability,
  resetCircuit,
  // test helpers
  _circuit: circuit,
  _tripCircuit: tripCircuit,
  _recordSuccess: recordSuccess,
};
