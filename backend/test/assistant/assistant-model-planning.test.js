const assert = require('node:assert/strict');
const test = require('node:test');

const {
  chatCompletions,
  classifyError,
  extractJson,
  getCircuitStatus,
  resetCircuit,
  _circuit,
  _tripCircuit,
} = require('../../src/services/assistant/assistantModelClient');
const { understandIntent } = require('../../src/services/assistant/assistantIntent');
const { validatePlanContract } = require('../../src/services/assistant/assistantValidation');
const { registerAllTools, resetToolRegistrationFlag } = require('../../src/services/assistant/tools');
const { clearRegistry, getTool } = require('../../src/services/assistant/assistantToolRegistry');
const { executeToolCall } = require('../../src/services/assistant/assistantToolExecutor');

function mockFetchSequence(responses) {
  const original = global.fetch;
  let index = 0;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (typeof next === 'function') return next(url, options);
    return next;
  };
  return {
    calls,
    restore() {
      global.fetch = original;
    },
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
    async json() {
      return typeof body === 'string' ? JSON.parse(body) : body;
    },
  };
}

test.beforeEach(() => {
  resetCircuit();
  process.env.OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || 'test-key-not-real';
  process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
  process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-v4.1-flash';
  clearRegistry();
  resetToolRegistrationFlag();
  registerAllTools({ force: true });
});

test('successful model response parses structured intent JSON', async () => {
  const mock = mockFetchSequence([
    jsonResponse(200, {
      choices: [{
        message: {
          content: JSON.stringify({
            intent: 'database_read',
            language: 'en',
            confidence: 0.95,
            tool: 'employee.count',
            arguments: { status: 'active' },
            requiresClarification: false,
            clarificationQuestion: null,
          }),
        },
      }],
    }),
  ]);

  try {
    const result = await chatCompletions({
      messages: [{ role: 'user', content: 'How many employees?' }],
      json: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.parsed.tool, 'employee.count');
    assert.equal(result.parsed.intent, 'database_read');
  } finally {
    mock.restore();
  }
});

test('invalid JSON model response is rejected safely', async () => {
  const mock = mockFetchSequence([
    jsonResponse(200, { choices: [{ message: { content: 'not-json-at-all' } }] }),
  ]);
  try {
    const result = await chatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      json: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.parsed, null);
  } finally {
    mock.restore();
  }
});

test('missing intent fails plan validation', () => {
  const validated = validatePlanContract({
    language: 'en',
    confidence: 0.9,
    tool: 'employee.count',
    arguments: {},
  });
  assert.equal(validated.ok, false);
  assert.match(validated.errors.join(' '), /Missing intent/i);
});

test('unknown intent fails plan validation', () => {
  const validated = validatePlanContract({
    intent: 'hack_the_db',
    language: 'en',
    confidence: 0.9,
  });
  assert.equal(validated.ok, false);
});

test('billing 402 is not retried and trips circuit', async () => {
  const mock = mockFetchSequence([
    jsonResponse(402, { error: { message: 'Add usage credits or subscribe: https://ollama.com/plans' } }),
    jsonResponse(200, { choices: [{ message: { content: '{"ok":true}' } }] }),
  ]);
  try {
    const first = await chatCompletions({
      messages: [{ role: 'user', content: 'ping' }],
      json: true,
    });
    assert.equal(first.ok, false);
    assert.equal(first.error.code, 'MODEL_BILLING');
    assert.equal(first.error.retryable, false);
    assert.equal(first.error.providerActionRequired, true);
    assert.equal(getCircuitStatus().open, true);
    assert.equal(getCircuitStatus().providerActionRequired, true);

    const second = await chatCompletions({
      messages: [{ role: 'user', content: 'ping again' }],
      json: true,
    });
    assert.equal(second.ok, false);
    assert.ok(['MODEL_BILLING', 'MODEL_CIRCUIT_OPEN'].includes(second.error.code));
    // Only one provider call — second blocked by circuit.
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test('transient 429 is retried then can succeed', async () => {
  const mock = mockFetchSequence([
    jsonResponse(429, { error: { message: 'rate limit' } }),
    jsonResponse(200, { choices: [{ message: { content: '{"ok":true}' } }] }),
  ]);
  try {
    resetCircuit();
    const result = await chatCompletions({
      messages: [{ role: 'user', content: 'retry me' }],
      json: true,
    });
    assert.equal(result.ok, true);
    assert.equal(mock.calls.length, 2);
  } finally {
    mock.restore();
  }
});

test('understandIntent maps allowlisted tools and rejects unknown tools', async () => {
  const mock = mockFetchSequence([
    jsonResponse(200, {
      choices: [{
        message: {
          content: JSON.stringify({
            intent: 'database_read',
            language: 'hi',
            confidence: 0.93,
            tool: 'employee.count',
            arguments: { status: 'active' },
            requiresClarification: false,
          }),
        },
      }],
    }),
  ]);
  try {
    resetCircuit();
    const okPlan = await understandIntent({ message: 'Kitne employees hain?', role: 'admin' });
    assert.equal(okPlan.ok, true);
    assert.equal(okPlan.plan.tool, 'employee.count');
  } finally {
    mock.restore();
  }

  const badMock = mockFetchSequence([
    jsonResponse(200, {
      choices: [{
        message: {
          content: JSON.stringify({
            intent: 'database_read',
            language: 'en',
            confidence: 0.99,
            tool: 'db.dropCollection',
            arguments: { collection: 'employees' },
            requiresClarification: false,
          }),
        },
      }],
    }),
  ]);
  try {
    resetCircuit();
    const badPlan = await understandIntent({ message: 'show employee collection', role: 'admin' });
    assert.equal(badPlan.ok, true);
    assert.equal(badPlan.plan.tool, null);
    assert.equal(badPlan.plan.requiresClarification, true);
  } finally {
    badMock.restore();
  }
});

test('unsafe generated query arguments are rejected by plan validation', () => {
  const validated = validatePlanContract({
    intent: 'database_read',
    language: 'en',
    confidence: 0.99,
    tool: 'employee.list',
    arguments: { query: 'db.employees.drop()' },
  });
  assert.equal(validated.ok, false);
  assert.match(validated.errors.join(' '), /Unsafe argument/i);
});

test('executeToolCall rejects arbitrary unknown tools', async () => {
  await assert.rejects(
    () => executeToolCall({
      user: { id: '507f1f77bcf86cd799439011', role: 'admin' },
      session: { _id: '507f1f77bcf86cd799439012' },
      toolName: 'shell.exec',
      rawArgs: { command: 'rm -rf /' },
      lang: 'en',
    }),
    (error) => error.statusCode === 400,
  );
  assert.equal(getTool('shell.exec'), null);
});

test('classifyError treats usage-credit bodies as billing even without 402', () => {
  const classified = classifyError(400, 'this model uses extra usage only and your extra usage balance is empty');
  assert.equal(classified.code, 'MODEL_BILLING');
  assert.equal(classified.retryable, false);
});

test('extractJson handles fenced and noisy payloads', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(extractJson(''), null);
});

test('circuit recovery window eventually allows requests again', () => {
  _tripCircuit('MODEL_BILLING', 10, 'credits');
  assert.equal(getCircuitStatus().open, true);
  _circuit.openUntil = Date.now() - 1;
  assert.equal(getCircuitStatus().open, false);
});
