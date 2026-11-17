const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveOrganizations,
  resolveLocations,
  findLocationsByKeyword,
  similarEnough,
} = require('../../src/services/assistant/assistantEntityResolver');
const {
  INTENTS,
  classifyDirectoryIntent,
  isAllOrganizationsListQuery,
  parseSelectionIndex,
  resolvePendingSelection,
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
    address: '',
  },
  {
    id: '507f1f77bcf86cd799439022',
    organizationId: '507f1f77bcf86cd799439011',
    organizationName: 'Powergrid Khetri',
    workName: 'Security Gate',
    name: 'Gate 1',
    designation: 'Security',
    status: 'active',
    address: '',
  },
  {
    id: '507f1f77bcf86cd799439023',
    organizationId: '507f1f77bcf86cd799439012',
    organizationName: 'NTPC Rihand',
    workName: 'Housekeeping Plant',
    name: 'Rihand',
    designation: 'Housekeeping',
    status: 'active',
    address: '',
  },
];

test('organization spelling variants resolve uniquely', () => {
  const a = resolveOrganizations('Power Grid Khatri mein kitne employee hain?', ORGS);
  assert.equal(a.ambiguous, false);
  assert.equal(a.matches[0].id, '507f1f77bcf86cd799439011');

  const b = resolveOrganizations('Powergrid Khetri ki details do', ORGS);
  assert.equal(b.matches[0].name, 'Powergrid Khetri');

  const c = resolveOrganizations('NTPC Rihand', ORGS);
  assert.equal(c.matches[0].id, '507f1f77bcf86cd799439012');
});

test('ambiguous powergrid names are not silently chosen', () => {
  const result = resolveOrganizations('Powergrid', ORGS, { minScore: 40 });
  assert.ok(result.matches.length >= 2 || result.ambiguous);
});

test('intent classification covers required examples', () => {
  assert.equal(
    classifyDirectoryIntent('Mere mein active employee kitna hai?'),
    INTENTS.ACTIVE_EMPLOYEE_COUNT,
  );
  assert.equal(
    classifyDirectoryIntent('Kitni active organisation hai?'),
    INTENTS.ACTIVE_ORGANIZATION_COUNT,
  );
  assert.equal(
    classifyDirectoryIntent('Organisations ke naam batao.'),
    INTENTS.ORGANIZATION_LIST,
  );
  assert.equal(
    classifyDirectoryIntent('Saari organisation ki details do.'),
    INTENTS.ORGANIZATION_LIST,
  );
  assert.equal(
    classifyDirectoryIntent('Powergrid Khetri mein kitne employees hain?', { hasOrgMention: true }),
    INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
  );
  assert.equal(
    classifyDirectoryIntent('Powergrid Khetri ki details do.', { hasOrgMention: true }),
    INTENTS.ORGANIZATION_DETAILS,
  );
  assert.equal(
    classifyDirectoryIntent('Housekeeping wali locations mein kitne employee hain?'),
    INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
  );
  assert.notEqual(
    classifyDirectoryIntent('Kitni active organisation hai?'),
    INTENTS.DOCUMENT_GENERATION,
  );
});

test('organization list intent covers Hindi English and Hinglish variants', () => {
  const variants = [
    'Sari organisation ke naam batao',
    'sari organisation ke naam batao',
    'sabhi organisations ki list do',
    'show all organization names',
    'list all organizations',
    'mujhe sari organization dikhao',
    'Saari organisation ki details do.',
    'Organisations ke naam batao.',
    'सभी ऑर्गेनाइजेशन के नाम बताओ',
  ];
  for (const message of variants) {
    assert.equal(
      classifyDirectoryIntent(message),
      INTENTS.ORGANIZATION_LIST,
      `Expected organization_list for: ${message}`,
    );
    assert.equal(isAllOrganizationsListQuery(message), true, `Expected all-org list for: ${message}`);
    // Even with a false hasOrgMention, list intent must win.
    assert.equal(
      classifyDirectoryIntent(message, { hasOrgMention: true }),
      INTENTS.ORGANIZATION_LIST,
      `Expected organization_list despite hasOrgMention for: ${message}`,
    );
  }
});

