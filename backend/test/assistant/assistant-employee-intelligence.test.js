/**
 * Employee Intelligence 3.0 — Fresh Plot Services + dynamic field follow-ups.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const Attendance = require('../../src/models/Attendance');
const {
  INTENTS,
  answerDirectoryQuery,
  classifyDirectoryIntent,
} = require('../../src/services/assistant/assistantDirectoryQuery');
const {
  messageWantsEmployeeCount,
  parseRequestedEmployeeFields,
  buildEmployeeQueryGroup,
  isStickyEmployeeFieldFollowUp,
} = require('../../src/services/assistant/assistantEmployeeIntelligence');
const {
  answerEmployeeAttendance,
  clearAssistantCaches,
  maskSensitiveEmployeeValue,
} = require('../../src/services/assistantService');
const { mergeContext } = require('../../src/services/assistant/assistantContext');

test.beforeEach(() => {
  clearAssistantCaches();
});

const orgId = '507f1f77bcf86cd799439701';
const locA = '507f1f77bcf86cd799439711';
const locB = '507f1f77bcf86cd799439712';
const ids = [
  '507f1f77bcf86cd799439721',
  '507f1f77bcf86cd799439722',
  '507f1f77bcf86cd799439723',
  '507f1f77bcf86cd799439724',
];

const directory = {
  organizations: [{ id: orgId, name: 'Fresh Plot Services', status: 'active' }],
  locations: [
    {
      id: locA, organizationId: orgId, organizationName: 'Fresh Plot Services',
      workName: 'North Plot', name: 'North', status: 'active',
    },
    {
      id: locB, organizationId: orgId, organizationName: 'Fresh Plot Services',
      workName: 'South Plot', name: 'South', status: 'active',
    },
  ],
};

const people = [
  {
    _id: ids[0], name: 'Asha Verma', phone: '9000000001', email: 'asha@test.com',
    organizationId: orgId, locationId: locA, status: 'active', parentName: 'Ram', designation: 'Supervisor',
    address: 'Jaipur', dateOfJoining: '2021-05-01', dateOfBirth: '', department: 'Ops',
    uan: '111', esicNumber: '', aadhaarNumber: '123412341234', bankName: 'SBI', bankBranch: 'MI Road',
    bankAccountHolder: 'Asha Verma', bankAccountNumber: '9988776655', bankRoutingCode: 'SBIN000123',
  },
  {
    _id: ids[1], name: 'Bharat Lal', phone: '9000000002', email: 'bharat@test.com',
    organizationId: orgId, locationId: locA, status: 'active', parentName: 'Shyam', designation: 'Mali',
    address: '', dateOfJoining: '', dateOfBirth: '', department: '',
    uan: '', esicNumber: '', aadhaarNumber: '', bankName: '', bankBranch: '',
    bankAccountHolder: '', bankAccountNumber: '', bankRoutingCode: '',
  },
  {
    _id: ids[2], name: 'Chetan Das', phone: '9000000003', email: '',
    organizationId: orgId, locationId: locB, status: 'active', parentName: 'Mohan', designation: 'Cleaner',
    address: 'Ajmer', dateOfJoining: '2022-01-10', dateOfBirth: '', department: '',
    uan: '', esicNumber: '', aadhaarNumber: '', bankName: '', bankBranch: '',
    bankAccountHolder: '', bankAccountNumber: '', bankRoutingCode: '',
  },
  {
    _id: ids[3], name: 'Deepak Jain', phone: '9000000004', email: 'deepak@test.com',
    organizationId: orgId, locationId: locB, status: 'active', parentName: 'Kailash', designation: 'Guard',
    address: '', dateOfJoining: '', dateOfBirth: '', department: '',
    uan: '', esicNumber: '', aadhaarNumber: '', bankName: '', bankBranch: '',
    bankAccountHolder: '', bankAccountNumber: '', bankRoutingCode: '',
  },
];

function stubEmployees() {
  const originalCount = Employee.countDocuments;
  const originalFind = Employee.find;
  const originalFindById = Employee.findById;
  Employee.countDocuments = async (filter = {}) => {
    let rows = people.slice();
    if (filter.organizationId && filter.organizationId.$ne == null) {
      /* dashboard */
    } else if (filter.organizationId) {
      rows = rows.filter((item) => String(item.organizationId) === String(filter.organizationId));
    }
    if (filter.locationId?.$in) {
      const set = filter.locationId.$in.map(String);
      rows = rows.filter((item) => set.includes(String(item.locationId)));
    } else if (filter.locationId) {
      rows = rows.filter((item) => String(item.locationId) === String(filter.locationId));
    }
    if (filter.status?.$ne === 'disabled') rows = rows.filter((item) => item.status !== 'disabled');
    if (filter._id?.$in) {
      const set = filter._id.$in.map(String);
      rows = rows.filter((item) => set.includes(String(item._id)));
    }
    return rows.length;
  };
  Employee.find = (filter = {}) => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => {
      let rows = people.slice();
      if (filter.organizationId && filter.organizationId.$ne == null) {
        /* keep all for admin dashboard scope */
      } else if (filter.organizationId) {
        rows = rows.filter((item) => String(item.organizationId) === String(filter.organizationId));
      }
      if (filter.locationId?.$in) {
        const set = filter.locationId.$in.map(String);
        rows = rows.filter((item) => set.includes(String(item.locationId)));
      } else if (filter.locationId) {
        rows = rows.filter((item) => String(item.locationId) === String(filter.locationId));
      }
      if (filter.status?.$ne === 'disabled') rows = rows.filter((item) => item.status !== 'disabled');
      if (filter._id?.$in) {
        const set = filter._id.$in.map(String);
        rows = rows.filter((item) => set.includes(String(item._id)));
      }
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
      { date: '2026-10-01', status: 'present' },
      { date: '2026-10-02', status: 'absent' },
    ],
  });
  return () => { Attendance.find = originalFind; };
}

