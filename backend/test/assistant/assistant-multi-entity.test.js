/**
 * Multi-entity / "donon" Conversation Intelligence regressions.
 * Happy Yard Care → Park Care + Campus Care conversation path.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const Attendance = require('../../src/models/Attendance');
const {
  INTENTS,
  answerDirectoryQuery,
} = require('../../src/services/assistant/assistantDirectoryQuery');
const {
  mergeContext,
  expectsMultipleEntities,
  validateAnswerAgainstContext,
} = require('../../src/services/assistant/assistantContext');
const {
  answerEmployeeAttendance,
  clearAssistantCaches,
} = require('../../src/services/assistantService');

test.beforeEach(() => {
  clearAssistantCaches();
});

const orgId = '507f1f77bcf86cd799439501';
const parkId = '507f1f77bcf86cd799439511';
const campusId = '507f1f77bcf86cd799439512';
const empPark1 = '507f1f77bcf86cd799439521';
const empPark2 = '507f1f77bcf86cd799439522';
const empCampus1 = '507f1f77bcf86cd799439523';
const empCampus2 = '507f1f77bcf86cd799439524';

const directory = {
  organizations: [{ id: orgId, name: 'Happy Yard Care', status: 'active', phone: '900', email: 'h@test.com' }],
  locations: [
    {
      id: parkId,
      organizationId: orgId,
      organizationName: 'Happy Yard Care',
      workName: 'Park Care',
      name: 'Hurda Depot',
      designation: 'Mali',
      status: 'active',
      address: 'Hurda',
    },
    {
      id: campusId,
      organizationId: orgId,
      organizationName: 'Happy Yard Care',
      workName: 'Campus Care',
      name: 'Raipur Camp',
      designation: 'Cleaner',
      status: 'active',
      address: 'Raipur',
    },
  ],
};

const people = [
  {
    _id: empPark1, name: 'Lalit Jain', parentName: 'Mohan', organizationId: orgId, locationId: parkId,
    designation: 'Supervisor', status: 'active',
  },
  {
    _id: empPark2, name: 'Ram Jat', parentName: 'Suresh', organizationId: orgId, locationId: parkId,
    designation: 'Mali', status: 'active',
  },
  {
    _id: empCampus1, name: 'Mohan Khatik', parentName: 'Ramesh', organizationId: orgId, locationId: campusId,
    designation: 'Cleaner', status: 'active',
  },
  {
    _id: empCampus2, name: 'Shyam Choudhary', parentName: 'Gopal', organizationId: orgId, locationId: campusId,
    designation: 'Cleaner', status: 'active',
  },
];

function stubEmployees() {
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  const originalFindById = Employee.findById;
  Employee.countDocuments = async (filter = {}) => {
    let rows = people;
    if (filter.locationId) rows = rows.filter((item) => String(item.locationId) === String(filter.locationId));
    if (filter.organizationId && filter.organizationId.$ne == null) {
      /* keep */
    } else if (filter.organizationId) {
      rows = rows.filter((item) => String(item.organizationId) === String(filter.organizationId));
    }
    if (filter.status?.$ne === 'disabled') rows = rows.filter((item) => item.status !== 'disabled');
    return rows.length;
  };
  Employee.find = (filter = {}) => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => {
      let rows = people;
      if (filter.locationId) rows = rows.filter((item) => String(item.locationId) === String(filter.locationId));
      if (filter.organizationId && typeof filter.organizationId === 'string') {
        rows = rows.filter((item) => String(item.organizationId) === String(filter.organizationId));
      }
      if (filter.status?.$ne === 'disabled') rows = rows.filter((item) => item.status !== 'disabled');
      return rows;
    },
  });
  Employee.findById = (id) => ({
    select() { return this; },
    lean: async () => people.find((item) => String(item._id) === String(id)) || null,
  });
  return () => {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
    Employee.findById = originalFindById;
  };
}

function stubAttendance() {
  const originalFind = Attendance.find;
  Attendance.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => [
      { date: '2026-11-01', status: 'present' },
      { date: '2026-11-02', status: 'present' },
    ],
  });
  return () => {
    Attendance.find = originalFind;
  };
}