test('named org information is details not all-org list', () => {
  const named = [
    'Khatri admin block and Organisation ki information do',
    'Khatri organisation ki information do',
    'Powergrid Khetri ki details do',
    'Powergrid Khetri ki information do',
  ];
  for (const message of named) {
    assert.equal(
      isAllOrganizationsListQuery(message),
      false,
      `Must not treat as all-org list: ${message}`,
    );
    assert.equal(
      classifyDirectoryIntent(message, { hasOrgMention: true }),
      INTENTS.ORGANIZATION_DETAILS,
      `Expected organization_details for: ${message}`,
    );
    // When the phrase still contains "organisation", leftover name must beat the full-list fallback.
    if (/organis/i.test(message)) {
      assert.equal(
        classifyDirectoryIntent(message),
        INTENTS.ORGANIZATION_DETAILS,
        `Expected organization_details without hasOrgMention for: ${message}`,
      );
    }
  }
});

test('junk filler org name does not fuzzy-match naam queries', () => {
  const orgsWithJunk = [
    ...ORGS,
    { id: '507f1f77bcf86cd799439099', name: 'of organisation the name', status: 'active' },
  ];
  const resolved = resolveOrganizations('donon locations ke employee ke naam batao', orgsWithJunk);
  assert.equal(resolved.matches.length, 0, 'junk org must not match employee/naam follow-up');
  const byName = resolveOrganizations('Powergrid Khetri', orgsWithJunk);
  assert.equal(byName.matches[0]?.name, 'Powergrid Khetri');
});

test('person employee details query is not stolen by directory org count', async () => {
  const result = await answerDirectoryQuery({
    user: { id: '1', role: 'admin' },
    message: 'Amit Yadav father name Ram Sharma ki employee ki details do',
    directory: {
      organizations: [
        ...ORGS,
        { id: '507f1f77bcf86cd799439099', name: 'of organisation the name', status: 'active' },
      ],
      locations: LOCS,
    },
    context: {
      organizationId: '507f1f77bcf86cd799439099',
      organizationName: 'of organisation the name',
    },
    lang: 'en',
  });
  assert.equal(result, null);
});

test('org details context includes locationIds for both-locations follow-up', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async () => 4;
  try {
    const directory = {
      organizations: [
        ...ORGS,
        { id: '507f1f77bcf86cd799439031', name: 'HPCL Mumbai', status: 'active' },
      ],
      locations: [
        ...LOCS,
        {
          id: '507f1f77bcf86cd799439041',
          organizationId: '507f1f77bcf86cd799439031',
          organizationName: 'HPCL Mumbai',
          workName: 'Horticulture',
          name: 'Site A',
          designation: 'Horticulture',
          status: 'active',
          address: '',
        },
        {
          id: '507f1f77bcf86cd799439042',
          organizationId: '507f1f77bcf86cd799439031',
          organizationName: 'HPCL Mumbai',
          workName: 'Security',
          name: 'Site B',
          designation: 'Security',
          status: 'active',
          address: '',
        },
      ],
    };
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'HPCL Mumbai wali location ki details do',
      directory,
      lang: 'hi',
    });
    assert.ok(
      result.intent === INTENTS.ORGANIZATION_DETAILS
        || result.intent === INTENTS.ORGANIZATION_LOCATION_LIST,
    );
    assert.equal(result.context.organizationName, 'HPCL Mumbai');
    assert.ok(Array.isArray(result.context.locationIds));
    assert.deepEqual(result.context.locationIds.sort(), [
      '507f1f77bcf86cd799439041',
      '507f1f77bcf86cd799439042',
    ].sort());
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('khatri admin block org information returns that org details', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async () => 4;
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Khatri admin block and Organisation ki information do',
      directory: { organizations: ORGS, locations: LOCS },
      lang: 'hi',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.ORGANIZATION_DETAILS);
    assert.equal(result.data.organizationId, '507f1f77bcf86cd799439011');
    assert.equal(result.data.organizationName, 'Powergrid Khetri');
    assert.match(result.reply, /Powergrid Khetri/i);
    assert.doesNotMatch(result.reply, /All organizations/i);
    assert.doesNotMatch(result.reply, /NTPC Rihand/);
    assert.doesNotMatch(result.reply, /1\.\s*Powergrid Khetri[\s\S]*2\.\s*NTPC/i);
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('sari organisation ke naam returns numbered names not single-org details', async () => {
  const result = await answerDirectoryQuery({
    user: { id: '1', role: 'admin' },
    message: 'Sari organisation ke naam batao',
    directory: { organizations: ORGS, locations: LOCS },
    // Simulate prior single-org context — must not default to it.
    context: {
      organizationId: '507f1f77bcf86cd799439011',
      organizationName: 'Powergrid Khetri',
      lastIntent: INTENTS.ORGANIZATION_DETAILS,
    },
    lang: 'hi',
  });
  assert.ok(result);
  assert.equal(result.intent, INTENTS.ORGANIZATION_LIST);
  assert.equal(result.data.tool, 'organization.list');
  assert.equal(result.data.total, 3);
  assert.deepEqual(result.data.names.sort(), ['NTPC Rihand', 'Powergrid Bhiwani', 'Powergrid Khetri'].sort());
  assert.match(result.reply, /1\.\s*Powergrid Khetri|1\.\s*NTPC Rihand|1\.\s*Powergrid Bhiwani/);
  assert.doesNotMatch(result.reply, /Active employees/i);
  assert.doesNotMatch(result.reply, /Active locations/i);
});

