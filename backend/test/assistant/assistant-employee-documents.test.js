const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const {
  parseType,
  interpretWithRules,
  resolvePlan,
  documentPersonSearchText,
  clearAssistantCaches,
} = require('../../src/services/assistantService');

test.beforeEach(() => {
  clearAssistantCaches();
});

const orgId = '507f1f77bcf86cd799439011';
const locId = '507f1f77bcf86cd799439022';
const employeeId = '507f1f77bcf86cd7994390a1';
const directory = {
  organizations: [{ id: orgId, name: 'Campus Care', status: 'active' }],
  locations: [
    {
      id: locId,
      organizationId: orgId,
      organizationName: 'Campus Care',
      workName: 'Park Care',
      name: 'Hurda Depot',
      designation: 'Mali',
      status: 'active',
      address: '',
    },
    {
      id: '507f1f77bcf86cd799439023',
      organizationId: orgId,
      organizationName: 'Campus Care',
      workName: 'Housekeeping',
      name: 'Pisangan',
      designation: 'Cleaner',
      status: 'active',
      address: '',
    },
  ],
};

function stubEmployees(rows) {
  const originalFind = Employee.find;
  const originalFindOne = Employee.findOne;
  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => rows,
  });
  Employee.findOne = () => ({
    select() { return this; },
    lean: async () => rows[0] ? {
      _id: rows[0]._id || rows[0].id,
      name: rows[0].name,
      organizationId: rows[0].organizationId,
      locationId: rows[0].locationId,
    } : null,
  });
  return () => {
    Employee.find = originalFind;
    Employee.findOne = originalFindOne;
  };
}

test('वेज सीट and wage seat parse as wage_register', () => {
  assert.equal(parseType('अनीता रेगर की वेज सीट दो'), 'wage_register');
  assert.equal(parseType('Anita Regar ki wage sheet do'), 'wage_register');
  assert.equal(parseType('Anita ki veg seat do'), 'wage_register');
});

test('documentPersonSearchText keeps only the person name', () => {
  assert.match(documentPersonSearchText('अनीता रेगर की वेज सीट दो'), /अनीता\s+रेगर|anita\s+regar/i);
  assert.match(documentPersonSearchText('Anita Regar ki October wage sheet do'), /anita\s+regar/i);
  assert.match(documentPersonSearchText('Anita Regar ki payroll do'), /anita\s+regar/i);
  assert.match(documentPersonSearchText('Anita Regar ki attendance register do'), /anita\s+regar/i);
  assert.doesNotMatch(documentPersonSearchText('Anita Regar ki wage sheet do'), /wage|sheet|payroll|attendance/i);
});

test('named employee wage sheet resolves without location picker', async () => {
  const restore = stubEmployees([{
    _id: employeeId,
    id: employeeId,
    name: 'Anita Regar',
    parentName: 'Ramesh',
    organizationId: orgId,
    locationId: locId,
    designation: 'Mali',
    status: 'active',
  }]);
  try {
    const draft = await interpretWithRules(
      { id: '1', role: 'admin' },
      'अनीता रेगर की वेज सीट दो',
      directory,
      '2026-11-18',
      null,
    );
    assert.equal(draft.type, 'wage_register');
    assert.equal(draft.employeeName, 'Anita Regar');
    assert.equal(draft.employeeId, employeeId);
    assert.equal(draft.locationId, null);

    const plan = await resolvePlan(
      { id: '1', role: 'admin' },
      draft,
      directory,
      { message: 'अनीता रेगर की वेज सीट दो', today: '2026-11-18' },
    );
    assert.ok(plan.document, plan.reply);
    assert.equal(plan.document.type, 'wage_register');
    assert.deepEqual(plan.document.employeeIds, [employeeId]);
    assert.equal(plan.document.locationId, locId);
    assert.equal(plan.document.organizationId, orgId);
    assert.match(plan.reply, /Anita Regar|Wage register/i);
    assert.doesNotMatch(plan.reply, /किस location|which location/i);
  } finally {
    restore();
  }
});