test('expectsMultipleEntities detects Hindi/English/Hinglish group words', () => {
  assert.equal(expectsMultipleEntities('donon ki details do'), true);
  assert.equal(expectsMultipleEntities('both locations please'), true);
  assert.equal(expectsMultipleEntities('sabhi employees ke naam'), true);
  assert.equal(expectsMultipleEntities('दोनों employees attendance'), true);
  assert.equal(expectsMultipleEntities('Park Care ki details'), false);
});

test('Happy Yard: Park Care count then donon ki details returns BOTH locations', async () => {
  const restore = stubEmployees();
  try {
    const org = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Happy Yard Care',
      directory,
      lang: 'hi',
    });
    assert.equal(org.intent, INTENTS.ORGANIZATION_DETAILS);
    assert.equal(org.data.organizationId, orgId);

    const park = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Parker mein kitne employee hai',
      directory,
      context: org.context,
      lang: 'hi',
    });
    assert.equal(park.intent, INTENTS.LOCATION_EMPLOYEE_COUNT);
    assert.equal(park.data.locationId, parkId);
    assert.ok(park.context.locationIds.includes(parkId));
    assert.ok(park.context.locationIds.includes(campusId));

    const bothDetails = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'donon ki details do',
      directory,
      context: mergeContext(org.context, park.context),
      lang: 'hi',
    });
    assert.equal(bothDetails.intent, INTENTS.LOCATION_DETAILS);
    assert.deepEqual(bothDetails.data.locationIds.sort(), [parkId, campusId].sort());
    assert.match(bothDetails.reply, /Park Care/i);
    assert.match(bothDetails.reply, /Campus Care/i);
    assert.notEqual(bothDetails.data.locationId, parkId);
    assert.equal(bothDetails.context.locationGroup.ids.length, 2);

    const validation = validateAnswerAgainstContext(bothDetails, org.context, { expectsMultiple: true });
    assert.equal(validation.ok, true);
  } finally {
    restore();
  }
});

test('donon employ ke naam lists employees across both locations with employeeGroup', async () => {
  const restore = stubEmployees();
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'donon employ ke naam batao',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Happy Yard Care',
        locationId: parkId,
        locationIds: [parkId, campusId],
        lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        topic: 'employees',
      },
      lang: 'hi',
    });
    assert.ok(result);
    assert.match(result.reply, /Lalit Jain/);
    assert.match(result.reply, /Ram Jat/);
    assert.match(result.reply, /Mohan Khatik/);
    assert.match(result.reply, /Shyam Choudhary/);
    assert.equal(result.context.employeeGroup.ids.length, 4);
    assert.equal(result.context.employeeIds.length, 4);
    assert.ok(result.context.employeeGroup.members.every((item) => item.id && item.locationId && item.organizationId));
    assert.deepEqual(result.data.locationIds.sort(), [parkId, campusId].sort());
  } finally {
    restore();
  }
});

test('English both locations details and sabhi employees variants', async () => {
  const restore = stubEmployees();
  try {
    const details = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'both locations details please',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Happy Yard Care',
        locationIds: [parkId, campusId],
        topic: 'location',
      },
      lang: 'en',
    });
    assert.equal(details.intent, INTENTS.LOCATION_DETAILS);
    assert.match(details.reply, /Park Care/i);
    assert.match(details.reply, /Campus Care/i);

    const sabhi = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'sabhi employees ke naam batao',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Happy Yard Care',
        locationIds: [parkId, campusId],
        topic: 'locations',
      },
      lang: 'hi',
    });
    assert.equal(sabhi.context.employeeIds.length, 4);
  } finally {
    restore();
  }
});