test('number and ordinal selection parsing', () => {
  assert.equal(parseSelectionIndex('Ek number wali housekeeping'), 1);
  assert.equal(parseSelectionIndex('First one'), 1);
  assert.equal(parseSelectionIndex('Number 1'), 1);
  assert.equal(parseSelectionIndex('Pehli location'), 1);
  assert.equal(parseSelectionIndex('2'), 2);
  assert.equal(parseSelectionIndex('dusri'), 2);
});

test('pending selection resolves against previous options', () => {
  const context = {
    pendingSelectionType: 'location',
    pendingSelection: {
      type: 'location',
      options: [
        { index: 1, id: '507f1f77bcf86cd799439021', name: 'Housekeeping Block A', organizationId: '507f1f77bcf86cd799439011', locationId: '507f1f77bcf86cd799439021' },
        { index: 2, id: '507f1f77bcf86cd799439023', name: 'Housekeeping Plant', organizationId: '507f1f77bcf86cd799439012', locationId: '507f1f77bcf86cd799439023' },
      ],
    },
    lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
  };
  const selected = resolvePendingSelection('Ek number wali', context);
  assert.equal(selected.option.id, '507f1f77bcf86cd799439021');
  assert.equal(selected.type, 'location');
});

test('housekeeping locations are discovered by keyword', () => {
  const matched = findLocationsByKeyword('housekeeping', LOCS, {
    organizationId: '507f1f77bcf86cd799439011',
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, '507f1f77bcf86cd799439021');
});

test('khatri/khetri similarity holds', () => {
  assert.equal(similarEnough('khatri', 'khetri'), true);
  assert.equal(similarEnough('powergrid', 'power grid'), true);
});

test('answerDirectoryQuery returns structured org count without inventing data', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async (filter = {}) => {
    if (filter.status && filter.status.$ne === 'disabled') return 7;
    return 9;
  };

  try {
    const admin = { id: '507f1f77bcf86cd799439099', role: 'admin' };
    const directory = { organizations: ORGS, locations: LOCS };
    const result = await answerDirectoryQuery({
      user: admin,
      message: 'Power Grid Khatri mein kitne employee hain?',
      directory,
      lang: 'en',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.ORGANIZATION_EMPLOYEE_COUNT);
    assert.equal(result.data.organizationId, '507f1f77bcf86cd799439011');
    assert.equal(result.data.active, 7);
    assert.equal(result.data.total, 9);
    assert.match(result.reply, /Powergrid Khetri/i);
    assert.doesNotMatch(result.reply, /which employee/i);
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('active organization count ignores disabled orgs', async () => {
  const admin = { id: '507f1f77bcf86cd799439099', role: 'admin' };
  const result = await answerDirectoryQuery({
    user: admin,
    message: 'Kitni active organisation hai?',
    directory: { organizations: ORGS, locations: LOCS },
    lang: 'hi',
  });
  assert.equal(result.intent, INTENTS.ACTIVE_ORGANIZATION_COUNT);
  assert.equal(result.data.active, 3);
  assert.equal(result.data.total, 4);
});

test('organization list returns names', async () => {
  const result = await answerDirectoryQuery({
    user: { id: '1', role: 'admin' },
    message: 'Organisations ke naam batao.',
    directory: { organizations: ORGS, locations: LOCS },
    lang: 'hi',
  });
  assert.equal(result.intent, INTENTS.ORGANIZATION_LIST);
  assert.match(result.reply, /Powergrid Khetri/);
  assert.match(result.reply, /NTPC Rihand/);
  assert.ok(result.context?.pendingSelection?.options?.length >= 3);
});

test('follow-up ek number wali uses previous housekeeping list', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async () => 4;
  try {
    const context = {
      lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
      pendingSelectionType: 'location',
      pendingSelection: {
        type: 'location',
        options: [
          {
            index: 1,
            id: '507f1f77bcf86cd799439021',
            name: 'Housekeeping Block A',
            organizationId: '507f1f77bcf86cd799439011',
            locationId: '507f1f77bcf86cd799439021',
          },
        ],
      },
    };
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Ek number wali housekeeping.',
      directory: { organizations: ORGS, locations: LOCS },
      context,
      lang: 'hi',
    });
    assert.equal(result.intent, INTENTS.LOCATION_EMPLOYEE_COUNT);
    assert.equal(result.data.locationId, '507f1f77bcf86cd799439021');
    assert.equal(result.data.active, 4);
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('english hindi hinglish variants classify consistently', () => {
  assert.equal(classifyDirectoryIntent('How many active organizations are there?'), INTENTS.ACTIVE_ORGANIZATION_COUNT);
  assert.equal(classifyDirectoryIntent('कितनी एक्टिव ऑर्गेनाइजेशन हैं?'), INTENTS.ACTIVE_ORGANIZATION_COUNT);
  assert.equal(classifyDirectoryIntent('Active organisation kitni hai?'), INTENTS.ACTIVE_ORGANIZATION_COUNT);
});

test('security wali location details uses org context', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  Employee.countDocuments = async () => 2;
  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{ name: 'Meena Patel' }, { name: 'Rekha Bansal' }],
  });
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'security wali locations ki details do',
      directory: { organizations: ORGS, locations: LOCS },
      context: {
        organizationId: '507f1f77bcf86cd799439011',
        organizationName: 'Powergrid Khetri',
        locationIds: ['507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022'],
      },
      lang: 'hi',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.LOCATION_DETAILS);
    assert.match(result.reply, /Security/i);
    assert.doesNotMatch(result.reply, /Which document/i);
  } finally {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
  }
});

