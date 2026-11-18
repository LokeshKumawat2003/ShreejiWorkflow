/**
 * Conversation Intelligence 2.0 — regression suite.
 * Critical: Green Valley Care org-scoped location resolution (no cross-org Park Care leak).
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const {
  INTENTS,
  answerDirectoryQuery,
  classifyDirectoryIntent,
} = require('../../src/services/assistant/assistantDirectoryQuery');
const {
  getActiveContext,
  mergeContext,
  isContextFresh,
  isCorrectionFollowUp,
  isShortSubjectFollowUp,
  validateAnswerAgainstContext,
  CONTEXT_TURNS,
} = require('../../src/services/assistant/assistantContext');
const { summarizeConversationContext, compactHistory } = require('../../src/services/assistant/assistantMemory');
const { resolveLocations } = require('../../src/services/assistant/assistantEntityResolver');
const { clearAssistantCaches } = require('../../src/services/assistantService');

test.beforeEach(() => {
  clearAssistantCaches();
});

const greenValleyId = '507f1f77bcf86cd799439101';
const otherOrgId = '507f1f77bcf86cd799439102';
const gardenWorkId = '507f1f77bcf86cd799439201';
const parkCareGreenId = '507f1f77bcf86cd799439202';
const campusCareId = '507f1f77bcf86cd799439203';
const parkCareOtherId = '507f1f77bcf86cd799439204';

const directory = {
  organizations: [
    { id: greenValleyId, name: 'Green Valley Care', status: 'active', phone: '999', email: 'g@test.com' },
    { id: otherOrgId, name: 'Blue Hills Care', status: 'active', phone: '888', email: 'b@test.com' },
  ],
  locations: [
    {
      id: gardenWorkId,
      organizationId: greenValleyId,
      organizationName: 'Green Valley Care',
      workName: 'Garden Work',
      name: 'Garden Work Site',
      designation: 'Mali',
      status: 'active',
      address: 'Garden Road',
    },
    {
      id: parkCareGreenId,
      organizationId: greenValleyId,
      organizationName: 'Green Valley Care',
      workName: 'Park Care',
      name: 'Park Care Green',
      designation: 'Supervisor',
      status: 'active',
      address: 'Park Lane',
    },
    {
      id: campusCareId,
      organizationId: greenValleyId,
      organizationName: 'Green Valley Care',
      workName: 'Campus Care',
      name: 'Campus Care Site',
      designation: 'Cleaner',
      status: 'active',
      address: 'Campus Gate',
    },
    {
      id: parkCareOtherId,
      organizationId: otherOrgId,
      organizationName: 'Blue Hills Care',
      workName: 'Park Care',
      name: 'Park Care Blue',
      designation: 'Guard',
      status: 'active',
      address: 'Blue Park',
    },
  ],
};

function stubEmployees() {
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  Employee.countDocuments = async () => 2;
  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [],
  });
  return () => {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
  };
}

test('context stays fresh for session life, not a short turn window', () => {
  assert.ok(CONTEXT_TURNS >= 40);
  const session = {
    context: { organizationId: greenValleyId, turn: 0 },
    expiresAt: new Date(Date.now() + 60_000),
  };
  assert.equal(isContextFresh(session), true);
  assert.equal(getActiveContext({ ...session, messages: Array(100).fill({ role: 'assistant' }) })?.organizationId, greenValleyId);

  const expired = {
    context: { organizationId: greenValleyId },
    expiresAt: new Date(Date.now() - 1000),
  };
  assert.equal(isContextFresh(expired), false);
});

test('mergeContext keeps parent org when location updates', () => {
  const previous = {
    organizationId: greenValleyId,
    organizationName: 'Green Valley Care',
    locationId: gardenWorkId,
    locationName: 'Garden Work',
  };
  const next = {
    lastIntent: INTENTS.LOCATION_DETAILS,
    locationId: parkCareGreenId,
    locationName: 'Park Care',
    organizationId: greenValleyId,
    organizationName: 'Green Valley Care',
  };
  const merged = mergeContext(previous, next);
  assert.equal(merged.organizationId, greenValleyId);
  assert.equal(merged.locationId, parkCareGreenId);
  assert.equal(merged.employeeId, null);
});

test('corrections and short follow-ups are detected', () => {
  assert.equal(isCorrectionFollowUp('Nahi, mera matlab Park Care tha'), true);
  assert.equal(isCorrectionFollowUp('Wrong organization'), true);
  assert.equal(isCorrectionFollowUp('Park Care ki details do'), false);
  assert.equal(isShortSubjectFollowUp('uski details do'), true);
  assert.equal(isShortSubjectFollowUp('Ab iska address batao'), true);
});

test('resolveLocations with organizationId never returns another org site', () => {
  const result = resolveLocations('Park Care ki details', directory.locations, {
    organizationId: greenValleyId,
  });
  assert.equal(result.ambiguous, false);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].id, parkCareGreenId);
  assert.equal(result.matches[0].organizationId, greenValleyId);
});

test('A: Green Valley → Garden Work → Park Care → Campus Care stay in-org', async () => {
  const restore = stubEmployees();
  try {
    const org = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Green Valley Care ki details do',
      directory,
      lang: 'hi',
    });
    assert.equal(org.intent, INTENTS.ORGANIZATION_DETAILS);
    assert.equal(org.data.organizationId, greenValleyId);
    assert.ok(Array.isArray(org.context.locationIds));
    assert.ok(org.context.locationIds.includes(gardenWorkId));
    assert.ok(org.context.locationIds.includes(parkCareGreenId));
    assert.ok(org.context.locationIds.includes(campusCareId));
    assert.ok(!org.context.locationIds.includes(parkCareOtherId));

    const garden = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Garden Work ki details do',
      directory,
      context: org.context,
      lang: 'hi',
    });
    assert.equal(garden.intent, INTENTS.LOCATION_DETAILS);
    assert.equal(garden.data.locationId, gardenWorkId);
    assert.equal(garden.data.organizationId, greenValleyId);

    const park = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Park Care ki bhi details do',
      directory,
      context: mergeContext(org.context, garden.context),
      lang: 'hi',
    });
    assert.equal(park.intent, INTENTS.LOCATION_DETAILS);
    assert.equal(park.data.locationId, parkCareGreenId);
    assert.equal(park.data.organizationId, greenValleyId);
    assert.notEqual(park.data.locationId, parkCareOtherId);

    const campus = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Campus Care ki details do',
      directory,
      context: mergeContext(mergeContext(org.context, garden.context), park.context),
      lang: 'hi',
    });
    assert.equal(campus.intent, INTENTS.LOCATION_DETAILS);
    assert.equal(campus.data.locationId, campusCareId);
    assert.equal(campus.data.organizationId, greenValleyId);

    const validation = validateAnswerAgainstContext(campus, org.context);
    assert.equal(validation.ok, true);
  } finally {
    restore();
  }
});

test('B: identical location names across orgs do not cross-pick under sticky org', async () => {
  const restore = stubEmployees();
  try {
    const park = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Park Care ki details do',
      directory,
      context: {
        organizationId: greenValleyId,
        organizationName: 'Green Valley Care',
        locationIds: [gardenWorkId, parkCareGreenId, campusCareId],
        lastIntent: INTENTS.ORGANIZATION_DETAILS,
        topic: 'organization',
      },
      lang: 'hi',
    });
    assert.equal(park.data.locationId, parkCareGreenId);
    assert.equal(park.data.organizationId, greenValleyId);
  } finally {
    restore();
  }
});

test('B2: scoped miss asks clarification instead of other org Park Care', async () => {
  const restore = stubEmployees();
  try {
    const lonelyOrgId = '507f1f77bcf86cd799439199';
    const lonelyDir = {
      organizations: [
        ...directory.organizations,
        { id: lonelyOrgId, name: 'Lonely Orchard', status: 'active' },
      ],
      locations: [
        ...directory.locations,
        {
          id: '507f1f77bcf86cd799439299',
          organizationId: lonelyOrgId,
          organizationName: 'Lonely Orchard',
          workName: 'Orchard Gate',
          name: 'Orchard Gate',
          status: 'active',
        },
      ],
    };
    const miss = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Park Care ki details do',
      directory: lonelyDir,
      context: {
        organizationId: lonelyOrgId,
        organizationName: 'Lonely Orchard',
        lastIntent: INTENTS.ORGANIZATION_DETAILS,
        topic: 'organization',
      },
      lang: 'hi',
    });
    assert.notEqual(miss?.data?.locationId, parkCareOtherId);
    assert.notEqual(miss?.data?.locationId, parkCareGreenId);
    assert.ok(miss.data.needsLocation || miss.data.scopedMiss || miss.data.ambiguous);
    assert.equal(miss.context?.organizationId, lonelyOrgId);
  } finally {
    restore();
  }
});

test('C: pronoun follow-ups reuse sticky location', async () => {
  const restore = stubEmployees();
  try {
    const address = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Ab iska address batao',
      directory,
      context: {
        organizationId: greenValleyId,
        organizationName: 'Green Valley Care',
        locationId: campusCareId,
        locationName: 'Campus Care',
        lastIntent: INTENTS.LOCATION_DETAILS,
        topic: 'location',
      },
      lang: 'hi',
    });
    assert.equal(address.intent, INTENTS.LOCATION_DETAILS);
    assert.equal(address.data.locationId, campusCareId);
    assert.match(String(address.reply), /Campus|address|Address|पता|एड्रेस|Campus Gate/i);
  } finally {
    restore();
  }
});

test('D: Hindi / English / Hinglish org-count variants share intent', () => {
  const variants = [
    'Kitni companies chalu hain?',
    'Abhi kitne organization active hai?',
    'How many organizations are running?',
    'कितनी कंपनियां चालू हैं?',
  ];
  for (const message of variants) {
    const intent = classifyDirectoryIntent(message, {});
    assert.equal(
      intent,
      INTENTS.ACTIVE_ORGANIZATION_COUNT,
      `expected org count for: ${message} got ${intent}`,
    );
  }
});

test('E: spelling / STT variants still resolve Green Valley locations', async () => {
  const restore = stubEmployees();
  try {
    const campus = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Campas Care ki detials do',
      directory,
      context: {
        organizationId: greenValleyId,
        organizationName: 'Green Valley Care',
        lastIntent: INTENTS.ORGANIZATION_DETAILS,
      },
      lang: 'hi',
    });
    assert.equal(campus?.data?.locationId, campusCareId);
  } finally {
    restore();
  }
});

test('F: long conversation memory helpers retain entity IDs', () => {
  const messages = [];
  for (let i = 0; i < 120; i += 1) {
    messages.push({ role: 'user', content: `question ${i}` });
    messages.push({ role: 'assistant', content: `answer ${i}` });
  }
  const recent = compactHistory(messages, 8);
  assert.equal(recent.length, 8);
  const summary = summarizeConversationContext({
    organizationId: greenValleyId,
    organizationName: 'Green Valley Care',
    locationId: parkCareGreenId,
    locationName: 'Park Care',
    lastIntent: INTENTS.LOCATION_DETAILS,
  }, messages);
  assert.equal(summary.organizationId, greenValleyId);
  assert.equal(summary.locationId, parkCareGreenId);
  assert.ok(summary.recentTurns <= 8);
});

test('G/H: topic switch to another org clears wrong sticky scope', async () => {
  const restore = stubEmployees();
  try {
    const switched = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Blue Hills Care ki details do',
      directory,
      context: {
        organizationId: greenValleyId,
        organizationName: 'Green Valley Care',
        locationId: parkCareGreenId,
        lastIntent: INTENTS.LOCATION_DETAILS,
      },
      lang: 'hi',
    });
    assert.equal(switched.intent, INTENTS.ORGANIZATION_DETAILS);
    assert.equal(switched.data.organizationId, otherOrgId);

    const park = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Park Care ki details do',
      directory,
      context: switched.context,
      lang: 'hi',
    });
    assert.equal(park.data.locationId, parkCareOtherId);
    assert.equal(park.data.organizationId, otherOrgId);
  } finally {
    restore();
  }
});

test('I: user correction picks the intended location inside sticky org', async () => {
  const restore = stubEmployees();
  try {
    const corrected = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Nahi, mera matlab Campus Care tha',
      directory,
      context: {
        organizationId: greenValleyId,
        organizationName: 'Green Valley Care',
        locationId: parkCareGreenId,
        locationName: 'Park Care',
        lastIntent: INTENTS.LOCATION_DETAILS,
        topic: 'location',
      },
      lang: 'hi',
    });
    assert.equal(corrected?.data?.locationId, campusCareId);
    assert.equal(corrected?.data?.organizationId, greenValleyId);
  } finally {
    restore();
  }
});

test('M: validation rejects cross-org location answers', () => {
  const bad = {
    intent: INTENTS.LOCATION_DETAILS,
    data: { organizationId: otherOrgId, locationId: parkCareOtherId },
    context: { organizationId: otherOrgId },
  };
  const result = validateAnswerAgainstContext(bad, {
    organizationId: greenValleyId,
    organizationName: 'Green Valley Care',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cross_org_location');
});

test('L: non-admin directory is scoped to own organization only', async () => {
  const restore = stubEmployees();
  try {
    const result = await answerDirectoryQuery({
      user: { id: greenValleyId, role: 'organization' },
      message: 'Park Care ki details do',
      directory,
      lang: 'hi',
    });
    if (result?.data?.locationId) {
      assert.equal(result.data.organizationId, greenValleyId);
      assert.notEqual(result.data.locationId, parkCareOtherId);
    }
  } finally {
    restore();
  }
});
