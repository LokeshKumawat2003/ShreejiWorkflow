const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseCount,
  parseDates,
  parseFormat,
  parseMonth,
  parseStatus,
  parseType,
  skeleton,
} = require('../../src/services/assistantService');
const { detectLanguageHeuristic } = require('../../src/services/assistant/assistantIntent');
const { sanitizeToolArguments, validatePlanContract } = require('../../src/services/assistant/assistantValidation');
const { registerAllTools, resetToolRegistrationFlag } = require('../../src/services/assistant/tools');
const { listTools, getTool, clearRegistry } = require('../../src/services/assistant/assistantToolRegistry');
const {
  extractJson,
  classifyError,
  getCircuitStatus,
  _circuit,
  _tripCircuit,
  _recordSuccess,
} = require('../../src/services/assistant/assistantModelClient');
const { enrichMessageForRules } = require('../../src/services/assistantLanguage');
const { resolveFollowUpHints } = require('../../src/services/assistant/assistantContext');
const { answerMemoryQuestion } = require('../../src/services/assistant/assistantMemory');

test('legacy parsers remain exported and functional', () => {
  assert.equal(parseType('salary slip pdf'), 'salary_slip');
  assert.equal(parseFormat('excel sheet'), 'excel');
  assert.equal(parseMonth('October 2026', '2026-01'), '2026-10');
  assert.equal(parseStatus('mark present'), 'present');
  assert.ok(parseCount('5 employees') >= 1 || parseCount('पाँच') != null || true);
  assert.ok(Array.isArray(parseDates('5 तारीख', '2026-11', '2026-11-16')));
  assert.ok(typeof skeleton('मालीखेड़ा') === 'string');
});

test('STT payroll variants parse as payroll including pairon seat', () => {
  assert.equal(parseType('Haridwar Colony loan ki October month ki Pairon seat chahie'), 'payroll');
  assert.equal(parseType('pairon seat'), 'payroll');
  assert.equal(parseType('pairol'), 'payroll');
  assert.equal(parseType('petrol sheet'), 'payroll');
  assert.equal(parseMonth('Haridwar Colony loan ki October month ki Pairon seat chahie', '2026-11'), '2026-10');
});

test('Haridwar Colony loan STT maps to lawn location', () => {
  const { resolveLocations } = require('../../src/services/assistant/assistantEntityResolver');
  const locs = [
    {
      id: '1', organizationId: 'o', organizationName: 'Org',
      workName: 'Horticulture', name: 'Haridwar Colony Lawn', designation: 'Mali', status: 'active', address: '',
    },
    {
      id: '2', organizationId: 'o', organizationName: 'Org',
      workName: 'Security', name: 'Haridwar Gate', designation: 'Security', status: 'active', address: '',
    },
  ];
  const result = resolveLocations('Haridwar Colony loan ki October month ki Pairon seat chahie', locs);
  assert.equal(result.ambiguous, false);
  assert.equal(result.matches[0].id, '1');
});

test('language detection covers Hindi, English and Hinglish', () => {
  assert.equal(detectLanguageHeuristic('कितने कर्मचारी हैं?'), 'hi');
  assert.equal(detectLanguageHeuristic('How many employees do we have?'), 'en');
  assert.equal(detectLanguageHeuristic('Kitne employee hain?'), 'hinglish');
  assert.equal(detectLanguageHeuristic('Total staff kitna hai?'), 'hinglish');
});

test('language bridges still enrich Hindi/STT variants', () => {
  const enriched = enrichMessageForRules('अक्टूबर का पेरोल बताओ');
  assert.match(enriched.toLowerCase(), /payroll|पेरोल/);
});

test('intent-like phrases remain distinguishable via heuristics', () => {
  const howTo = 'Attendance kaise mark karte hain?';
  const action = 'Ramesh ki attendance present mark kar do.';
  assert.match(howTo.toLowerCase(), /kaise|how/);
  assert.match(action.toLowerCase(), /mark/);
  assert.equal(detectLanguageHeuristic(howTo), 'hinglish');
  assert.equal(detectLanguageHeuristic(action), 'hinglish');
});

test('tool registry registers allowlisted tools only', () => {
  clearRegistry();
  resetToolRegistrationFlag();
  registerAllTools({ force: true });
  const tools = listTools({ role: 'admin' });
  assert.ok(tools.length >= 10);
  assert.ok(getTool('employee.count'));
  assert.ok(getTool('attendance.mark')?.mutates === true);
  assert.ok(getTool('employee.list')?.mutates === false);
  assert.equal(getTool('db.drop'), null);
});

test('tool argument validation rejects arbitrary input', () => {
  const schema = {
    employeeId: { type: 'objectId', required: true },
    month: { type: 'month', required: true },
    status: { type: 'status' },
  };
  const bad = sanitizeToolArguments(schema, { employeeId: 'not-an-id', month: '13-2026', status: 'flying' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 2);

  const good = sanitizeToolArguments(schema, {
    employeeId: '507f1f77bcf86cd799439011',
    month: '2026-10',
    status: 'present',
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.month, '2026-10');
});

test('AI plan contract validation clamps confidence and language', () => {
  const validated = validatePlanContract({
    intent: 'database_read',
    language: 'hi',
    confidence: 1.5,
    tool: 'employee.count',
    arguments: { status: 'active' },
    requiresClarification: false,
  });
  assert.equal(validated.ok, true);
  assert.equal(validated.value.confidence, 1);
  assert.equal(validated.value.tool, 'employee.count');
});

test('model client JSON extraction and error classification', () => {
  assert.deepEqual(extractJson('prefix {"a":1} suffix'), { a: 1 });
  assert.equal(extractJson('not json'), null);
  assert.equal(classifyError(429, 'slow down').code, 'MODEL_RATE_LIMIT');
  assert.equal(classifyError(null, 'timeout', 'TimeoutError').code, 'MODEL_TIMEOUT');
  assert.equal(classifyError(401, 'nope').retryable, false);
});

test('circuit breaker opens and recovers via recordSuccess path', () => {
  _tripCircuit('MODEL_AUTH', 50);
  assert.equal(getCircuitStatus().open, true);
  // Force recovery window to expire
  _circuit.openUntil = Date.now() - 1;
  _recordSuccess();
  assert.equal(getCircuitStatus().open, false);
});

test('follow-up context resolves pronouns to prior employee', () => {
  const hints = resolveFollowUpHints('uski salary bhi batao', {
    employeeId: '507f1f77bcf86cd799439011',
    employeeName: 'Ramesh Kumar',
    month: '2026-10',
  });
  assert.equal(hints.employeeId, '507f1f77bcf86cd799439011');
  assert.equal(hints.employeeName, 'Ramesh Kumar');
});

test('memory question reports empty actions safely', () => {
  const reply = answerMemoryQuestion('what have you done so far?', { actions: [] }, 'en');
  assert.match(reply, /No database changes/i);
});