test('bare org name resolves to organization details', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async () => 4;
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Airtel store',
      directory: {
        organizations: [
          ...ORGS,
          { id: '507f1f77bcf86cd799439055', name: 'Airtel Store', status: 'active' },
        ],
        locations: LOCS,
      },
      lang: 'en',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.ORGANIZATION_DETAILS);
    assert.equal(result.data.organizationName, 'Airtel Store');
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('named canteen location details beat weak Bhopal org city match', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  Employee.countDocuments = async () => 3;
  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{ name: 'Ramesh Cleaner' }],
  });
  const orgId = '507f1f77bcf86cd799439080';
  const locationId = '507f1f77bcf86cd799439081';
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Bhopal staff canteen cleaner wali location ki details do',
      directory: {
        organizations: [
          { id: '507f1f77bcf86cd799439079', name: 'BHEL Bhopal', status: 'active' },
          { id: orgId, name: 'Staff Canteen Client', status: 'active' },
        ],
        locations: [
          {
            id: '507f1f77bcf86cd799439082',
            organizationId: '507f1f77bcf86cd799439079',
            organizationName: 'BHEL Bhopal',
            workName: 'Security',
            name: 'Plant Gate',
            designation: 'Security',
            status: 'active',
            address: '',
          },
          {
            id: '507f1f77bcf86cd799439083',
            organizationId: '507f1f77bcf86cd799439079',
            organizationName: 'BHEL Bhopal',
            workName: 'Housekeeping',
            name: 'Admin Block',
            designation: 'Housekeeping',
            status: 'active',
            address: '',
          },
          {
            id: locationId,
            organizationId: orgId,
            organizationName: 'Staff Canteen Client',
            workName: 'Housekeeping',
            name: 'Bhopal Staff Canteen',
            designation: 'Cleaner',
            status: 'active',
            address: 'Canteen Road',
          },
        ],
      },
      lang: 'en',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.LOCATION_DETAILS);
    assert.equal(result.data.locationId, locationId);
    assert.match(result.reply, /Bhopal Staff Canteen|Cleaner|Designation/i);
    assert.doesNotMatch(result.reply, /BHEL Bhopal has 2 locations/i);
  } finally {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
  }
});

test('Bhopal staff canteen beats other Staff Canteen / Cleaner sites', () => {
  const locs = [
    {
      id: '1', organizationId: 'a', organizationName: 'Powergrid Wardha',
      workName: 'Housekeeping', name: 'Wardha Staff Canteen', designation: 'Cleaner', status: 'active', address: '',
    },
    {
      id: '2', organizationId: 'b', organizationName: 'BHEL Bhopal',
      workName: 'Housekeeping', name: 'Admin Block', designation: 'Cleaner', status: 'active', address: '',
    },
    {
      id: '3', organizationId: 'b', organizationName: 'BHEL Bhopal',
      workName: 'Housekeeping', name: 'Bhopal Staff Canteen', designation: 'Cleaner', status: 'active', address: '',
    },
    {
      id: '4', organizationId: 'c', organizationName: 'NTPC Rihand',
      workName: 'Housekeeping', name: 'Rihand Staff Canteen', designation: 'Cleaner', status: 'active', address: '',
    },
  ];
  const result = resolveLocations('Bhopal staff canteen ki cleaner wali location ki details do', locs);
  assert.equal(result.ambiguous, false);
  assert.equal(result.matches[0].id, '3');
});