test('mobile number is not treated as employee-count intent', () => {
  assert.equal(messageWantsEmployeeCount('Charon employee ke naam aur unke mobile number do'), false);
  assert.equal(messageWantsEmployeeCount('kitne employees hain'), true);
  // Without sticky org context this is not a dashboard count either ("number" ≠ headcount).
  assert.notEqual(
    classifyDirectoryIntent('Charon employee ke naam aur unke mobile number do', {}),
    INTENTS.ACTIVE_EMPLOYEE_COUNT,
  );
});

test('field parser extracts multiple fields and complete profile', () => {
  const parsed = parseRequestedEmployeeFields('Naam, email, phone aur designation ek saath do');
  assert.ok(parsed.fields.some((field) => field.id === 'name'));
  assert.ok(parsed.fields.some((field) => field.id === 'email'));
  assert.ok(parsed.fields.some((field) => field.id === 'phone'));
  assert.ok(parsed.fields.some((field) => field.id === 'designation'));

  const complete = parseRequestedEmployeeFields('Complete employee profile dikhao');
  assert.equal(complete.complete, true);
  assert.ok(complete.fields.length >= 8);
});

test('1. Fresh Plot Services count → charon names and mobile numbers', async () => {
  const restore = stubEmployees();
  try {
    const count = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Fresh Plot Services mein kitne employees hain?',
      directory,
      lang: 'hi',
    });
    assert.equal(count.intent, INTENTS.ORGANIZATION_EMPLOYEE_COUNT);
    assert.equal(count.data.active, 4);
    assert.equal(count.context.employeeQueryGroup.organizationId, orgId);
    assert.equal(count.context.employeeQueryGroup.count, 4);
    assert.equal(count.context.employeeQueryGroup.lastQueryType, 'employee_count');

    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Charon employee ke naam aur unke mobile number do',
      directory,
      context: count.context,
      lang: 'hi',
    });
    assert.ok(follow);
    assert.notEqual(follow.intent, INTENTS.ACTIVE_EMPLOYEE_COUNT);
    assert.doesNotMatch(follow.reply, /dashboard/i);
    assert.match(follow.reply, /Asha Verma/);
    assert.match(follow.reply, /9000000001/);
    assert.match(follow.reply, /Bharat Lal/);
    assert.match(follow.reply, /Chetan Das/);
    assert.match(follow.reply, /Deepak Jain/);
    assert.equal(follow.data.employeeIds.length, 4);
    assert.equal(follow.data.organizationId, orgId);
  } finally {
    restore();
  }
});

test('2. organization count → three or more requested fields', async () => {
  const restore = stubEmployees();
  try {
    const count = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Fresh Plot Services mein kitne employees hain?',
      directory,
      lang: 'hi',
    });
    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Sabhi ka naam, email aur designation do',
      directory,
      context: count.context,
      lang: 'hi',
    });
    assert.match(follow.reply, /Asha Verma/);
    assert.match(follow.reply, /asha@test\.com|Email/i);
    assert.match(follow.reply, /Supervisor|Designation/i);
    assert.ok(follow.data.fields.includes('email'));
    assert.ok(follow.data.fields.includes('designation'));
  } finally {
    restore();
  }
});

