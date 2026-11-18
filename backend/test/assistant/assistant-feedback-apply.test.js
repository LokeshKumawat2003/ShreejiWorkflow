const assert = require('node:assert/strict');
const test = require('node:test');

const {
  replyFromApprovedFeedback,
  scoreFeedbackMatch,
  normalizeFeedbackText,
  applyApprovedFeedback,
  clearApprovedFeedbackCache,
} = require('../../src/services/assistant/assistantFeedback');
const AssistantFeedback = require('../../src/models/AssistantFeedback');

test('normalizeFeedbackText strips punctuation', () => {
  assert.equal(normalizeFeedbackText('तुम लड़की हो?'), 'तुम लड़की हो');
  assert.equal(normalizeFeedbackText('  Are you a girl?! '), 'are you a girl');
});

test('scoreFeedbackMatch treats same question as strong match', () => {
  assert.ok(scoreFeedbackMatch('तुम लड़की हो?', 'तुम लड़की हो') >= 0.9);
  assert.ok(scoreFeedbackMatch('tum ladki ho', 'तुम लड़की हो?') < 0.8
    || scoreFeedbackMatch('kitne employees hain', 'तुम लड़की हो?') < 0.8);
  assert.ok(scoreFeedbackMatch('kitne employees hain Bhopal', 'kitne employees hain?') >= 0.8);
});

test('replyFromApprovedFeedback extracts quoted answer', () => {
  const reply = replyFromApprovedFeedback({
    expectedBehaviour: 'जब पूछें "तुम लड़की हो?" तो जवाब: "हाँ, मैं लड़की हूँ। मैं श्रीजी हूँ।"',
    correction: 'deny मत करो',
  });
  assert.match(reply, /हाँ, मैं लड़की हूँ/);
});

test('replyFromApprovedFeedback uses plain expected reply', () => {
  const reply = replyFromApprovedFeedback({
    expectedBehaviour: 'हाँ, मैं लड़की हूँ।',
    correction: '',
  });
  assert.equal(reply, 'हाँ, मैं लड़की हूँ।');
});

test('applyApprovedFeedback returns matching approved reply', async () => {
  clearApprovedFeedbackCache();
  const originalFind = AssistantFeedback.find;
  AssistantFeedback.find = () => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    lean: async () => ([
      {
        type: 'incorrect_answer',
        originalRequest: 'तुम लड़की हो?',
        expectedBehaviour: 'जवाब: "हाँ, मैं लड़की हूँ। मैं श्रीजी हूँ।"',
        correction: '',
      },
    ]),
  });
  try {
    const hit = await applyApprovedFeedback(
      { id: '507f1f77bcf86cd799439011', role: 'admin' },
      'तुम लड़की हो?',
    );
    assert.ok(hit);
    assert.equal(hit.source, 'feedback');
    assert.match(hit.reply, /हाँ, मैं लड़की हूँ/);

    const miss = await applyApprovedFeedback(
      { id: '507f1f77bcf86cd799439011', role: 'admin' },
      'kitne organizations hain?',
    );
    assert.equal(miss, null);
  } finally {
    AssistantFeedback.find = originalFind;
    clearApprovedFeedbackCache();
  }
});
