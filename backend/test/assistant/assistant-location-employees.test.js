const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const Attendance = require('../../src/models/Attendance');
const {
  INTENTS,
  classifyDirectoryIntent,
  answerDirectoryQuery,
} = require('../../src/services/assistant/assistantDirectoryQuery');
const {
  answerEmployeeAttendance,
  clearAssistantCaches,
} = require('../../src/services/assistantService');

test.beforeEach(() => {
  clearAssistantCaches();
});

const orgId = '507f1f77bcf86cd799439011';
const locId = '507f1f77bcf86cd799439022';
const locId2 = '507f1f77bcf86cd799439023';
const directory = {
  organizations: [{ id: orgId, name: 'Happy Yard Care', status: 'active' }],
  locations: [
    {
      id: locId,
      organizationId: orgId,
      organizationName: 'Happy Yard Care',
      workName: 'Park Care',
      name: 'Hurda Depot',
      designation: 'Mali',
      status: 'active',
      address: 'Hurda',
    },
    {
      id: locId2,
      organizationId: orgId,
      organizationName: 'Happy Yard Care',
      workName: 'Housekeeping',
      name: 'Pisangan',
      designation: 'Cleaner',
      status: 'active',
      address: '',
    },
  ],
};

const people = [
  {
    _id: '507f1f77bcf86cd7994390a1',
    name: 'Anita Regar',
    parentName: 'Ramesh',
    organizationId: orgId,
    locationId: locId,
    designation: 'Mali',
    status: 'active',
  },
  {
    _id: '507f1f77bcf86cd7994390a2',
    name: 'Lalit Jain',
    parentName: 'Mohan',
    organizationId: orgId,
    locationId: locId,
    designation: 'Supervisor',
    status: 'active',
  },
];

function stubDirectoryEmployees() {
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  Employee.countDocuments = async (filter = {}) => {
    if (filter.locationId && String(filter.locationId) === locId) return people.length;
    if (filter.locationId) return 0;
    return people.length;
  };
  Employee.find = (filter = {}) => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => {
      if (filter.locationId && String(filter.locationId) !== locId) return [];
      return people;
    },
  });
  return () => {
    Employee.countDocuments = originalCount;
    Employee.find = originalFind;
  };
}

test('named location employee count/list/details classify correctly', () => {
  assert.equal(
    classifyDirectoryIntent('Hurda Depot mein kitne employee hain', { hasLocationMention: true }),
    INTENTS.LOCATION_EMPLOYEE_COUNT,
  );
  assert.equal(
    classifyDirectoryIntent('Park Care location ke employees ke naam batao', { hasLocationMention: true }),
    INTENTS.LOCATION_EMPLOYEE_COUNT,
  );
  assert.equal(
    classifyDirectoryIntent('Hurda Depot ke employees ki details do', { hasLocationMention: true }),
    INTENTS.LOCATION_EMPLOYEE_COUNT,
  );
  assert.equal(
    classifyDirectoryIntent('Park Care ki attendance kitni hai', { hasLocationMention: true }),
    INTENTS.ATTENDANCE_QUERY,
  );
});

test('named location employee count returns active total', async () => {
  const restore = stubDirectoryEmployees();
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Hurda Depot mein kitne employee hain',
      directory,
      lang: 'hi',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.LOCATION_EMPLOYEE_COUNT);
    assert.match(result.reply, /active employees:\s*2/i);
    assert.equal(result.context?.locationId, locId);
  } finally {
    restore();
  }
});

test('named location employee names include father names and detail choices', async () => {
  const restore = stubDirectoryEmployees();
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Park Care location ke employees ke naam batao',
      directory,
      lang: 'hi',
    });
    assert.ok(result);
    assert.equal(result.intent, INTENTS.LOCATION_EMPLOYEE_COUNT);
    assert.match(result.reply, /Anita Regar/);
    assert.match(result.reply, /S\/O Ramesh|S\/O Mohan/);
    assert.ok(result.choices?.length >= 2);
    assert.ok(result.choices.every((item) => item.plan?.type === 'directory_select'));
    assert.ok(result.choices.every((item) => item.plan?.resumeIntent === 'employee_details'));
  } finally {
    restore();
  }
});

test('named location employee details list is clickable roster', async () => {
  const restore = stubDirectoryEmployees();
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Hurda Depot ke employees ki details do',
      directory,
      lang: 'en',
    });
    assert.ok(result);
    assert.match(result.reply, /employees \(2\)/i);
    assert.match(result.reply, /Select a name below for details/i);
    assert.equal(result.choices?.length, 2);
  } finally {
    restore();
  }
});

test('sticky follow-up unke naam / unki details reuse location employees', async () => {
  const restore = stubDirectoryEmployees();
  try {
    const context = {
      lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
      organizationId: orgId,
      organizationName: 'Happy Yard Care',
      locationId: locId,
      locationIds: [locId],
      topic: 'employees',
      items: [],
    };
    const names = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'unke naam batao',
      directory,
      context,
      lang: 'hi',
    });
    assert.ok(names);
    assert.match(names.reply, /Anita Regar|Lalit Jain/);
    assert.ok(names.choices?.length >= 2);

    const details = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'unki details do',
      directory,
      context,
      lang: 'hi',
    });
    assert.ok(details);
    assert.match(details.reply, /Details के लिए|Select a name/i);
    assert.ok(details.choices?.length >= 2);
  } finally {
    restore();
  }
});

test('named location attendance summarizes employees at that site', async () => {
  const restore = stubDirectoryEmployees();
  const originalAttendanceFind = Attendance.find;
  Attendance.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => [
      { employeeId: people[0]._id, date: '2026-11-01', status: 'present' },
      { employeeId: people[0]._id, date: '2026-11-02', status: 'present' },
      { employeeId: people[1]._id, date: '2026-11-01', status: 'absent' },
    ],
  });
  const originalFindById = Employee.findById;
  Employee.findById = (id) => ({
    select() { return this; },
    lean: async () => people.find((item) => String(item._id) === String(id)) || null,
  });
  try {
    const result = await answerEmployeeAttendance(
      { id: '1', role: 'admin' },
      'Park Care ki attendance kitni hai',
      directory,
      '2026-11-18',
      null,
    );
    assert.ok(result);
    assert.match(result.reply, /Anita Regar|Lalit Jain/i);
    assert.doesNotMatch(result.reply, /किस employee|Whose attendance|Which location/i);
    assert.equal(result.context?.locationId, locId);
  } finally {
    Attendance.find = originalAttendanceFind;
    Employee.findById = originalFindById;
    restore();
  }
});