test('3. location employee count → complete details for those employees', async () => {
  const restore = stubEmployees();
  try {
    const count = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'North Plot mein kitne employees hain?',
      directory,
      lang: 'hi',
    });
    assert.equal(count.intent, INTENTS.LOCATION_EMPLOYEE_COUNT);
    assert.equal(count.data.locationId, locA);

    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Dono ke complete details do',
      directory,
      context: count.context,
      lang: 'hi',
    });
    assert.ok(follow.data.complete || follow.data.fields.length >= 5);
    assert.match(follow.reply, /Asha Verma/);
    assert.match(follow.reply, /Bharat Lal/);
    assert.doesNotMatch(follow.reply, /Chetan Das|Deepak Jain/);
  } finally {
    restore();
  }
});

test('4-6. employee list → email / address / complete profile follow-ups', async () => {
  const restore = stubEmployees();
  try {
    const list = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Fresh Plot Services ke employees ke naam batao',
      directory,
      lang: 'hi',
    });
    assert.ok(list.context.employeeIds?.length || list.context.employeeQueryGroup);

    const emailAsk = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Unka email bhi do',
      directory,
      context: mergeContext(null, list.context),
      lang: 'hi',
    });
    assert.match(emailAsk.reply, /asha@test\.com|Email/i);

    const addressAsk = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Unka address batao',
      directory,
      context: emailAsk.context,
      lang: 'hi',
    });
    assert.match(addressAsk.reply, /Jaipur|Address|Not available/i);

    const profile = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Complete employee profile dikhao',
      directory,
      context: addressAsk.context,
      lang: 'hi',
    });
    assert.equal(profile.data.complete, true);
    assert.match(profile.reply, /Asha Verma/);
  } finally {
    restore();
  }
});

test('7. employee list → attendance history for sticky group of two', async () => {
  const restoreEmp = stubEmployees();
  const restoreAtt = stubAttendance();
  try {
    const result = await answerEmployeeAttendance(
      { id: '1', role: 'admin' },
      'donon employee attendance do',
      directory,
      '2026-11-18',
      {
        organizationId: orgId,
        employeeGroup: {
          type: 'employee',
          ids: [ids[0], ids[1]],
          members: [
            { id: ids[0], name: 'Asha Verma', locationId: locA, organizationId: orgId },
            { id: ids[1], name: 'Bharat Lal', locationId: locA, organizationId: orgId },
          ],
        },
        employeeIds: [ids[0], ids[1]],
        topic: 'employees',
      },
    );
    assert.match(result.reply, /Asha Verma/);
    assert.match(result.reply, /Bharat Lal/);
  } finally {
    restoreEmp();
    restoreAtt();
  }
});

test('11. Hindi / Hinglish / English field request variants', () => {
  for (const message of [
    'Charon employee ke naam aur mobile number do',
    'Sabhi ka email aur address batao',
    'Give all employee names and phone numbers',
    'Sirf mobile number chahiye',
  ]) {
    assert.equal(isStickyEmployeeFieldFollowUp(message, {
      organizationId: orgId,
      employeeQueryGroup: buildEmployeeQueryGroup({
        organizationId: orgId,
        count: 4,
        lastQueryType: 'employee_count',
      }),
      topic: 'employees',
      lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
    }), true);
  }
});

test('12. missing fields show Not available', async () => {
  const restore = stubEmployees();
  try {
    const count = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Fresh Plot Services mein kitne employees hain?',
      directory,
      lang: 'hi',
    });
    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Unka address aur email do',
      directory,
      context: count.context,
      lang: 'hi',
    });
    assert.match(follow.reply, /Not available|Ajmer|Jaipur|asha@test\.com/i);
  } finally {
    restore();
  }
});

test('13. unauthorized bank details are masked for non-admin', () => {
  assert.match(maskSensitiveEmployeeValue({ role: 'organization' }, 'account', '9988776655'), /\*\*\*\*/);
  assert.equal(maskSensitiveEmployeeValue({ role: 'admin' }, 'account', '9988776655'), '9988776655');
});

test('16. organization-scoped follow-up never returns dashboard-wide results', async () => {
  const restore = stubEmployees();
  try {
    const count = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'plot service ke andar kitne employee hain?',
      directory,
      lang: 'hi',
    });
    // May resolve as org or location depending on fuzzy match; either way keep scope.
    assert.ok(count?.context?.organizationId === orgId || count?.data?.organizationId === orgId);

    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Charon employee ke naam aur unke mobile number do',
      directory,
      context: {
        ...count.context,
        organizationId: orgId,
        organizationName: 'Fresh Plot Services',
        employeeQueryGroup: buildEmployeeQueryGroup({
          source: 'organization',
          organizationId: orgId,
          organizationName: 'Fresh Plot Services',
          count: 4,
          lastQueryType: 'employee_count',
        }),
        topic: 'employees',
        lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
      },
      lang: 'hi',
    });
    assert.doesNotMatch(follow.reply, /dashboard/i);
    assert.notEqual(follow.intent, INTENTS.ACTIVE_EMPLOYEE_COUNT);
    assert.equal(follow.data.organizationId, orgId);
  } finally {
    restore();
  }
});

