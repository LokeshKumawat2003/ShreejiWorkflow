/* Probe Ollama Cloud without printing secrets. */
require('dotenv').config();

function redact(text, key) {
  let out = String(text || '');
  if (key) out = out.split(key).join('[REDACTED]');
  out = out.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]');
  return out.slice(0, 500);
}

async function main() {
  const key = process.env.OLLAMA_API_KEY || '';
  const base = (process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'deepseek-v4.1-flash';
  const url = `${base}/chat/completions`;
  const started = Date.now();

  const result = {
    baseUrl: base,
    model,
    keyPresent: Boolean(key),
    keyLen: key.length,
    keyPrefix: key ? key.slice(0, 4) : null,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return only JSON: {"ok":true,"intent":"general_question"}' },
          { role: 'user', content: 'ping' },
        ],
      }),
    });
    const body = await response.text();
    result.ok = response.ok;
    result.status = response.status;
    result.ms = Date.now() - started;
    result.bodyPreview = redact(body, key);
  } catch (error) {
    result.ok = false;
    result.errorName = error.name;
    result.message = redact(error.message, key);
    result.ms = Date.now() - started;
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