test('named canteen location details are unique not housekeeping list', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  Employee.countDocuments = async () => 2;
  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{ name: 'Ramesh' }],
  });
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Bhopal staff canteen ki cleaner wali location ki details do',
      directory: {
        organizations: [
          { id: '507f1f77bcf86cd799439079', name: 'BHEL Bhopal', status: 'active' },
          { id: '507f1f77bcf86cd799439070', name: 'Powergrid Wardha', status: 'active' },
        ],
        locations: [
          {
            id: '507f1f77bcf86cd799439090',
            organizationId: '507f1f77bcf86cd799439070',
            organizationName: 'Powergrid Wardha',
            workName: 'Housekeeping',
            name: 'Wardha Staff Canteen',
            designation: 'Cleaner',
            status: 'active',
            address: '',
          },
          {
            id: '507f1f77bcf86cd799439091',
            organizationId: '507f1f77bcf86cd799439079',
            organizationName: 'BHEL Bhopal',
            workName: 'Security',
            name: 'Plant Gate',
            designation: 'Security',
            status: 'active',
            address: '',
          },
          {
            id: '507f1f77bcf86cd799439092',
            organizationId: '507f1f77bcf86cd799439079',
            organizationName: 'BHEL Bhopal',
            workName: 'Housekeeping',
            name: 'Bhopal Staff Canteen',
            designation: 'Cleaner',
            status: 'active',
            address: 'Canteen Road',
          },
        ],
      },
      lang: 'en',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.LOCATION_DETAILS);
    assert.equal(result.data.locationId, '507f1f77bcf86cd799439092');
    assert.match(result.reply, /Bhopal Staff Canteen|Cleaner/i);
    assert.doesNotMatch(result.reply, /Which location|Wardha Staff Canteen/i);
  } finally {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
  }
});