test('15. explicit dashboard-wide employee requests still work without sticky org', async () => {
  const restore = stubEmployees();
  try {
    const result = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Mujhe Sare employee ki list do',
      directory,
      lang: 'hi',
    });
    assert.equal(result.intent, INTENTS.ACTIVE_EMPLOYEE_COUNT);
    assert.match(result.reply, /dashboard|organization/i);
  } finally {
    restore();
  }
});

test('8. individual employee → multiple fields via sticky ids', async () => {
  const restore = stubEmployees();
  try {
    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Naam, email, phone aur designation ek saath do',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Fresh Plot Services',
        topic: 'employees',
        lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_LIST,
        employeeIds: [ids[0]],
        employeeQueryGroup: buildEmployeeQueryGroup({
          source: 'organization',
          organizationId: orgId,
          organizationName: 'Fresh Plot Services',
          employeeIds: [ids[0]],
          count: 1,
          lastQueryType: 'employee_list',
          members: [{ id: ids[0], name: 'Asha Verma', organizationId: orgId, locationId: locA }],
        }),
      },
      lang: 'hi',
    });
    assert.match(follow.reply, /Asha Verma/);
    assert.match(follow.reply, /asha@test\.com|9000000001|Supervisor/i);
    assert.doesNotMatch(follow.reply, /Bharat Lal/);
  } finally {
    restore();
  }
});

test('9. first two employees → selected fields', async () => {
  const restore = stubEmployees();
  try {
    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Pehle dono ka mobile number do',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Fresh Plot Services',
        topic: 'employees',
        lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
        employeeQueryGroup: buildEmployeeQueryGroup({
          source: 'organization',
          organizationId: orgId,
          organizationName: 'Fresh Plot Services',
          count: 4,
          lastQueryType: 'employee_count',
        }),
      },
      lang: 'hi',
    });
    assert.equal(follow.data.employeeIds.length, 2);
    assert.match(follow.reply, /Asha Verma/);
    assert.match(follow.reply, /Bharat Lal/);
    assert.doesNotMatch(follow.reply, /Chetan Das|Deepak Jain/);
  } finally {
    restore();
  }
});

test('10. ambiguous dono with four employees asks clarification', async () => {
  const restore = stubEmployees();
  try {
    const follow = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Dono ke email do',
      directory,
      context: {
        organizationId: orgId,
        organizationName: 'Fresh Plot Services',
        topic: 'employees',
        lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
        employeeQueryGroup: buildEmployeeQueryGroup({
          source: 'organization',
          organizationId: orgId,
          organizationName: 'Fresh Plot Services',
          count: 4,
          lastQueryType: 'employee_count',
        }),
      },
      lang: 'hi',
    });
    assert.equal(follow.data.needsClarification, true);
    assert.match(follow.reply, /Asha Verma|Bharat Lal|which|किन/i);
  } finally {
    restore();
  }
});

test('14. long follow-up chain preserves employee group', async () => {
  const restore = stubEmployees();
  try {
    let ctx = null;
    const count = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Fresh Plot Services mein kitne employees hain?',
      directory,
      lang: 'hi',
    });
    ctx = mergeContext(ctx, count.context);
    const names = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Charon ke naam batao',
      directory,
      context: ctx,
      lang: 'hi',
    });
    ctx = mergeContext(ctx, names.context);
    const phones = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Ab unka mobile number do',
      directory,
      context: ctx,
      lang: 'hi',
    });
    ctx = mergeContext(ctx, phones.context);
    const emails = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Unka email bhi do',
      directory,
      context: ctx,
      lang: 'hi',
    });
    assert.equal(emails.data.organizationId, orgId);
    assert.match(emails.reply, /asha@test\.com/);
    assert.doesNotMatch(emails.reply, /dashboard/i);
  } finally {
    restore();
  }
});

test('17. rapid consecutive field asks keep the same organization scope', async () => {
  const restore = stubEmployees();
  try {
    const count = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Fresh Plot Services mein kitne employees hain?',
      directory,
      lang: 'hi',
    });
    const a = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Sabhi ka mobile number do',
      directory,
      context: count.context,
      lang: 'hi',
    });
    const b = await answerDirectoryQuery({
      user: { id: '1', role: 'admin' },
      message: 'Sabhi ka email do',
      directory,
      context: a.context,
      lang: 'hi',
    });
    assert.equal(a.data.organizationId, orgId);
    assert.equal(b.data.organizationId, orgId);
    assert.equal(a.data.employeeIds.length, 4);
    assert.equal(b.data.employeeIds.length, 4);
  } finally {
    restore();
  }
});