test('named employee payroll and attendance also scope to that person', async () => {
  const restore = stubEmployees([{
    _id: employeeId,
    id: employeeId,
    name: 'Anita Regar',
    parentName: 'Ramesh',
    organizationId: orgId,
    locationId: locId,
    designation: 'Mali',
    status: 'active',
  }]);
  try {
    for (const [message, type] of [
      ['Anita Regar ki payroll do', 'payroll'],
      ['Anita Regar ki attendance register do', 'attendance_register'],
    ]) {
      const draft = await interpretWithRules(
        { id: '1', role: 'admin' },
        message,
        directory,
        '2026-11-18',
        null,
      );
      assert.equal(draft.type, type, message);
      assert.equal(draft.employeeId, employeeId, message);
      const plan = await resolvePlan(
        { id: '1', role: 'admin' },
        draft,
        directory,
        { message, today: '2026-11-18' },
      );
      assert.ok(plan.document, `${message} => ${plan.reply}`);
      assert.deepEqual(plan.document.employeeIds, [employeeId]);
      assert.doesNotMatch(plan.reply, /किस location|which location/i);
    }
  } finally {
    restore();
  }
});

test('sticky employee bare wage sheet uses remembered person', async () => {
  const restore = stubEmployees([{
    _id: employeeId,
    id: employeeId,
    name: 'Anita Regar',
    parentName: 'Ramesh',
    organizationId: orgId,
    locationId: locId,
    designation: 'Mali',
    status: 'active',
  }]);
  try {
    const draft = await interpretWithRules(
      { id: '1', role: 'admin' },
      'wage sheet do',
      directory,
      '2026-11-18',
      { topic: 'employee', employeeId, employeeName: 'Anita Regar' },
    );
    assert.equal(draft.type, 'wage_register');
    assert.equal(draft.employeeId, employeeId);
    const plan = await resolvePlan(
      { id: '1', role: 'admin' },
      draft,
      directory,
      { message: 'wage sheet do', today: '2026-11-18' },
    );
    assert.ok(plan.document);
    assert.deepEqual(plan.document.employeeIds, [employeeId]);
    assert.doesNotMatch(plan.reply, /किस location|which location/i);
  } finally {
    restore();
  }
});

test('duplicate employee wage sheet offers father-name choices', async () => {
  const id2 = '507f1f77bcf86cd7994390a2';
  const restore = stubEmployees([
    {
      _id: employeeId, id: employeeId, name: 'Lalit Jain', parentName: 'Ram Lal',
      organizationId: orgId, locationId: locId, designation: 'Mali', status: 'active',
    },
    {
      _id: id2, id: id2, name: 'Lalit Jain', parentName: 'Shyam Lal',
      organizationId: orgId, locationId: '507f1f77bcf86cd799439023', designation: 'Guard', status: 'active',
    },
  ]);
  try {
    const draft = await interpretWithRules(
      { id: '1', role: 'admin' },
      'Lalit Jain ki wage sheet do',
      directory,
      '2026-11-18',
      null,
    );
    assert.equal(draft.type, 'wage_register');
    assert.match(draft.employeeName || '', /lalit\s+jain/i);
    assert.equal(draft.employeeId, null);

    const plan = await resolvePlan(
      { id: '1', role: 'admin' },
      draft,
      directory,
      { message: 'Lalit Jain ki wage sheet do', today: '2026-11-18' },
    );
    assert.equal(plan.document, undefined);
    assert.match(plan.reply, /2 employees/i);
    assert.ok(plan.choices?.length >= 2);
    assert.ok(plan.choices.some((item) => /Ram Lal/.test(item.label)));
    assert.ok(plan.choices.some((item) => /Shyam Lal/.test(item.label)));
    assert.ok(plan.choices.every((item) => item.plan?.employeeId && item.plan?.type === 'wage_register'));
  } finally {
    restore();
  }
});