test('canteen organisation details and kitni locations use that org', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async () => 5;
  try {
    const directory = {
      organizations: [
        { id: '507f1f77bcf86cd799439079', name: 'BHEL Bhopal', status: 'active' },
      ],
      locations: [
        {
          id: '507f1f77bcf86cd799439091',
          organizationId: '507f1f77bcf86cd799439079',
          organizationName: 'BHEL Bhopal',
          workName: 'Security',
          name: 'Plant Gate',
          designation: 'Security',
          status: 'active',
          address: '',
        },
        {
          id: '507f1f77bcf86cd799439092',
          organizationId: '507f1f77bcf86cd799439079',
          organizationName: 'BHEL Bhopal',
          workName: 'Housekeeping',
          name: 'Bhopal Staff Canteen',
          designation: 'Cleaner',
          status: 'active',
          address: '',
        },
      ],
    };
    const orgDetails = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Bhopal staff cleaner organisation ki details do',
      directory,
      lang: 'en',
    });
    assert.ok(orgDetails);
    assert.equal(orgDetails.intent, INTENTS.ORGANIZATION_DETAILS);
    assert.match(orgDetails.reply, /BHEL Bhopal/i);
    assert.doesNotMatch(orgDetails.reply, /Which document/i);

    const locCount = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Bhopal staff canteen mein kitni locations hai',
      directory,
      lang: 'hi',
    });
    assert.ok(locCount);
    assert.equal(locCount.intent, INTENTS.ORGANIZATION_LOCATION_LIST);
    assert.match(locCount.reply, /2|locations|Bhopal Staff Canteen/i);
    assert.doesNotMatch(locCount.reply, /active employees/i);

    const names = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'locations ke naam batao',
      directory,
      context: locCount.context,
      lang: 'hi',
    });
    assert.ok(names);
    assert.match(names.reply, /Security|Bhopal Staff Canteen|Plant Gate/i);
    assert.doesNotMatch(names.reply, /100 active locations|Wardha|dashboard/i);
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('sare employees and Ambala do not reuse sticky location names', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async () => 200;
  const orgId = '507f1f77bcf86cd7994390b1';
  const locationId = '507f1f77bcf86cd7994390b2';
  const directory = {
    organizations: [{ id: orgId, name: 'BHEL Bhopal', status: 'active' }],
    locations: [{
      id: locationId,
      organizationId: orgId,
      organizationName: 'BHEL Bhopal',
      workName: 'Housekeeping',
      name: 'Bhopal Staff Canteen',
      designation: 'Cleaner',
      status: 'active',
      address: '',
    }],
  };
  const sticky = {
    organizationId: orgId,
    organizationName: 'BHEL Bhopal',
    locationId,
    locationIds: [locationId],
    topic: 'employees',
    lastIntent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
    items: ['Manoj Iyer', 'Rakesh Nair'],
  };
  try {
    const allEmployees = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Mujhe Sare employee ki list do',
      directory,
      context: sticky,
      lang: 'hi',
    });
    assert.ok(allEmployees);
    assert.equal(allEmployees.intent, INTENTS.ACTIVE_EMPLOYEE_COUNT);
    assert.match(allEmployees.reply, /200|too long|बहुत लंबी|organization/i);
    assert.doesNotMatch(allEmployees.reply, /Manoj Iyer|Rakesh Nair/i);

    const ambala = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Ambala employee ke naam batao',
      directory,
      context: sticky,
      lang: 'hi',
    });
    assert.equal(ambala, null);
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('donon locations employee names and usmein active count use sticky org', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  let findCalls = 0;
  Employee.countDocuments = async (filter = {}) => (filter.locationId ? 2 : 4);
  Employee.find = () => {
    findCalls += 1;
    const names = findCalls <= 1
      ? [{ name: 'Amit Yadav' }, { name: 'Vikram Kumar' }]
      : [{ name: 'Suresh Guard' }, { name: 'Ramesh Guard' }];
    return {
      select() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean: async () => names,
    };
  };
  const orgId = '507f1f77bcf86cd7994390c1';
  const hkId = '507f1f77bcf86cd7994390c2';
  const secId = '507f1f77bcf86cd7994390c3';
  const directory = {
    organizations: [{ id: orgId, name: 'Powergrid Khetri', status: 'active' }],
    locations: [
      {
        id: hkId, organizationId: orgId, organizationName: 'Powergrid Khetri',
        workName: 'Housekeeping', name: 'Khetri Admin Block', designation: 'Sweeper', status: 'active', address: '',
      },
      {
        id: secId, organizationId: orgId, organizationName: 'Powergrid Khetri',
        workName: 'Security', name: 'Khetri Main Gate Post', designation: 'Security', status: 'active', address: '',
      },
    ],
  };
  try {
    const both = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'donon locations ke employee ke naam do',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Powergrid Khetri',
        locationId: hkId,
        locationIds: [hkId, secId],
        topic: 'location',
      },
      lang: 'hi',
    });
    assert.ok(both);
    assert.match(both.reply, /Amit Yadav|Vikram Kumar|Suresh Guard|Ramesh Guard/i);
    assert.equal(both.context.locationIds.length, 2);

    const usmein = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'usmein kitne active employee hai',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Powergrid Khetri',
        locationId: hkId,
        locationIds: [hkId],
        topic: 'employees',
      },
      lang: 'hi',
    });
    assert.ok(usmein);
    assert.match(usmein.reply, /Khetri Admin Block|active employees: 2/i);
    assert.doesNotMatch(usmein.reply, /dashboard|200/i);
  } finally {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
  }
});

test('ismein and bhai kitne employee use sticky document location not dashboard', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async (filter = {}) => (filter.locationId ? 2 : 200);
  const orgId = '507f1f77bcf86cd799439101';
  const locationId = '507f1f77bcf86cd799439102';
  const directory = {
    organizations: [{ id: orgId, name: 'BHEL Bhopal', status: 'active' }],
    locations: [{
      id: locationId,
      organizationId: orgId,
      organizationName: 'BHEL Bhopal',
      workName: 'Security',
      name: 'Bhopal Switchyard Post',
      designation: 'Security',
      status: 'active',
      address: '',
    }],
  };
  const sticky = {
    topic: 'document',
    documentType: 'attendance_register',
    organizationId: orgId,
    organizationName: 'BHEL Bhopal',
    locationId,
    locationIds: [locationId],
    locationName: 'Security – Bhopal Switchyard Post',
  };
  try {
    const ismein = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Kitna employee activate hai ismein',
      directory,
      context: sticky,
      lang: 'hi',
    });
    assert.ok(ismein);
    assert.match(ismein.reply, /Bhopal Switchyard|active employees: 2/i);
    assert.doesNotMatch(ismein.reply, /dashboard|200/i);

    const bhai = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'bhai kitne employee active hai',
      directory,
      context: sticky,
      lang: 'hi',
    });
    assert.ok(bhai);
    assert.match(bhai.reply, /Bhopal Switchyard|active employees: 2/i);
    assert.doesNotMatch(bhai.reply, /dashboard|200/i);
  } finally {
    Employee.countDocuments = originalCount;
  }
});

