/**
 * Natural-language variation coverage for deterministic assistant NLU.
 * No LLM — asserts equivalent phrasings map to the same canonical intent/handler.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeAssistantText,
  expandWithSynonyms,
  prepareMessageForIntent,
  classifyIntent,
  hasConcept,
} = require('../../src/services/assistant/assistantNlu');
const {
  INTENTS,
  classifyDirectoryIntent,
  answerDirectoryQuery,
} = require('../../src/services/assistant/assistantDirectoryQuery');

const ORGS = [
  { id: '507f1f77bcf86cd799439011', name: 'Powergrid Khetri', status: 'active' },
  { id: '507f1f77bcf86cd799439012', name: 'NTPC Rihand', status: 'active' },
  { id: '507f1f77bcf86cd799439013', name: 'Powergrid Bhiwani', status: 'active' },
  { id: '507f1f77bcf86cd799439014', name: 'Old Client', status: 'disabled' },
];

const LOCS = [
  {
    id: '507f1f77bcf86cd799439021',
    organizationId: '507f1f77bcf86cd799439011',
    organizationName: 'Powergrid Khetri',
    workName: 'Housekeeping Block A',
    name: 'Khetri Site',
    designation: 'Housekeeping',
    status: 'active',
  },
];

const directory = { organizations: ORGS, locations: LOCS };
const admin = { id: 'admin1', role: 'admin' };

function assertAllMapTo(intent, variants, options = {}) {
  for (const message of variants) {
    assert.equal(
      classifyDirectoryIntent(message, options),
      intent,
      `Expected ${intent} for: ${message}`,
    );
  }
}

test('normalizeAssistantText strips fillers punctuation and repeats', () => {
  const normalized = normalizeAssistantText('  Kitni   kitni   active,,, organizations??? bhai please  ');
  assert.match(normalized, /^kitni active organizations$/i);
  assert.match(normalizeAssistantText('firms chal rahi hain'), /active/i);
  assert.match(normalizeAssistantText('organiisation'), /organiz/i);
});

test('synonym expansion maps firm/client/running to canonical tokens', () => {
  const expanded = expandWithSynonyms('Abhi kitni firms chal rahi hain?');
  assert.ok(hasConcept(expanded, 'organization'));
  assert.ok(hasConcept(expanded, 'count'));
  assert.ok(hasConcept(expanded, 'active'));
  assert.match(expandWithSynonyms(expanded), /organization/i);
});

test('active organization count — 40+ Hindi/English/Hinglish/STT variants', () => {
  const variants = [
    'Kitni active organizations hain?',
    'Kitni active organisation hai?',
    'Kitni active companies hain?',
    'Abhi kitni firms chal rahi hain?',
    'Total running organizations batao.',
    'How many organizations are active?',
    'Active clients kitne hain?',
    'Active companies kitne hain?',
    'How many active companies?',
    'How many active orgs?',
    'How many active organisations are there?',
    'Number of active organizations',
    'Count of active companies',
    'Total active organizations',
    'Total active firms',
    'kitne active org hain',
    'kitni active company hain',
    'kitni active client hain',
    'kitne active clients hain',
    'active organization kitne hain',
    'active organisations kitni hain',
    'running organizations kitne',
    'chal rahi organizations kitni',
    'chalu companies kitni hain',
    'operational organizations count',
    'working firms kitne hain',
    'enabled organizations how many',
    'सक्रिय संगठन कितने हैं',
    'चालू कंपनियां कितनी हैं',
    'एक्टिव ऑर्गेनाइजेशन कितनी',
    'कंपनी कितनी एक्टिव हैं',
    'kitni active organiisation hai',
    'kitni activ organisations hain',
    'how many active organzations',
    'active bussiness kitne',
    'businesses kitne active hain',
    'abhi kitni companies chal rahi hain',
    'abhi kitne firms chalu hain',
    'please kitni active organizations hain bhai',
    'kitni kitni active organizations hain???',
    'Active orgs total?',
    'Org count active',
    'how many clients are active',
    'how many firms are running',
    'total running orgs batao',
    'active firm kitni hain',
    'kitne active businesses',
    // Roman Hindi plurals / STT (companiyan, chalu) — must not fall through to document ask.
    'abhi Kitni companiyan chalu hai',
    'kitni companiyan chalu hain',
    'abhi kitni company active hai',
    'kitne business chal rahe hain',
    'sari active company kitni hain',
    'kitni kampaniyan chalu hain',
    'abhi kitni companyan active hain',
  ];
  assert.ok(variants.length >= 40, `need 40+ variants, got ${variants.length}`);
  assertAllMapTo(INTENTS.ACTIVE_ORGANIZATION_COUNT, variants);
});

test('Roman Hindi organization count answers with active org total', async () => {
  const result = await answerDirectoryQuery({
    user: admin,
    message: 'abhi Kitni companiyan chalu hai',
    directory,
    lang: 'hi',
    context: null,
  });
  assert.ok(result);
  assert.equal(result.intent || result.data?.intent, INTENTS.ACTIVE_ORGANIZATION_COUNT);
  assert.match(result.reply, /3/);
  assert.doesNotMatch(result.reply, /Which document|didn't catch|document/i);
});

test('organization list — name variants', () => {
  const variants = [
    'Organisations ke naam batao.',
    'Sari organisation ke naam batao',
    'sabhi organizations ki list do',
    'show all organization names',
    'list all organizations',
    'mujhe sari organization dikhao',
    'Saari organisation ki details do.',
    'सभी ऑर्गेनाइजेशन के नाम बताओ',
    'all companies ke naam',
    'firms ke naam batao',
    'clients ke naam dikhao',
    'organization names list',
    'orgs ke naam',
    'companies list',
    'saare organizations ke naam',
    'sabhi companies dikhao',
    'list organizations',
    'show organizations',
    'tell me organization names',
    'organization naam batao',
    'सभी कंपनी के नाम',
    'संगठन के नाम बताओ',
    'all org names',
    'all client names',
    'business names list',
    'saari firms ke naam',
    'please list all organizations',
    'organizations ke naam please',
    'naam batao sabhi organizations',
    'dikhao organizations',
  ];
  assert.ok(variants.length >= 30);
  assertAllMapTo(INTENTS.ORGANIZATION_LIST, variants);
});

test('active employee count variants', () => {
  const variants = [
    'Mere mein active employee kitna hai?',
    'kitne active employees hain',
    'how many employees',
    'how many active employees',
    'total employees kitne',
    'staff kitne hain',
    'active staff count',
    'कितने कर्मचारी हैं',
    'एक्टिव एम्पलाई कितने',
    'employees kitne hain',
    'kitna employee hai',
    'number of employees',
    'count employees',
    'total active staff',
    'kitne workers hain',
    'active workers kitne',
    'how many staff members',
    'employee count',
    'kitne emp hain',
    'active emp kitne',
    'personnel kitne hain',
    'कर्मचारी संख्या',
    'स्टाफ कितने हैं',
    'please kitne employees hain',
    'kitne kitne employees',
    'total employee count batao',
    'active employees total',
    'how many workers are active',
    'employees total kitna',
    'staff count batao',
  ];
  assert.ok(variants.length >= 30);
  assertAllMapTo(INTENTS.ACTIVE_EMPLOYEE_COUNT, variants);
});

test('named organization employee count variants', () => {
  const variants = [
    'Powergrid Khetri mein kitne employees hain?',
    'Powergrid Khetri me kitne employee',
    'Powergrid Khetri employees kitne',
    'how many employees in Powergrid Khetri',
    'Powergrid Khetri staff count',
    'Powergrid Khetri mein kitne staff',
    'Powergrid Khetri ke employees kitne hain',
    // Previously failed: active + employees without explicit kitne/how-many.
    'Powergrid Khetri active employees',
    'Powergrid Khetri ke active employees',
    'Powergrid Khetri active employees kitne',
    'Powergrid Khetri ke active employees kitne hain',
    'Powergrid Khetri mein kitne log kaam karte hain?',
    'Powergrid Khetri mein kitne log kaam karte hain',
    'NTPC Rihand mein kitne employees',
    'NTPC Rihand employee count',
  ];
  for (const message of variants) {
    assert.equal(
      classifyDirectoryIntent(message, { hasOrgMention: true }),
      INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
      message,
    );
  }
});

test('named organization employee list vs details intents', () => {
  assert.equal(
    classifyDirectoryIntent('Powergrid Khetri employees', { hasOrgMention: true }),
    INTENTS.ORGANIZATION_EMPLOYEE_LIST,
  );
  assert.equal(
    classifyDirectoryIntent('Powergrid Khetri employee details', { hasOrgMention: true }),
    INTENTS.ORGANIZATION_EMPLOYEE_LIST,
  );
  assert.equal(
    classifyDirectoryIntent('Powergrid Khetri active employees', { hasOrgMention: true }),
    INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
  );
  assert.notEqual(
    classifyDirectoryIntent('Powergrid Khetri employees', { hasOrgMention: true }),
    INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
  );
});

test('negative cases — unrelated or different intents must not collide', () => {
  assert.notEqual(
    classifyDirectoryIntent('Kitni active organisations hai?'),
    INTENTS.DOCUMENT_GENERATION,
  );
  assert.notEqual(
    classifyDirectoryIntent('Mark attendance present'),
    INTENTS.ACTIVE_ORGANIZATION_COUNT,
  );
  assert.notEqual(
    classifyDirectoryIntent('Generate payroll PDF'),
    INTENTS.ACTIVE_EMPLOYEE_COUNT,
  );
  assert.notEqual(
    classifyDirectoryIntent('Create salary slip'),
    INTENTS.ORGANIZATION_LIST,
  );
  assert.equal(
    classifyDirectoryIntent('Powergrid Khetri ki details do.', { hasOrgMention: true }),
    INTENTS.ORGANIZATION_DETAILS,
  );
  assert.notEqual(
    classifyDirectoryIntent('Powergrid Khetri ki details do.', { hasOrgMention: true }),
    INTENTS.ACTIVE_ORGANIZATION_COUNT,
  );
  // Write-like language alone without clear target should stay uncertain in NLU.
  const write = classifyIntent('please delete everything now');
  assert.ok(write.confidence < 0.85 || write.intent !== 'delete_action' || write.needsClarification);
});

test('follow-up: inke naam after active org count returns same org names', async () => {
  const count = await answerDirectoryQuery({
    user: admin,
    message: 'Kitni active organizations hain?',
    directory,
    lang: 'en',
  });
  assert.equal(count.intent, INTENTS.ACTIVE_ORGANIZATION_COUNT);
  assert.ok(count.context.items?.length >= 3);
  assert.equal(count.context.statusFilter, 'active');

  const names = await answerDirectoryQuery({
    user: admin,
    message: 'Inke naam batao.',
    directory,
    context: count.context,
    lang: 'hi',
  });
  assert.equal(names.intent, INTENTS.ORGANIZATION_LIST);
  assert.deepEqual(names.data.names, count.context.items);
});

test('follow-up: inmein employees kitne after org scope', async () => {
  const { mergeContext } = require('../../src/services/assistant/assistantContext');
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  const seenFilters = [];
  Employee.countDocuments = async (filter = {}) => {
    seenFilters.push(filter);
    return 12;
  };
  try {
    const count = await answerDirectoryQuery({
      user: admin,
      message: 'How many organizations are active?',
      directory,
      lang: 'en',
    });
    assert.equal(count.intent, INTENTS.ACTIVE_ORGANIZATION_COUNT);
    assert.equal(count.context.statusFilter, 'active');
    assert.ok(Array.isArray(count.context.organizationIds));
    assert.equal(count.context.organizationIds.length, 3);
    assert.deepEqual(
      count.context.organizationIds.sort(),
      ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'].sort(),
    );
    assert.ok(!count.context.organizationIds.includes('507f1f77bcf86cd799439014'));

    // Simulate orchestrator sticky merge before the follow-up turn.
    const sticky = mergeContext(null, count.context);
    assert.equal(sticky.statusFilter, 'active');
    assert.deepEqual(sticky.organizationIds.sort(), count.context.organizationIds.sort());

    const follow = await answerDirectoryQuery({
      user: admin,
      message: 'Inmein employees kitne?',
      directory,
      context: sticky,
      lang: 'hi',
    });
    assert.ok(follow);
    assert.equal(follow.intent, INTENTS.ORGANIZATION_EMPLOYEE_COUNT);
    assert.ok(Array.isArray(follow.data.organizationIds));
    assert.deepEqual(follow.data.organizationIds.sort(), sticky.organizationIds.sort());
    assert.equal(follow.context.statusFilter, 'active');
    assert.equal(follow.data.active, 12);
    assert.ok(
      seenFilters.some((filter) => filter?.organizationId?.$in?.length === 3
        && filter.status?.$ne === 'disabled'),
      'employee count must query the same active organizationIds scope',
    );
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('classifyIntent confidence prefers org-count over document for firm/running phrases', () => {
  const samples = [
    'Abhi kitni firms chal rahi hain?',
    'Total running organizations batao.',
    'Active clients kitne hain?',
  ];
  for (const message of samples) {
    const result = classifyIntent(message);
    assert.equal(result.topIntent || result.intent, 'active_organization_count', message);
    assert.ok(result.confidence >= 0.6, `${message} confidence ${result.confidence}`);
  }
});

test('prepareMessageForIntent is stable and idempotent enough', () => {
  const once = prepareMessageForIntent('kitni active firms chal rahi hain bhai!!!');
  const twice = prepareMessageForIntent(once.expanded);
  assert.ok(hasConcept(once.expanded, 'organization'));
  assert.ok(hasConcept(twice.expanded, 'organization'));
  assert.ok(hasConcept(once.expanded, 'count'));
  assert.ok(hasConcept(once.expanded, 'active'));
});

test('employee list details count and sticky org follow-ups', async () => {
  const { mergeContext } = require('../../src/services/assistant/assistantContext');
  const Employee = require('../../src/models/Employee');
  const originalFind = Employee.find;
  const originalCount = Employee.countDocuments;
  const people = [
    { name: 'Asha', designation: 'Cleaner', status: 'active' },
    { name: 'Ravi', designation: 'Guard', status: 'active' },
  ];

  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => people,
  });
  Employee.countDocuments = async (filter = {}) => {
    if (filter.status === 'disabled') return 2;
    if (filter.status?.$ne === 'disabled') return 5;
    return 7;
  };

  try {
    const list = await answerDirectoryQuery({
      user: admin,
      message: 'Powergrid Khetri employees',
      directory,
      lang: 'en',
    });
    assert.equal(list.intent, INTENTS.ORGANIZATION_EMPLOYEE_LIST);
    assert.deepEqual(list.data.names, ['Asha', 'Ravi']);
    assert.match(list.reply, /Asha/);
    assert.doesNotMatch(list.reply, /active employees\s*=/i);

    const details = await answerDirectoryQuery({
      user: admin,
      message: 'Powergrid Khetri employee details',
      directory,
      lang: 'en',
    });
    assert.equal(details.intent, INTENTS.ORGANIZATION_EMPLOYEE_LIST);
    assert.equal(details.data.withDetails, true);
    assert.match(details.reply, /Cleaner|Guard/);

    const activeCount = await answerDirectoryQuery({
      user: admin,
      message: 'Powergrid Khetri active employees',
      directory,
      lang: 'en',
    });
    assert.equal(activeCount.intent, INTENTS.ORGANIZATION_EMPLOYEE_COUNT);
    assert.equal(activeCount.data.active, 5);
    assert.equal(activeCount.context.organizationId, '507f1f77bcf86cd799439011');

    const logCount = await answerDirectoryQuery({
      user: admin,
      message: 'Powergrid Khetri mein kitne log kaam karte hain?',
      directory,
      lang: 'hi',
    });
    assert.equal(logCount.intent, INTENTS.ORGANIZATION_EMPLOYEE_COUNT);
    assert.equal(logCount.data.organizationId, '507f1f77bcf86cd799439011');

    const sticky = mergeContext(null, activeCount.context);
    const their = await answerDirectoryQuery({
      user: admin,
      message: 'Show their employees',
      directory,
      context: sticky,
      lang: 'en',
    });
    assert.equal(their.intent, INTENTS.ORGANIZATION_EMPLOYEE_LIST);
    assert.equal(their.data.organizationId, sticky.organizationId);
    assert.deepEqual(their.data.names, ['Asha', 'Ravi']);

    const switched = await answerDirectoryQuery({
      user: admin,
      message: 'Now show employees of another organization',
      directory,
      context: sticky,
      lang: 'en',
    });
    assert.equal(switched.intent, INTENTS.ORGANIZATION_EMPLOYEE_LIST);
    assert.equal(switched.data.needsOrganization, true);
    assert.equal(switched.data.switchedScope, true);
    assert.equal(switched.context.organizationId, null);

    const inactive = await answerDirectoryQuery({
      user: admin,
      message: 'Inmein inactive employees kitne hain?',
      directory,
      context: sticky,
      lang: 'hi',
    });
    assert.equal(inactive.intent, INTENTS.ORGANIZATION_EMPLOYEE_COUNT);
    assert.deepEqual(inactive.data.organizationIds, [sticky.organizationId]);
    assert.equal(inactive.data.employeeStatusFilter, 'disabled');
    assert.equal(inactive.data.inactive, 2);
    assert.equal(inactive.context.organizationId, sticky.organizationId);
  } finally {
    Employee.find = originalFind;
    Employee.countDocuments = originalCount;
  }
});
