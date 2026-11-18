const assert = require('node:assert/strict');
const test = require('node:test');
const { requireRole } = require('../../src/middleware/auth');
const assistantRoutes = require('../../src/routes/assistantRoutes');
const {
  answerEmployeeDetails,
  maskSensitiveEmployeeValue,
  canViewUnmaskedEmployeeSensitive,
  clearAssistantCaches,
} = require('../../src/services/assistantService');
const { formatEmployee } = require('../../src/services/assistant/tools/employeeTools');
const Employee = require('../../src/models/Employee');

test.beforeEach(() => {
  clearAssistantCaches();
});

test('requireRole(admin) rejects organization and employee for assistant policy', () => {
  const guard = requireRole('admin');

  for (const role of ['organization', 'employee']) {
    let status = null;
    guard(
      { user: { id: '1', role } },
      {},
      (error) => {
        status = error?.statusCode || null;
      },
    );
    assert.equal(status, 403, `${role} should be forbidden`);
  }

  let continued = false;
  guard(
    { user: { id: '1', role: 'admin' } },
    {},
    (error) => {
      continued = error === undefined;
    },
  );
  assert.equal(continued, true);
});

test('assistant router mounts auth-protected admin routes', () => {
  const stack = assistantRoutes.stack || [];
  assert.ok(stack.length > 0);

  const paths = [];
  for (const layer of stack) {
    if (!layer.route) continue;
    paths.push(layer.route.path);
    assert.ok(
      (layer.route.stack?.length || 0) >= 2,
      `Route ${layer.route.path} should include auth middleware`,
    );
  }

  assert.ok(paths.includes('/chat'));
  assert.ok(paths.includes('/session/:id'));
  assert.ok(paths.includes('/feedback'));
  assert.ok(paths.includes('/health'));
});

test('assistant route module exports an Express router', () => {
  assert.equal(typeof assistantRoutes, 'function');
  assert.ok(Array.isArray(assistantRoutes.stack));
});

test('maskSensitiveEmployeeValue reveals full PII only for admin', () => {
  const admin = { id: '1', role: 'admin' };
  const orgUser = { id: '507f1f77bcf86cd799439011', role: 'organization' };
  assert.equal(canViewUnmaskedEmployeeSensitive(admin), true);
  assert.equal(canViewUnmaskedEmployeeSensitive(orgUser), false);
  assert.equal(maskSensitiveEmployeeValue(admin, 'aadhaar', '123456789012'), '123456789012');
  assert.equal(maskSensitiveEmployeeValue(orgUser, 'aadhaar', '123456789012'), '**** 9012');
  assert.equal(maskSensitiveEmployeeValue(orgUser, 'phone', '9876543210'), '**** 3210');
  assert.equal(maskSensitiveEmployeeValue(orgUser, 'account', '1234560536'), '**** 0536');
  assert.equal(maskSensitiveEmployeeValue(orgUser, 'uan', '100200300400'), '**** 0400');
  assert.equal(maskSensitiveEmployeeValue(orgUser, 'esic', 'ESIC998877'), '**** 8877');
  assert.equal(maskSensitiveEmployeeValue(orgUser, 'bank', 'HDFC Town'), 'HDFC Town');
});

test('employee details mask sensitive fields for non-admin', async () => {
  const employeeId = '507f1f77bcf86cd799439077';
  const orgId = '507f1f77bcf86cd799439011';
  const locId = '507f1f77bcf86cd799439022';
  const directory = {
    organizations: [{ id: orgId, name: 'SAIL Bhilai', status: 'active' }],
    locations: [{
      id: locId,
      organizationId: orgId,
      organizationName: 'SAIL Bhilai',
      workName: 'Security',
      name: 'Gate',
      designation: 'Security',
      status: 'active',
      address: '',
    }],
  };
  const doc = {
    _id: employeeId,
    name: 'Amit Iyer',
    parentName: 'Gopal Joshi',
    phone: '9876543210',
    aadhaarNumber: '123456789012',
    uan: '100200300400',
    esicNumber: 'ESIC99887766',
    organizationId: orgId,
    locationId: locId,
    designation: 'Security Supervisor',
    status: 'active',
    bankName: 'HDFC',
    bankBranch: 'Town',
    bankAccountNumber: '1234560536',
    bankRoutingCode: 'HDFC0003120',
  };

  const originalFindById = Employee.findById;
  Employee.findById = () => ({
    select() { return this; },
    lean: async () => doc,
  });

  try {
    const adminReply = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'details',
      directory,
      'en',
      { topic: 'employee', employeeId, employeeName: 'Amit Iyer' },
    );
    assert.ok(adminReply);
    assert.match(adminReply.reply, /123456789012/);
    assert.match(adminReply.reply, /9876543210/);
    assert.match(adminReply.reply, /1234560536/);
    assert.match(adminReply.reply, /100200300400/);

    const orgReply = await answerEmployeeDetails(
      { id: orgId, role: 'organization' },
      'details',
      directory,
      'en',
      { topic: 'employee', employeeId, employeeName: 'Amit Iyer' },
    );
    assert.ok(orgReply);
    assert.match(orgReply.reply, /\*\*\*\* 9012/);
    assert.match(orgReply.reply, /\*\*\*\* 3210/);
    assert.match(orgReply.reply, /\*\*\*\* 0536/);
    assert.match(orgReply.reply, /\*\*\*\* 0400/);
    assert.match(orgReply.reply, /\*\*\*\* 7766/);
    assert.doesNotMatch(orgReply.reply, /123456789012/);
    assert.doesNotMatch(orgReply.reply, /9876543210/);
    assert.doesNotMatch(orgReply.reply, /1234560536/);
  } finally {
    Employee.findById = originalFindById;
  }
});

test('formatEmployee masks sensitive fields for non-admin', () => {
  const employee = {
    _id: '507f1f77bcf86cd799439077',
    name: 'Amit Iyer',
    phone: '9876543210',
    uan: '100200300400',
    esicNumber: 'ESIC99887766',
    bankAccountNumber: '1234560536',
    aadhaarNumber: '123456789012',
    bankName: 'HDFC',
  };
  const adminView = formatEmployee(employee, { role: 'admin' });
  assert.equal(adminView.phone, '9876543210');
  assert.equal(adminView.aadhaar, '123456789012');
  assert.equal(adminView.bankAccountNumber, '1234560536');

  const orgView = formatEmployee(employee, { role: 'organization' });
  assert.equal(orgView.phone, '**** 3210');
  assert.equal(orgView.aadhaar, '**** 9012');
  assert.equal(orgView.bankAccountNumber, '**** 0536');
  assert.equal(orgView.uan, '**** 0400');
  assert.equal(orgView.esic, '**** 7766');
});