test('Bhopal switch yard and Silchar STT resolve to Switchyard Post', () => {
  const locs = [
    {
      id: '1', organizationId: 'o', organizationName: 'BHEL Bhopal',
      workName: 'Security', name: 'Bhopal Switchyard Post', designation: 'Security', status: 'active', address: '',
    },
    {
      id: '2', organizationId: 'o', organizationName: 'BHEL Bhopal',
      workName: 'Housekeeping', name: 'Bhopal Staff Canteen', designation: 'Cleaner', status: 'active', address: '',
    },
  ];
  const a = resolveLocations('Bhopal switch yard post ki attendance', locs);
  assert.equal(a.ambiguous, false);
  assert.equal(a.matches[0].id, '1');
  const b = resolveLocations('Bhopal Silchar post mein kitne employee', locs);
  assert.equal(b.ambiguous, false);
  assert.equal(b.matches[0].id, '1');
});

test('bare name after horticulture employee count lists sticky employees', async () => {
  const Employee = require('../../src/models/Employee');
  const originalFind = Employee.find;
  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{ name: 'Pooja Verma' }, { name: 'Suman Devi' }],
  });
  const orgId = '507f1f77bcf86cd7994390e1';
  const locationId = '507f1f77bcf86cd7994390e2';
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'name',
      directory: {
        organizations: [{ id: orgId, name: 'Powergrid Agra', status: 'active' }],
        locations: [{
          id: locationId,
          organizationId: orgId,
          organizationName: 'Powergrid Agra',
          workName: 'Horticulture',
          name: 'Agra Colony Lawn',
          designation: 'Mali',
          status: 'active',
          address: '',
        }],
      },
      context: {
        organizationId: orgId,
        organizationName: 'Powergrid Agra',
        locationId,
        locationIds: [locationId],
        lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        topic: 'employees',
        items: [],
      },
      lang: 'hi',
    });
    assert.ok(result);
    assert.match(result.reply, /Pooja Verma|Suman Devi/i);
    assert.doesNotMatch(result.reply, /document|Which document|माफ़/i);
  } finally {
    Employee.find = originalFind;
  }
});

test('housekeeping employee naam lists people not counts', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  Employee.countDocuments = async () => 2;
  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{ name: 'Anita Nair' }, { name: 'Ravi Menon' }],
  });
  const orgId = '507f1f77bcf86cd7994390a1';
  const locationId = '507f1f77bcf86cd7994390a2';
  const directory = {
    organizations: [{ id: orgId, name: 'BPCL Kochi', status: 'active' }],
    locations: [
      {
        id: locationId,
        organizationId: orgId,
        organizationName: 'BPCL Kochi',
        workName: 'Housekeeping',
        name: 'Kochi Admin Block',
        designation: 'Housekeeping',
        status: 'active',
        address: '',
      },
      {
        id: '507f1f77bcf86cd7994390a3',
        organizationId: orgId,
        organizationName: 'BPCL Kochi',
        workName: 'Horticulture',
        name: 'Kochi Garden',
        designation: 'Horticulture',
        status: 'active',
        address: '',
      },
    ],
  };
  try {
    const names = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'ismein housekeeping locations Mein donon employ ke naam batao',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'BPCL Kochi',
        locationIds: [locationId],
        lastIntent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
        topic: 'employees',
        items: [],
      },
      lang: 'hi',
    });
    assert.ok(names);
    assert.match(names.reply, /Anita Nair|Ravi Menon/i);
    assert.doesNotMatch(names.reply, /active employees = 2|Which document/i);
    assert.deepEqual([...new Set(names.context.items)], ['Anita Nair', 'Ravi Menon']);
    assert.equal(names.context.items.length, 2);

    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'unke Naam batao',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'BPCL Kochi',
        locationId,
        locationIds: [locationId],
        lastIntent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
        topic: 'employees',
        items: [],
      },
      lang: 'hi',
    });
    assert.ok(follow);
    assert.match(follow.reply, /Anita Nair|Ravi Menon/i);
    assert.doesNotMatch(follow.reply, /• Housekeeping – Kochi Admin Block$/m);

    const explicit = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'housekeeping location Kochi admin block wali location ke andar ke all employee ke naam batao',
      directory,
      context: { organizationId: orgId, organizationName: 'BPCL Kochi' },
      lang: 'hi',
    });
    assert.ok(explicit);
    assert.match(explicit.reply, /Anita Nair|Ravi Menon/i);
    assert.doesNotMatch(explicit.reply, /active employees = 2/i);
  } finally {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
  }
});