test('donon employee attendance clarifies when previous group has 4 people', async () => {
  const restoreEmp = stubEmployees();
  const restoreAtt = stubAttendance();
  try {
    const group = {
      type: 'employee',
      ids: [empPark1, empPark2, empCampus1, empCampus2],
      members: people.map((item) => ({
        id: String(item._id),
        name: item.name,
        parentName: item.parentName,
        locationId: String(item.locationId),
        organizationId: orgId,
      })),
      organizationId: orgId,
    };
    const result = await answerEmployeeAttendance(
      { id: '1', role: 'admin' },
      'donon employee attendance do',
      directory,
      '2026-11-18',
      {
        organizationId: orgId,
        organizationName: 'Happy Yard Care',
        locationIds: [parkId, campusId],
        employeeGroup: group,
        employeeIds: group.ids,
        items: people.map((item) => item.name),
        topic: 'employees',
      },
    );
    assert.ok(result);
    assert.equal(result.data?.needsClarification, true);
    assert.match(result.reply, /4 employees|किन 2|Which 2/i);
    assert.ok(Array.isArray(result.choices));
    assert.equal(result.choices.length, 4);
  } finally {
    restoreEmp();
    restoreAtt();
  }
});

test('exactly two remembered employees attendance returns both without asking', async () => {
  const restoreEmp = stubEmployees();
  const restoreAtt = stubAttendance();
  try {
    const group = {
      type: 'employee',
      ids: [empPark1, empPark2],
      members: [
        {
          id: empPark1, name: 'Lalit Jain', parentName: 'Mohan', locationId: parkId, organizationId: orgId,
        },
        {
          id: empPark2, name: 'Ram Jat', parentName: 'Suresh', locationId: parkId, organizationId: orgId,
        },
      ],
      organizationId: orgId,
    };
    const result = await answerEmployeeAttendance(
      { id: '1', role: 'admin' },
      'donon employee attendance do',
      directory,
      '2026-11-18',
      {
        organizationId: orgId,
        locationId: parkId,
        locationIds: [parkId],
        employeeGroup: group,
        employeeIds: group.ids,
        topic: 'employees',
      },
    );
    assert.ok(result);
    assert.match(result.reply, /Lalit Jain/);
    assert.match(result.reply, /Ram Jat/);
    assert.doesNotMatch(result.reply, /किसकी|Which/);
    assert.deepEqual(result.data.employeeIds.sort(), [empPark1, empPark2].sort());
  } finally {
    restoreEmp();
    restoreAtt();
  }
});

test('pehle dono employees attendance uses first two of the group', async () => {
  const restoreEmp = stubEmployees();
  const restoreAtt = stubAttendance();
  try {
    const group = {
      type: 'employee',
      ids: [empPark1, empPark2, empCampus1, empCampus2],
      members: people.map((item) => ({
        id: String(item._id),
        name: item.name,
        parentName: item.parentName,
        locationId: String(item.locationId),
        organizationId: orgId,
      })),
      organizationId: orgId,
    };
    const result = await answerEmployeeAttendance(
      { id: '1', role: 'admin' },
      'pehle dono employees ki attendance do',
      directory,
      '2026-11-18',
      {
        organizationId: orgId,
        employeeGroup: group,
        employeeIds: group.ids,
        topic: 'employees',
      },
    );
    assert.ok(result);
    assert.match(result.reply, /Lalit Jain/);
    assert.match(result.reply, /Ram Jat/);
    assert.doesNotMatch(result.reply, /Mohan Khatik|Shyam Choudhary/);
  } finally {
    restoreEmp();
    restoreAtt();
  }
});

test('validation rejects single location when multi was requested', () => {
  const bad = {
    intent: INTENTS.LOCATION_DETAILS,
    data: { locationId: parkId, organizationId: orgId },
    context: { organizationId: orgId, locationId: parkId },
  };
  const result = validateAnswerAgainstContext(bad, { organizationId: orgId }, { expectsMultiple: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'single_entity_for_multi_request');
});

test('context persists locationGroup and employeeGroup across merge', () => {
  const first = {
    organizationId: orgId,
    locationIds: [parkId, campusId],
    locationGroup: { type: 'location', ids: [parkId, campusId] },
  };
  const second = {
    topic: 'employees',
    employeeGroup: { type: 'employee', ids: [empPark1, empPark2] },
    employeeIds: [empPark1, empPark2],
    items: ['Lalit Jain', 'Ram Jat'],
  };
  const merged = mergeContext(first, second);
  assert.deepEqual(merged.locationIds, [parkId, campusId]);
  assert.deepEqual(merged.employeeIds, [empPark1, empPark2]);
  assert.equal(merged.locationGroup.ids.length, 2);
  assert.equal(merged.employeeGroup.ids.length, 2);
});