test('sticky location answers destination follow-up', async () => {
  const locationId = '507f1f77bcf86cd799439081';
  const orgId = '507f1f77bcf86cd799439080';
  const result = await answerDirectoryQuery({
    user: { id: '1', role: 'admin' },
    message: 'uski destination kya hai',
    directory: {
      organizations: [{ id: orgId, name: 'Staff Canteen Client', status: 'active' }],
      locations: [{
        id: locationId,
        organizationId: orgId,
        organizationName: 'Staff Canteen Client',
        workName: 'Housekeeping',
        name: 'Bhopal Staff Canteen',
        designation: 'Cleaner',
        status: 'active',
        address: '',
      }],
    },
    context: {
      topic: 'document',
      documentType: 'attendance_register',
      locationId,
      organizationId: orgId,
      locationName: 'Housekeeping – Bhopal Staff Canteen',
    },
    lang: 'hi',
  });
  assert.ok(result);
  assert.equal(result.intent, INTENTS.LOCATION_DETAILS);
  assert.match(result.reply, /Cleaner|Designation/i);
  assert.doesNotMatch(result.reply, /Which employee|किस employee/i);
});

test('location resolves by PO number, address, and distinctive work name', () => {
  const locs = [
    {
      id: 'po-1',
      organizationId: 'o1',
      organizationName: 'BHEL Bhopal',
      workName: 'Security Gate North',
      name: 'Switchyard Gate',
      designation: 'Security',
      status: 'active',
      address: 'Sector 12 Switchyard Road Bhopal',
      opNumber: '5200076637',
    },
    {
      id: 'po-2',
      organizationId: 'o1',
      organizationName: 'BHEL Bhopal',
      workName: 'Housekeeping',
      name: 'Staff Canteen',
      designation: 'Cleaner',
      status: 'active',
      address: 'Canteen Block Near Admin',
      opNumber: 'PO-8841',
    },
  ];

  const byPo = resolveLocations('PO 5200076637 ki attendance banao', locs);
  assert.equal(byPo.ambiguous, false);
  assert.equal(byPo.matches[0].id, 'po-1');

  const byPoAlt = resolveLocations('5200076637 wali location ke employees', locs);
  assert.equal(byPoAlt.ambiguous, false);
  assert.equal(byPoAlt.matches[0].id, 'po-1');

  const byOpCode = resolveLocations('PO-8841 ki details do', locs);
  assert.equal(byOpCode.ambiguous, false);
  assert.equal(byOpCode.matches[0].id, 'po-2');

  const byAddress = resolveLocations('Sector 12 Switchyard Road Bhopal pe attendance', locs);
  assert.equal(byAddress.ambiguous, false);
  assert.equal(byAddress.matches[0].id, 'po-1');

  const byWork = resolveLocations('Security Gate North ki details', locs);
  assert.equal(byWork.ambiguous, false);
  assert.equal(byWork.matches[0].id, 'po-1');
});

test('directory query uses PO number to pick location employee count', async () => {
  const Employee = require('../../src/models/Employee');
  const originalCount = Employee.countDocuments;
  Employee.countDocuments = async (filter = {}) => (filter.locationId === 'loc-po' ? 3 : 0);
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: '5200076637 mein kitne employee active hai',
      directory: {
        organizations: [{ id: 'org-po', name: 'BHEL Bhopal', status: 'active' }],
        locations: [{
          id: 'loc-po',
          organizationId: 'org-po',
          organizationName: 'BHEL Bhopal',
          workName: 'Security',
          name: 'Bhopal Switchyard Post',
          designation: 'Security',
          status: 'active',
          address: 'Sector 12 Switchyard Road',
          opNumber: '5200076637',
        }, {
          id: 'loc-other',
          organizationId: 'org-po',
          organizationName: 'BHEL Bhopal',
          workName: 'Housekeeping',
          name: 'Staff Canteen',
          designation: 'Cleaner',
          status: 'active',
          address: '',
          opNumber: '111',
        }],
      },
      lang: 'hi',
    });
    assert.ok(result);
    assert.match(result.reply, /Switchyard|active employees.*3/i);
    assert.equal(result.context.locationId, 'loc-po');
  } finally {
    Employee.countDocuments = originalCount;
  }
});
