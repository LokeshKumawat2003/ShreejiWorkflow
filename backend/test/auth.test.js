const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { createApp } = require('../src/app');
const { requireRole } = require('../src/middleware/auth');
const Attendance = require('../src/models/Attendance');
const Employee = require('../src/models/Employee');
const Location = require('../src/models/Location');
const User = require('../src/models/User');
const {
  assignEmployees,
  createEmployee,
  deleteEmployee,
  listEmployees,
  unassignEmployees,
  updateEmployee,
} = require('../src/services/employeeService');
const {
  bulkMarkAttendance,
  getAttendanceRegister,
  listAttendance,
  listAttendanceHistory,
  markAttendance,
  parseAttendanceMonth,
  parseAttendanceSheet,
} = require('../src/services/attendanceService');
const { detectSheetPeriod, matchExtractedEmployee, parseSheetMatrix, parseSheetMatrixMonth } = require('../src/services/attendanceSheetParser');
const { calculateBankPayments, calculatePayroll, calculateWageRegister } = require('../src/services/payrollService');
const { createOrganization, updateOrganization } = require('../src/services/organizationService');
const { createLocation, deleteLocation, listLocations, updateLocation, validateLocationInput } = require('../src/services/locationService');
const MasterData = require('../src/models/MasterData');
const { createMasterData, deleteMasterData, updateMasterData } = require('../src/services/masterDataService');
const DocumentSettings = require('../src/models/DocumentSettings');
const { DOCUMENT_FIELDS, getDocumentSettings, updateDocumentSettings } = require('../src/services/documentSettingsService');

test('health endpoint works without MongoDB', async (t) => {
  process.env.NODE_ENV = 'test';
  const server = createApp().listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'disconnected' });
});

test('organization creation requires authentication', async (t) => {
  process.env.NODE_ENV = 'test';
  const server = createApp().listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/organizations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Owner',
      organizationName: 'Example Org',
      email: 'owner@example.com',
      password: 'StrongPass123',
    }),
  });
  assert.equal(response.status, 401);

  const updateResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/organizations/507f1f77bcf86cd799439011`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Owner',
      organizationName: 'Example Org',
      email: 'owner@example.com',
    }),
  });
  assert.equal(updateResponse.status, 401);
});

test('organization creation saves and returns optional profile details', async () => {
  const originalCreate = User.create;
  User.create = async (input) => ({ id: '507f1f77bcf86cd799439011', ...input, createdAt: new Date() });

  try {
    const result = await createOrganization({
      name: 'Owner',
      organizationName: 'Example Org',
      email: 'owner@example.com',
      password: 'StrongPass123',
      phone: '+1 555 123 4567',
      address: '1 Main Street, Example City',
      about: 'A local technology company.',
      website: 'https://example.com',
      industry: 'Technology',
    });

    assert.equal(result.organization.phone, '+1 555 123 4567');
    assert.equal(result.organization.address, '1 Main Street, Example City');
    assert.equal(result.organization.about, 'A local technology company.');
    assert.equal(result.organization.website, 'https://example.com');
    assert.equal(result.organization.industry, 'Technology');
  } finally {
    User.create = originalCreate;
  }
});

test('organization updates preserve optional profile details when omitted', async () => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const currentOrganization = {
    id: '507f1f77bcf86cd799439011',
    name: 'Old Owner',
    organizationName: 'Example Org',
    email: 'owner@example.com',
    role: 'organization',
    status: 'active',
    phone: '+1 555 123 4567',
    address: '1 Main Street',
    about: 'A local technology company.',
    website: 'https://example.com',
    industry: 'Technology',
  };
  User.findOneAndUpdate = async (_filter, update) => ({ ...currentOrganization, ...update.$set });

  try {
    const result = await updateOrganization('507f1f77bcf86cd799439011', {
      name: 'New Owner',
      organizationName: 'Example Org',
      email: 'owner@example.com',
    });

    assert.equal(result.phone, currentOrganization.phone);
    assert.equal(result.address, currentOrganization.address);
    assert.equal(result.about, currentOrganization.about);
    assert.equal(result.website, currentOrganization.website);
    assert.equal(result.industry, currentOrganization.industry);
  } finally {
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('employee routes require authentication', async (t) => {
  process.env.NODE_ENV = 'test';
  const server = createApp().listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/employees`);
  assert.equal(response.status, 401);

  const deleteResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/employees/507f1f77bcf86cd799439011`, {
    method: 'DELETE',
  });
  assert.equal(deleteResponse.status, 401);

  const letterResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/employees/507f1f77bcf86cd799439011/appointment-letter`, {
    method: 'POST',
  });
  assert.equal(letterResponse.status, 401);
});

test('appointment letter email rejects malformed employee ids before database access', async () => {
  const { sendAppointmentLetterEmail } = require('../src/services/appointmentLetterEmailService');
  await assert.rejects(
    sendAppointmentLetterEmail(
      { id: '507f1f77bcf86cd799439011', role: 'admin' },
      { employeeId: 'not-an-id', locationId: '507f1f77bcf86cd799439012', file: { buffer: Buffer.from('pdf') } },
    ),
    (error) => error.statusCode === 400 && error.message === 'Invalid employee id.',
  );
});

test('appointment letter email sends the PDF to the assigned employee', async () => {
  const nodemailer = require('nodemailer');
  const { sendAppointmentLetterEmail } = require('../src/services/appointmentLetterEmailService');
  const originalLocationFindOne = Location.findOne;
  const originalEmployeeFindOne = Employee.findOne;
  const originalCreateTransport = nodemailer.createTransport;
  const originalSmtpEnvironment = Object.fromEntries(
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']
      .map((key) => [key, process.env[key]]),
  );
  const locationId = '507f1f77bcf86cd799439012';
  const organizationId = '507f1f77bcf86cd799439013';
  const employeeId = '507f1f77bcf86cd799439014';
  const pdf = Buffer.from('%PDF-1.4 test');
  let sentMessage;

  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'mailer';
  process.env.SMTP_PASS = 'secret';
  process.env.MAIL_FROM = 'Shreeji <mail@example.com>';
  Location.findOne = (filter) => {
    assert.deepEqual(filter, { _id: locationId, organizationId });
    return { select: async () => ({ _id: locationId, organizationId, name: 'Main Site' }) };
  };
  Employee.findOne = (filter) => {
    assert.deepEqual(filter, { _id: employeeId, organizationId, locationId });
    return { select: async () => ({ name: 'Employee Name', email: 'employee@example.com' }) };
  };
  nodemailer.createTransport = (options) => {
    assert.equal(options.host, 'smtp.example.com');
    return {
      sendMail: async (message) => {
        sentMessage = message;
      },
    };
  };

  try {
    const result = await sendAppointmentLetterEmail(
      { id: organizationId, role: 'organization' },
      { employeeId, locationId, file: { buffer: pdf } },
    );

    assert.deepEqual(result, { sent: true });
    assert.equal(sentMessage.to, 'employee@example.com');
    assert.equal(sentMessage.attachments[0].content, pdf);
    assert.equal(sentMessage.attachments[0].contentType, 'application/pdf');
  } finally {
    Location.findOne = originalLocationFindOne;
    Employee.findOne = originalEmployeeFindOne;
    nodemailer.createTransport = originalCreateTransport;
    for (const [key, value] of Object.entries(originalSmtpEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('combined appointment letters are emailed to the owning organization', async () => {
  const nodemailer = require('nodemailer');
  const { sendOrganizationAppointmentLettersEmail } = require('../src/services/appointmentLetterEmailService');
  const originalLocationFindOne = Location.findOne;
  const originalUserFindOne = User.findOne;
  const originalCreateTransport = nodemailer.createTransport;
  const originalSmtpEnvironment = Object.fromEntries(
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']
      .map((key) => [key, process.env[key]]),
  );
  const locationId = '507f1f77bcf86cd799439022';
  const organizationId = '507f1f77bcf86cd799439023';
  const pdf = Buffer.from('%PDF-1.4 combined test');
  let sentMessage;

  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'mailer';
  process.env.SMTP_PASS = 'secret';
  process.env.MAIL_FROM = 'Shreeji <mail@example.com>';
  Location.findOne = (filter) => {
    assert.deepEqual(filter, { _id: locationId });
    return { select: async () => ({ _id: locationId, organizationId, name: 'Main Site' }) };
  };
  User.findOne = (filter) => {
    assert.deepEqual(filter, { _id: organizationId, role: 'organization' });
    return { select: async () => ({ email: 'organization@example.com', organizationName: 'Example Organization' }) };
  };
  nodemailer.createTransport = () => ({
    sendMail: async (message) => {
      sentMessage = message;
    },
  });

  try {
    const result = await sendOrganizationAppointmentLettersEmail(
      { id: '507f1f77bcf86cd799439024', role: 'admin' },
      { locationId, file: { buffer: pdf } },
    );

    assert.deepEqual(result, { sent: true });
    assert.equal(sentMessage.to, 'organization@example.com');
    assert.match(sentMessage.subject, /Main Site/);
    assert.equal(sentMessage.attachments.length, 1);
    assert.equal(sentMessage.attachments[0].content, pdf);
    assert.equal(sentMessage.attachments[0].contentType, 'application/pdf');
  } finally {
    Location.findOne = originalLocationFindOne;
    User.findOne = originalUserFindOne;
    nodemailer.createTransport = originalCreateTransport;
    for (const [key, value] of Object.entries(originalSmtpEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('SMTP delivery failures return a safe gateway error and log protocol diagnostics', async () => {
  const nodemailer = require('nodemailer');
  const { sendOrganizationAppointmentLettersEmail } = require('../src/services/appointmentLetterEmailService');
  const originalLocationFindOne = Location.findOne;
  const originalUserFindOne = User.findOne;
  const originalCreateTransport = nodemailer.createTransport;
  const originalConsoleError = console.error;
  const originalSmtpEnvironment = Object.fromEntries(
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']
      .map((key) => [key, process.env[key]]),
  );
  const locationId = '507f1f77bcf86cd799439032';
  const organizationId = '507f1f77bcf86cd799439033';
  let loggedDiagnostics;

  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'mailer';
  process.env.SMTP_PASS = 'secret';
  process.env.MAIL_FROM = 'Shreeji <mail@example.com>';
  Location.findOne = () => ({
    select: async () => ({ _id: locationId, organizationId, name: 'Main Site' }),
  });
  User.findOne = () => ({
    select: async () => ({ email: 'organization@example.com', organizationName: 'Example Organization' }),
  });
  nodemailer.createTransport = () => ({
    sendMail: async () => {
      const error = new Error('Sensitive SMTP response text');
      error.code = 'EAUTH';
      error.command = 'AUTH PLAIN';
      error.responseCode = 535;
      throw error;
    },
  });
  console.error = (message, details) => {
    loggedDiagnostics = { message, details };
  };

  try {
    await assert.rejects(
      sendOrganizationAppointmentLettersEmail(
        { id: '507f1f77bcf86cd799439034', role: 'admin' },
        { locationId, file: { buffer: Buffer.from('%PDF-1.4 test') } },
      ),
      (error) => error.statusCode === 502 && error.message.includes('SMTP authentication'),
    );
    assert.deepEqual(loggedDiagnostics.details, {
      code: 'EAUTH',
      command: 'AUTH PLAIN',
      responseCode: 535,
    });
    assert.doesNotMatch(JSON.stringify(loggedDiagnostics), /Sensitive SMTP response text|secret/);
  } finally {
    Location.findOne = originalLocationFindOne;
    User.findOne = originalUserFindOne;
    nodemailer.createTransport = originalCreateTransport;
    console.error = originalConsoleError;
    for (const [key, value] of Object.entries(originalSmtpEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('employee creation validates required fields before database access', async () => {
  await assert.rejects(
    createEmployee({ id: 'admin-id', role: 'admin' }, {}),
    (error) => error.statusCode === 400 && error.message === 'Employee name is required.',
  );
});

test('employee bank details must be supplied as a complete set', async () => {
  await assert.rejects(
    createEmployee(
      { id: 'admin-id', role: 'admin' },
      { name: 'Employee', email: 'employee@example.com', bankName: 'Example Bank' },
    ),
    (error) => error.statusCode === 400 && error.message === 'Complete all bank details or leave them all blank.',
  );
});

test('employee bank account number rejects invalid characters', async () => {
  await assert.rejects(
    createEmployee(
      { id: 'admin-id', role: 'admin' },
      {
        name: 'Employee',
        email: 'employee@example.com',
        bankName: 'Example Bank',
        bankBranch: 'Main',
        bankAccountHolder: 'Employee',
        bankAccountNumber: '12!@',
        bankRoutingCode: 'ABC123',
      },
    ),
    (error) => error.statusCode === 400 && error.message === 'Account number must be 4-34 letters or digits.',
  );
});

test('employee creation rejects negative daily salary before database access', async () => {
  await assert.rejects(
    createEmployee(
      { id: 'admin-id', role: 'admin' },
      { name: 'Employee', email: 'employee@example.com', dailySalary: -10, currency: 'NRI' },
    ),
    (error) => error.statusCode === 400 && error.message === 'Daily salary must be a valid non-negative amount.',
  );
});

test('employee creation validates the currency code before database access', async () => {
  await assert.rejects(
    createEmployee(
      { id: 'admin-id', role: 'admin' },
      { name: 'Employee', email: 'employee@example.com', dailySalary: 100, currency: 'USDX' },
    ),
    (error) => error.statusCode === 400 && error.message === 'Currency must be a three-letter code.',
  );
});

test('employee deletion rejects malformed ids before database access', async () => {
  await assert.rejects(
    deleteEmployee({ id: '507f1f77bcf86cd799439011', role: 'organization' }, 'not-an-id'),
    (error) => error.statusCode === 400 && error.message === 'Invalid employee id.',
  );
});

test('organization users cannot assign employees to another organization', async () => {
  await assert.rejects(
    updateEmployee(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      '507f1f77bcf86cd799439012',
      { organizationId: '507f1f77bcf86cd799439013' },
    ),
    (error) => error.statusCode === 403,
  );
});

test('organization users cannot edit employee records', async () => {
  await assert.rejects(
    updateEmployee(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      '507f1f77bcf86cd799439012',
      { name: 'Changed Name' },
    ),
    (error) => error.statusCode === 403 && error.message === 'Only administrators can edit employees.',
  );
});

test('employee batch assignment requires at least one employee', async () => {
  await assert.rejects(
    assignEmployees(
      { id: '507f1f77bcf86cd799439011', role: 'admin' },
      { organizationId: '507f1f77bcf86cd799439012', employeeIds: [] },
    ),
    (error) => error.statusCode === 400 && error.message === 'Select between 1 and 100 valid employees.',
  );
});

test('removing an employee from an organization keeps the employee and attendance records', async () => {
  const originalFind = Employee.find;
  const originalUpdateMany = Employee.updateMany;
  const originalDeleteMany = Attendance.deleteMany;
  const employeeId = '507f1f77bcf86cd799439012';
  const organizationId = '507f1f77bcf86cd799439011';
  let employeeUpdate;

  Employee.find = async (filter) => {
    assert.deepEqual(filter, { _id: { $in: [employeeId] }, organizationId });
    return [{ toObject: () => ({
      _id: employeeId,
      organizationId,
      name: 'Employee Name',
      email: 'employee@example.com',
      status: 'active',
    }) }];
  };
  Employee.updateMany = async (filter, update) => {
    employeeUpdate = { filter, update };
    return { modifiedCount: 1 };
  };
  Attendance.deleteMany = async () => {
    assert.fail('Unassigning an employee must retain attendance records.');
  };

  try {
    const result = await unassignEmployees(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      { organizationId, employeeIds: [employeeId] },
    );

    assert.deepEqual(employeeUpdate, {
      filter: { _id: { $in: [employeeId] }, organizationId },
      update: { $set: { organizationId: null, locationId: null, locationAssignedAt: null } },
    });
    assert.equal(result[0].id, employeeId);
    assert.equal(result[0].organizationId, '');
  } finally {
    Employee.find = originalFind;
    Employee.updateMany = originalUpdateMany;
    Attendance.deleteMany = originalDeleteMany;
  }
});

test('organization users can only release employees from their own organization', async () => {
  const originalFind = Employee.find;
  const originalUpdateMany = Employee.updateMany;
  const employeeId = '507f1f77bcf86cd799439012';
  const organizationId = '507f1f77bcf86cd799439011';
  let employeeUpdate;

  Employee.find = async (filter) => {
    assert.deepEqual(filter, { _id: { $in: [employeeId] }, organizationId });
    return [{ toObject: () => ({
      _id: employeeId,
      organizationId,
      name: 'Employee Name',
      email: 'employee@example.com',
      status: 'active',
    }) }];
  };
  Employee.updateMany = async (filter, update) => {
    employeeUpdate = { filter, update };
    return { modifiedCount: 1 };
  };

  try {
    await unassignEmployees(
      { id: organizationId, role: 'organization' },
      { organizationId: '507f1f77bcf86cd799439099', employeeIds: [employeeId] },
    );
    assert.deepEqual(employeeUpdate, {
      filter: { _id: { $in: [employeeId] }, organizationId },
      update: { $set: { organizationId: null, locationId: null, locationAssignedAt: null } },
    });
  } finally {
    Employee.find = originalFind;
    Employee.updateMany = originalUpdateMany;
  }
});

test('attendance routes require authentication', async (t) => {
  process.env.NODE_ENV = 'test';
  const server = createApp().listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/attendance`);
  assert.equal(response.status, 401);

  const parseResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/attendance/parse`, { method: 'POST' });
  assert.equal(parseResponse.status, 401);
});

test('attendance marks reject invalid status before database access', async () => {
  await assert.rejects(
    markAttendance(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      { employeeId: '507f1f77bcf86cd799439012', date: new Date().toISOString().slice(0, 10), status: 'unknown' },
    ),
    (error) => error.statusCode === 400 && error.message === 'Select a valid attendance status.',
  );
});

test('organization users cannot mark attendance for a previous day', async () => {
  const timezone = 'Pacific/Kiritimati';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(Date.now() - 86_400_000));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const yesterday = `${values.year}-${values.month}-${values.day}`;
  await assert.rejects(
    markAttendance(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      { employeeId: '507f1f77bcf86cd799439012', date: yesterday, status: 'present', timeZone: timezone },
    ),
    (error) => error.statusCode === 400 && error.message === 'Organizations can only mark attendance for today.',
  );
});

test('organization users can mark attendance using their local calendar date', async () => {
  const originalFindEmployee = Employee.findOne;
  const originalFindAttendance = Attendance.findOneAndUpdate;
  const timezone = 'Pacific/Kiritimati';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const organizationId = '507f1f77bcf86cd799439011';
  const employeeId = '507f1f77bcf86cd799439012';

  Employee.findOne = async () => ({ _id: employeeId });
  Attendance.findOneAndUpdate = async (filter, update) => ({
    employeeId,
    date: today,
    status: update.$set.status,
    updatedAt: new Date(),
  });

  try {
    const result = await markAttendance(
      { id: organizationId, role: 'organization' },
      { employeeId, date: today, status: 'present', timeZone: timezone },
    );
    assert.equal(result.date, today);
    assert.equal(result.status, 'present');
  } finally {
    Employee.findOne = originalFindEmployee;
    Attendance.findOneAndUpdate = originalFindAttendance;
  }
});

test('payroll pays present days only and treats legacy statuses as absent', async () => {
  const originalAttendanceFind = Attendance.find;
  const originalEmployeeFind = Employee.find;
  const employeeId = '507f1f77bcf86cd799439012';
  Attendance.find = () => ({
    lean: async () => [
      { employeeId, status: 'present' },
      { employeeId, status: 'present' },
      { employeeId, status: 'absent' },
      { employeeId, status: 'late' },
      { employeeId, status: 'leave' },
    ],
  });
  Employee.find = () => ({
    lean: async () => [{
      _id: employeeId,
      name: 'Employee',
      email: 'employee@example.com',
      dailySalary: 30,
      currency: 'USD',
    }],
  });

  try {
    const payroll = await calculatePayroll(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      { fromDate: '2026-10-01', toDate: '2026-10-31' },
    );

    assert.deepEqual(payroll.paidStatuses, ['present']);
    assert.equal(payroll.lines[0].presentDays, 2);
    assert.equal(payroll.lines[0].absentDays, 3);
    assert.equal(payroll.lines[0].paidDays, 2);
    assert.equal(payroll.lines[0].grossPay, 60);
    assert.equal('lateDays' in payroll.lines[0], false);
    assert.equal('leaveDays' in payroll.lines[0], false);
  } finally {
    Attendance.find = originalAttendanceFind;
    Employee.find = originalEmployeeFind;
  }
});

test('payroll filters selected employees and paginates on the server with whole-run totals', async () => {
  const originalAttendanceFind = Attendance.find;
  const originalEmployeeFind = Employee.find;
  const ids = ['507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022', '507f1f77bcf86cd799439023'];
  Attendance.find = () => ({
    lean: async () => ids.map((employeeId) => ({ employeeId, status: 'present' })),
  });
  Employee.find = () => ({
    lean: async () => ids.map((id, index) => ({
      _id: id,
      name: `Employee ${String.fromCharCode(65 + index)}`,
      email: `e${index}@example.com`,
      dailySalary: 100,
      currency: 'INR',
    })),
  });

  try {
    const organization = { id: '507f1f77bcf86cd799439011', role: 'organization' };
    const options = { fromDate: '2026-10-01', toDate: '2026-10-31' };
    const selected = await calculatePayroll(organization, { ...options, employeeIds: `${ids[0]},${ids[2]}`, page: '2', limit: '1' });
    assert.deepEqual(selected.lines.map((line) => line.employeeId), [ids[2]]);
    assert.deepEqual(selected.pagination, { page: 2, limit: 1, total: 2, totalPages: 2 });
    assert.deepEqual(selected.summary, { employees: 2, presentDays: 2, absentDays: 0, paidDays: 2 });
    assert.deepEqual(selected.totals, [{ currency: 'INR', total: 200 }]);

    const everything = await calculatePayroll(organization, options);
    assert.equal(everything.lines.length, 3);
    assert.equal(everything.pagination, undefined);

    await assert.rejects(
      calculatePayroll(organization, { ...options, employeeIds: 'bad-id' }),
      (error) => error.statusCode === 400 && error.message === 'Invalid employee id.',
    );
  } finally {
    Attendance.find = originalAttendanceFind;
    Employee.find = originalEmployeeFind;
  }
});

test('attendance history remains visible for inactive employees with an existing record', async () => {
  const originalFindEmployees = Employee.find;
  const originalFindAttendance = Attendance.find;
  const organizationId = '507f1f77bcf86cd799439011';
  const activeEmployeeId = '507f1f77bcf86cd799439012';
  const inactiveWithHistoryId = '507f1f77bcf86cd799439013';
  const inactiveWithoutHistoryId = '507f1f77bcf86cd799439014';
  const employees = [
    { _id: activeEmployeeId, name: 'Active Employee', status: 'active' },
    { _id: inactiveWithHistoryId, name: 'Former Employee', status: 'disabled' },
    { _id: inactiveWithoutHistoryId, name: 'Blocked Employee', status: 'disabled' },
  ];

  Employee.find = (filter) => {
    assert.deepEqual(filter, { organizationId });
    return { sort: () => ({ lean: async () => employees }) };
  };
  Attendance.find = (filter) => {
    assert.deepEqual(filter, { organizationId, date: '2026-10-17' });
    return {
      lean: async () => [{
        employeeId: inactiveWithHistoryId,
        status: 'present',
        date: '2026-10-17',
      }],
    };
  };

  try {
    const result = await listAttendance(
      { id: organizationId, role: 'organization' },
      { date: '2026-10-17' },
    );

    assert.deepEqual(result.attendance.map(({ employeeId, status }) => ({ employeeId, status })), [
      { employeeId: activeEmployeeId, status: null },
      { employeeId: inactiveWithHistoryId, status: 'present' },
    ]);
    assert.equal(result.attendance[1].employeeStatus, 'disabled');
  } finally {
    Employee.find = originalFindEmployees;
    Attendance.find = originalFindAttendance;
  }
});

test('attendance history rejects malformed date filters before database access', async () => {
  await assert.rejects(
    listAttendanceHistory(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      { fromDate: 'not-a-date' },
    ),
    (error) => error.statusCode === 400 && error.message === 'Enter a valid attendance date range.',
  );
});

test('absent history includes legacy leave and late records', async () => {
  const originalCountDocuments = Attendance.countDocuments;
  const originalFindAttendance = Attendance.find;
  const organizationId = '507f1f77bcf86cd799439011';
  Attendance.countDocuments = async (filter) => {
    assert.deepEqual(filter, {
      organizationId,
      status: { $in: ['absent', 'late', 'leave'] },
    });
    return 1;
  };
  Attendance.find = (filter) => {
    assert.deepEqual(filter, {
      organizationId,
      status: { $in: ['absent', 'late', 'leave'] },
    });
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [{
                _id: '507f1f77bcf86cd799439015',
                employeeId: { _id: '507f1f77bcf86cd799439012', name: 'Employee' },
                date: '2026-10-01',
                status: 'leave',
                updatedAt: new Date('2026-10-01T12:00:00.000Z'),
              }],
            }),
          }),
        }),
      }),
    };
  };

  try {
    const result = await listAttendanceHistory(
      { id: organizationId, role: 'organization' },
      { status: 'absent' },
    );
    assert.equal(result.records[0].status, 'absent');
    assert.equal(result.pagination.total, 1);
  } finally {
    Attendance.countDocuments = originalCountDocuments;
    Attendance.find = originalFindAttendance;
  }
});

test('payroll pays present days only and counts legacy statuses as absent by currency', async () => {
  const originalFindEmployees = Employee.find;
  const originalFindAttendance = Attendance.find;
  const organizationId = '507f1f77bcf86cd799439011';
  const employees = [
    { _id: '507f1f77bcf86cd799439012', name: 'Alex', email: 'alex@example.com', dailySalary: 100, currency: 'INR', bankAccountNumber: '12345678901234' },
    { _id: '507f1f77bcf86cd799439013', name: 'Jamie', email: 'jamie@example.com', dailySalary: 50, currency: 'USD' },
  ];
  const attendance = [
    { employeeId: employees[0]._id, status: 'present', date: '2026-10-01' },
    { employeeId: employees[0]._id, status: 'late', date: '2026-10-02' },
    { employeeId: employees[0]._id, status: 'absent', date: '2026-10-03' },
    { employeeId: employees[0]._id, status: 'leave', date: '2026-10-04' },
    { employeeId: employees[1]._id, status: 'present', date: '2026-10-01' },
  ];

  Attendance.find = (filter) => {
    assert.deepEqual(filter, {
      organizationId,
      date: { $gte: '2026-10-01', $lte: '2026-10-31' },
    });
    return { lean: async () => attendance };
  };
  Employee.find = (filter) => {
    assert.deepEqual(filter, {
      $or: [
        { organizationId },
        { _id: { $in: employees.map(({ _id }) => _id) } },
      ],
    });
    return { lean: async () => employees };
  };

  try {
    const result = await calculatePayroll(
      { id: organizationId, role: 'organization' },
      { fromDate: '2026-10-01', toDate: '2026-10-31' },
    );

    assert.deepEqual(result.lines.map(({ employeeName, paidDays, grossPay }) => ({ employeeName, paidDays, grossPay })), [
      { employeeName: 'Alex', paidDays: 1, grossPay: 100 },
      { employeeName: 'Jamie', paidDays: 1, grossPay: 50 },
    ]);
    assert.equal(result.lines[0].bankAccountNumber, '**** 1234');
    assert.deepEqual(result.totals, [
      { currency: 'INR', total: 100 },
      { currency: 'USD', total: 50 },
    ]);
  } finally {
    Employee.find = originalFindEmployees;
    Attendance.find = originalFindAttendance;
  }
});

test('admin payroll includes employees and attendance from all organizations without a selected organization', async () => {
  const originalFindEmployees = Employee.find;
  const originalFindAttendance = Attendance.find;
  const originalFindUsers = User.find;
  const organizationIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439014'];
  const employees = [
    { _id: '507f1f77bcf86cd799439012', organizationId: organizationIds[0], name: 'Alex', email: 'alex@example.com', dailySalary: 100, currency: 'USD', bankName: 'North Bank', bankBranch: 'Central', bankAccountHolder: 'Alex', bankAccountNumber: '12345678901234', bankRoutingCode: 'NORTH001' },
    { _id: '507f1f77bcf86cd799439013', organizationId: organizationIds[1], name: 'Jamie', email: 'jamie@example.com', dailySalary: 80, currency: 'USD' },
  ];
  const attendance = [
    { employeeId: employees[0]._id, organizationId: organizationIds[0], status: 'present' },
    { employeeId: employees[1]._id, organizationId: organizationIds[1], status: 'present' },
    { employeeId: employees[1]._id, organizationId: organizationIds[1], status: 'absent' },
  ];

  Attendance.find = (filter) => {
    assert.deepEqual(filter, { date: { $gte: '2026-10-01', $lte: '2026-10-31' } });
    return { lean: async () => attendance };
  };
  Employee.find = (filter) => {
    assert.deepEqual(filter, {
      $or: [
        { organizationId: { $ne: null } },
        { _id: { $in: employees.map(({ _id }) => _id) } },
      ],
    });
    return { lean: async () => employees };
  };
  User.find = (filter) => {
    assert.deepEqual(filter, { role: 'organization' });
    return {
      select: (fields) => {
        assert.equal(fields, '_id organizationName phone address website');
        return {
          lean: async () => [
            { _id: organizationIds[0], organizationName: 'North Office', address: '1 North Road', phone: '+1 555 111 2222', website: 'https://north.example' },
            { _id: organizationIds[1], organizationName: 'South Office', address: '2 South Road', phone: '+1 555 333 4444', website: 'https://south.example' },
          ],
        };
      },
    };
  };

  try {
    const result = await calculatePayroll(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      { fromDate: '2026-10-01', toDate: '2026-10-31' },
    );

    assert.deepEqual(result.lines.map(({ employeeName, organizationName, organizationAddress, organizationPhone, organizationWebsite, bankName, bankBranch, bankAccountHolder, bankAccountNumber, bankRoutingCode, paidDays, grossPay }) => ({
      employeeName,
      organizationName,
      organizationAddress,
      organizationPhone,
      organizationWebsite,
      bankName,
      bankBranch,
      bankAccountHolder,
      bankAccountNumber,
      bankRoutingCode,
      paidDays,
      grossPay,
    })), [
      { employeeName: 'Alex', organizationName: 'North Office', organizationAddress: '1 North Road', organizationPhone: '+1 555 111 2222', organizationWebsite: 'https://north.example', bankName: 'North Bank', bankBranch: 'Central', bankAccountHolder: 'Alex', bankAccountNumber: '12345678901234', bankRoutingCode: 'NORTH001', paidDays: 1, grossPay: 100 },
      { employeeName: 'Jamie', organizationName: 'South Office', organizationAddress: '2 South Road', organizationPhone: '+1 555 333 4444', organizationWebsite: 'https://south.example', bankName: '', bankBranch: '', bankAccountHolder: '', bankAccountNumber: '', bankRoutingCode: '', paidDays: 1, grossPay: 80 },
    ]);
    assert.deepEqual(result.totals, [{ currency: 'USD', total: 180 }]);
  } finally {
    Employee.find = originalFindEmployees;
    Attendance.find = originalFindAttendance;
    User.find = originalFindUsers;
  }
});

test('attendance marking updates the employee/date record and returns the saved status', async () => {
  const originalFindEmployee = Employee.findOne;
  const originalFindAttendance = Attendance.findOneAndUpdate;
  const employeeId = '507f1f77bcf86cd799439012';
  const organizationId = '507f1f77bcf86cd799439011';
  const userId = organizationId;
  const today = new Date().toISOString().slice(0, 10);
  let updateFilter;
  let updateFields;
  let updateCalls = 0;

  Employee.findOne = async (filter) => {
    assert.deepEqual(filter, { _id: employeeId, organizationId, status: 'active' });
    return { _id: employeeId };
  };
  Attendance.findOneAndUpdate = async (filter, update) => {
    updateCalls += 1;
    if (updateCalls === 1) {
      const error = new Error('Duplicate attendance insert race.');
      error.code = 11000;
      throw error;
    }
    updateFilter = filter;
    updateFields = update.$set;
    return {
      employeeId,
      date: today,
      status: update.$set.status,
      updatedAt: new Date('2026-10-17T12:00:00.000Z'),
    };
  };

  try {
    const result = await markAttendance(
      { id: userId, role: 'organization' },
      { employeeId, date: today, status: 'present' },
    );

    assert.deepEqual(updateFilter, { employeeId, date: today });
    assert.deepEqual(updateFields, { organizationId, status: 'present', markedBy: userId });
    assert.equal(result.status, 'present');
    assert.equal(updateCalls, 2);
  } finally {
    Employee.findOne = originalFindEmployee;
    Attendance.findOneAndUpdate = originalFindAttendance;
  }
});

test('admins can correct attendance for an inactive employee', async () => {
  const originalOrganizationFind = User.findOne;
  const originalEmployeeFind = Employee.findOne;
  const originalAttendanceUpdate = Attendance.findOneAndUpdate;
  const organizationId = '507f1f77bcf86cd799439011';
  const employeeId = '507f1f77bcf86cd799439012';
  const adminId = '507f1f77bcf86cd799439013';
  const today = new Date().toISOString().slice(0, 10);
  let employeeFilter;

  User.findOne = async () => ({ id: organizationId });
  Employee.findOne = async (filter) => {
    employeeFilter = filter;
    return { _id: employeeId, status: 'disabled' };
  };
  Attendance.findOneAndUpdate = async (filter, update) => ({
    employeeId,
    date: today,
    status: update.$set.status,
    updatedAt: new Date(),
  });

  try {
    const result = await markAttendance(
      { id: adminId, role: 'admin' },
      { organizationId, employeeId, date: today, status: 'absent' },
    );

    assert.deepEqual(employeeFilter, { _id: employeeId, organizationId });
    assert.equal(result.status, 'absent');
  } finally {
    User.findOne = originalOrganizationFind;
    Employee.findOne = originalEmployeeFind;
    Attendance.findOneAndUpdate = originalAttendanceUpdate;
  }
});

test('requireRole rejects an organization from admin-only routes', () => {
  let forwardedError;
  let continued = false;

  requireRole('admin')(
    { user: { role: 'organization' } },
    {},
    (error) => { forwardedError = error; },
  );

  assert.equal(forwardedError.statusCode, 403);
  assert.equal(continued, false);
});

test('location routes require authentication', async (t) => {
  process.env.NODE_ENV = 'test';
  const server = createApp().listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const url = `http://127.0.0.1:${server.address().port}/api/organizations/507f1f77bcf86cd799439011/locations`;
  const listResponse = await fetch(url);
  const createResponse = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Main office' }),
  });
  const updateResponse = await fetch(`${url}/507f1f77bcf86cd799439012`, { method: 'PATCH' });
  const deleteResponse = await fetch(`${url}/507f1f77bcf86cd799439012`, { method: 'DELETE' });
  assert.equal(listResponse.status, 401);
  assert.equal(createResponse.status, 401);
  assert.equal(updateResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
});

test('location input requires a work name, location, designation, and valid status', () => {
  assert.throws(
    () => validateLocationInput({ workName: 'Kitchen', name: '  ', designation: 'cook' }),
    (error) => error.statusCode === 400 && error.message === 'Location is required.',
  );
  assert.throws(
    () => validateLocationInput({ workName: 'Kitchen', name: 'Main office', designation: 'cook', status: 'pending' }),
    (error) => error.statusCode === 400 && error.message === 'Status must be active or disabled.',
  );
  assert.throws(
    () => validateLocationInput({ workName: 'Kitchen', name: 'Main office', designation: '  ' }),
    (error) => error.statusCode === 400 && error.message === 'Select a valid designation.',
  );
});

test('location creation rejects a designation missing from master data', async () => {
  const originalUserFindOne = User.findOne;
  const originalMasterFindOne = MasterData.findOne;
  User.findOne = async () => ({ id: '507f1f77bcf86cd799439011' });
  MasterData.findOne = (filter) => {
    assert.deepEqual(filter, { type: 'designation', code: 'electrician' });
    return { lean: async () => null };
  };

  try {
    await assert.rejects(
      createLocation(
        { id: '507f1f77bcf86cd799439099', role: 'admin' },
        '507f1f77bcf86cd799439011',
        { workName: 'Kitchen', name: 'Main office', designation: 'Electrician' },
      ),
      (error) => error.statusCode === 400 && error.message === 'Select a valid designation.',
    );
  } finally {
    User.findOne = originalUserFindOne;
    MasterData.findOne = originalMasterFindOne;
  }
});

test('master data can only be changed by administrators', async () => {
  const organization = { id: '507f1f77bcf86cd799439011', role: 'organization' };
  await assert.rejects(
    createMasterData(organization, { type: 'designation', name: 'Driver' }),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    updateMasterData(organization, '507f1f77bcf86cd799439012', { name: 'Driver' }),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    deleteMasterData(organization, '507f1f77bcf86cd799439012'),
    (error) => error.statusCode === 403,
  );
});

test('master data creation validates type and name and derives the stored code', async () => {
  const admin = { id: '507f1f77bcf86cd799439099', role: 'admin' };
  const originalExists = MasterData.exists;
  const originalCreate = MasterData.create;
  let created;
  MasterData.exists = async () => null;
  MasterData.create = async (input) => {
    created = input;
    return { ...input, _id: '507f1f77bcf86cd799439013' };
  };

  try {
    await assert.rejects(
      createMasterData(admin, { type: 'department', name: 'Driver' }),
      (error) => error.statusCode === 400 && error.message === 'Select a valid master data type.',
    );
    await assert.rejects(
      createMasterData(admin, { type: 'designation', name: '   ' }),
      (error) => error.statusCode === 400 && error.message === 'Name is required.',
    );
    await createMasterData(admin, { type: 'employmentType', name: '  Daily   Wage ' });
    assert.deepEqual(created, { type: 'employmentType', name: 'Daily Wage', code: 'daily-wage', status: 'active' });
    const item = await createMasterData(admin, { type: 'designation', name: 'Head Cook' });
    assert.deepEqual(created, { type: 'designation', name: 'Head Cook', code: 'head cook', status: 'active' });
    assert.equal(item.usageCount, 0);
  } finally {
    MasterData.exists = originalExists;
    MasterData.create = originalCreate;
  }
});

test('master data in use cannot be deleted', async () => {
  const originalFindById = MasterData.findById;
  const originalCount = Employee.countDocuments;
  MasterData.findById = async () => ({ _id: '507f1f77bcf86cd799439013', type: 'skillCategory', name: 'Skilled', code: 'skilled' });
  Employee.countDocuments = async () => 3;

  try {
    await assert.rejects(
      deleteMasterData({ id: '507f1f77bcf86cd799439099', role: 'admin' }, '507f1f77bcf86cd799439013'),
      (error) => error.statusCode === 409 && error.message.includes('used by 3 records'),
    );
  } finally {
    MasterData.findById = originalFindById;
    Employee.countDocuments = originalCount;
  }
});

test('document settings fall back to separate defaults until saved', async () => {
  const originalFindOne = DocumentSettings.findOne;
  const keys = [];
  DocumentSettings.findOne = (filter) => {
    keys.push(filter.key);
    return { lean: async () => null };
  };

  try {
    const slip = await getDocumentSettings('salary-slip');
    const letter = await getDocumentSettings('appointment-letter');
    assert.deepEqual(keys, ['salarySlip', 'appointmentLetter']);
    assert.equal(slip.companyName, DOCUMENT_FIELDS.salarySlip.companyName.default);
    assert.equal(slip.signatoryLabel, 'Propritior/Manager:');
    assert.equal(letter.companyName, DOCUMENT_FIELDS.appointmentLetter.companyName.default);
    assert.equal(letter.email, 'shreejicaretaker2007@gmail.com');
    assert.equal(letter.terms.split('\n').length, 3);
    assert.equal('phone' in slip, false);
    await assert.rejects(getDocumentSettings('invoice'), (error) => error.statusCode === 404);
  } finally {
    DocumentSettings.findOne = originalFindOne;
  }
});

test('document settings can only be updated by administrators and are validated per document', async () => {
  const originalUpdate = DocumentSettings.findOneAndUpdate;
  const originalFindOne = DocumentSettings.findOne;
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let filter;
  let update;
  DocumentSettings.findOneAndUpdate = (query, change) => {
    filter = query;
    update = change;
    return { lean: async () => ({ key: query.key, values: change.$set.values, updatedAt: new Date('2026-10-22T00:00:00Z') }) };
  };

  try {
    await assert.rejects(
      updateDocumentSettings({ id: '507f1f77bcf86cd799439011', role: 'organization' }, 'salary-slip', { companyName: 'Other Co' }),
      (error) => error.statusCode === 403,
    );
    await assert.rejects(
      updateDocumentSettings({ id: '507f1f77bcf86cd799439099', role: 'admin' }, 'salary-slip', { companyName: '  ', title: 'Salary Slip' }),
      (error) => error.statusCode === 400 && error.message === 'Company name is required.',
    );
    await assert.rejects(
      updateDocumentSettings({ id: '507f1f77bcf86cd799439099', role: 'admin' }, 'appointment-letter', {
        companyName: 'Shreeji', title: 'Letter', shortName: 'Shreeji', email: 'not-an-email',
      }),
      (error) => error.statusCode === 400 && error.message === 'Enter a valid company email.',
    );

    const slip = await updateDocumentSettings(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      'salary-slip',
      { companyName: '  Shreeji Services  ', address: ' Kankroli ', title: 'Pay Slip', signatoryLabel: 'Manager:', phone: '123' },
    );
    assert.deepEqual(filter, { key: 'salarySlip' });
    assert.deepEqual(update, { $set: { values: { companyName: 'Shreeji Services', address: 'Kankroli', title: 'Pay Slip', signatoryLabel: 'Manager:' } } });
    assert.equal(slip.title, 'Pay Slip');

    const letter = await updateDocumentSettings(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      'appointment-letter',
      { companyName: 'Shreeji', title: 'APPOINTMENT LETTER', shortName: 'Shreeji Co', email: ' Office@Shreeji.in ', terms: 'One\r\nTwo' },
    );
    assert.deepEqual(filter, { key: 'appointmentLetter' });
    assert.equal(letter.email, 'office@shreeji.in');
    assert.equal(letter.terms, 'One\nTwo');
    assert.equal(letter.workingHours, '');

    process.env.CLOUDINARY_CLOUD_NAME = 'shreeji-demo';
    DocumentSettings.findOne = () => ({ lean: async () => null });
    const register = { title: 'Register of wages', contractorName: 'Shreeji', bonusRate: '8.33', epfRate: '12', esiRate: '0.75' };
    for (const signatureImage of [
      'data:image/png;base64,iVBORw0KGgo=',
      'https://example.com/sign.png',
      'https://res.cloudinary.com/other-account/image/upload/v1/shreeji-workflow/signatures/abc.png',
    ]) {
      await assert.rejects(
        updateDocumentSettings({ id: '507f1f77bcf86cd799439099', role: 'admin' }, 'wage-register', { ...register, signatureImage }),
        (error) => error.statusCode === 400 && error.message === 'Signature image must be uploaded through the signature upload.',
      );
    }
    const signatureUrl = 'https://res.cloudinary.com/shreeji-demo/image/upload/v1761200000/shreeji-workflow/signatures/sign_ab12.png';
    const saved = await updateDocumentSettings(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      'wage-register',
      { ...register, signatoryCompany: ' FOR:-SHREEJI CARETAKER COMPANY ', signatoryTitle: 'Proprietor / Manager', signatureImage: signatureUrl },
    );
    assert.equal(saved.signatoryCompany, 'FOR:-SHREEJI CARETAKER COMPANY');
    assert.equal(saved.signatureImage, signatureUrl);
  } finally {
    DocumentSettings.findOneAndUpdate = originalUpdate;
    DocumentSettings.findOne = originalFindOne;
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
  }
});

test('wage register reproduces the FORM XVII paper figures', async () => {
  const originals = {
    locationFindOne: Location.findOne,
    employeeFind: Employee.find,
    attendanceFind: Attendance.find,
    userFindOne: User.findOne,
    settingsFindOne: DocumentSettings.findOne,
  };
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439099';
  const paper = [
    ['A Pralad Chettri', 'Skilled', 26, 781, 20045],
    ['B Gobinda Chettri', 'Semi-Skilled', 25, 650, 15682],
    ['C Ram Bahadur Chettri', 'Un-skilled', 24, 556, 12754],
    ['D Mani Kumar Chettri', 'Un-skilled', 26, 556, 13817],
    ['E Om Kumari Rai', 'Un-skilled', 26, 556, 13817],
    ['F Ram Bahadur', 'Un-skilled', 26, 556, 13817],
    ['G Aita Rai Subba', 'Un-skilled', 25, 556, 13286],
    ['H Anil Chettri', 'Un-skilled', 26, 556, 13817],
  ];
  const employees = paper.map(([name, skillCategory, , dailySalary], index) => ({
    _id: `507f1f77bcf86cd7994390${String(index + 10)}`,
    name,
    email: `e${index}@example.com`,
    skillCategory,
    dailySalary,
    currency: 'INR',
    epfoApplicable: true,
    esicApplicable: true,
  }));
  const attendance = employees.flatMap((employee, index) => (
    Array.from({ length: paper[index][2] }, () => ({ employeeId: employee._id, status: 'present' }))
  ));
  const location = { _id: locationId, organizationId, workName: 'AMC CONTRACT FOR HORTICULTURE WORK', address: '400/220 KV, RANGPO S/S', designation: 'mali' };

  Location.findOne = () => ({ then: (resolve) => resolve(location), lean: async () => location });
  Employee.find = () => ({ distinct: async () => employees.map(({ _id }) => _id), lean: async () => employees });
  Attendance.find = () => ({ lean: async () => attendance });
  User.findOne = () => ({ select: () => ({ lean: async () => ({ organizationName: 'Powergrid' }) }) });
  DocumentSettings.findOne = () => ({ lean: async () => null });

  try {
    const register = await calculateWageRegister(
      { id: organizationId, role: 'organization' },
      { organizationId, locationId, month: '2026-08' },
    );
    assert.equal(register.periodLabel, 'AUGUST-2026');
    assert.deepEqual(register.rows.map((row) => row.grossPayment), paper.map((row) => row[4]));
    assert.equal(register.rows[0].bonus, 1691.49);
    assert.equal(register.rows[0].totalWages, 21997.49);
    assert.equal(register.rows[0].epf, 1800);
    assert.equal(register.rows[0].esi, 152);
    assert.deepEqual(register.totals, {
      employees: 8,
      workingDays: 204,
      wages: 121624,
      bonus: 10131,
      totalWages: 131755,
      epf: 13808,
      esi: 912,
      grossPayment: 117035,
    });

    const paged = await calculateWageRegister(
      { id: organizationId, role: 'organization' },
      { organizationId, locationId, month: '2026-08', page: '2', limit: '5' },
    );
    assert.deepEqual(paged.rows.map((row) => row.serial), [6, 7, 8]);
    assert.equal(paged.totals.grossPayment, 117035);
  } finally {
    Location.findOne = originals.locationFindOne;
    Employee.find = originals.employeeFind;
    Attendance.find = originals.attendanceFind;
    User.findOne = originals.userFindOne;
    DocumentSettings.findOne = originals.settingsFindOne;
  }
});

test('bank payments list wage register employees with their column N amount and bank details', async () => {
  const originals = {
    employeeFind: Employee.find,
    attendanceFind: Attendance.find,
    userFind: User.find,
    userFindOne: User.findOne,
    locationFind: Location.find,
    locationFindOne: Location.findOne,
    settingsFindOne: DocumentSettings.findOne,
  };
  const organizationId = '507f1f77bcf86cd799439011';
  const location = { _id: '507f1f77bcf86cd799439099', organizationId, workName: 'AMC Horticulture Work', designation: 'mali' };
  const employees = [
    { _id: '507f1f77bcf86cd799439021', organizationId, name: 'Nehpal Singh', email: 'n@example.com', dailySalary: 781, epfoApplicable: true, esicApplicable: true, bankName: 'UCO BANK', bankAccountNumber: '03770110094938', bankRoutingCode: 'UCBA0000377' },
    { _id: '507f1f77bcf86cd799439022', organizationId, name: 'Pawan Kumar', email: 'p@example.com', dailySalary: 650, bankName: '', bankAccountNumber: '', bankRoutingCode: '' },
    { _id: '507f1f77bcf86cd799439023', organizationId, name: 'Zero Days', email: 'z@example.com', dailySalary: 500, bankName: 'SBI', bankAccountNumber: '1', bankRoutingCode: 'SBIN0000001' },
  ];
  const attendance = [
    ...Array.from({ length: 26 }, () => ({ employeeId: employees[0]._id, organizationId, status: 'present' })),
    ...Array.from({ length: 10 }, () => ({ employeeId: employees[1]._id, organizationId, status: 'present' })),
  ];
  Employee.find = () => ({ distinct: async () => employees.map(({ _id }) => _id), lean: async () => employees });
  Attendance.find = () => ({ lean: async () => attendance });
  User.find = () => ({ select: () => ({ lean: async () => [{ _id: organizationId, organizationName: 'Powergrid' }] }) });
  User.findOne = async () => ({ id: organizationId });
  Location.find = () => ({ lean: async () => [location] });
  Location.findOne = async () => location;
  DocumentSettings.findOne = () => ({ lean: async () => null });

  try {
    await assert.rejects(
      calculateBankPayments({ id: organizationId, role: 'organization' }, { month: '2026-09' }),
      (error) => error.statusCode === 403,
    );
    await assert.rejects(calculateBankPayments({ id: 'admin', role: 'admin' }, { month: '2026-13' }), (error) => error.statusCode === 400);

    const result = await calculateBankPayments({ id: 'admin', role: 'admin' }, { month: '2026-09' });
    assert.equal(result.referencePrefix, 'SCC/PNB-NEFT/ SEP-2026/');
    assert.equal(result.letter.accountNumber, '409100C100000077');
    assert.deepEqual(result.rows.map((row) => [row.employeeName, row.amount, row.missingBankDetails]), [
      ['Nehpal Singh', 20045, false],
      ['Pawan Kumar', 7041, true],
    ]);
    assert.equal(result.rows[0].accountNumber, '03770110094938');
    assert.equal(result.rows[0].ifsc, 'UCBA0000377');
    assert.equal(result.rows[0].locationName, 'AMC Horticulture Work');
    assert.equal(result.rows[0].organizationName, 'Powergrid');
    assert.deepEqual(result.summary, { employees: 2, total: 27086, missingBankDetails: 1, banks: 1 });

    const searched = await calculateBankPayments({ id: 'admin', role: 'admin' }, { month: '2026-09', search: 'ucba', page: '1', limit: '10' });
    assert.deepEqual(searched.rows.map((row) => row.employeeName), ['Nehpal Singh']);
    assert.deepEqual(searched.pagination, { page: 1, limit: 10, total: 1, totalPages: 1 });
  } finally {
    Employee.find = originals.employeeFind;
    Attendance.find = originals.attendanceFind;
    User.find = originals.userFind;
    User.findOne = originals.userFindOne;
    Location.find = originals.locationFind;
    Location.findOne = originals.locationFindOne;
    DocumentSettings.findOne = originals.settingsFindOne;
  }
});

test('location lists filter, paginate and summarize on the server', async () => {
  const originalCount = Location.countDocuments;
  const originalDistinct = Location.distinct;
  const originalFind = Location.find;
  const organizationId = '507f1f77bcf86cd799439011';
  let listFilter;
  let skipped;
  let limited;
  Location.countDocuments = async (filter) => (filter.$or ? 12 : filter.status === 'active' ? 7 : 20);
  Location.distinct = async () => ['plumber', '', 'cook'];
  Location.find = (filter) => {
    listFilter = filter;
    return {
      sort: () => ({
        skip: (value) => {
          skipped = value;
          return {
            limit: async (value) => {
              limited = value;
              return [{ _id: '507f1f77bcf86cd799439031', organizationId, workName: 'Site', name: 'Site', status: 'active', designation: 'cook' }];
            },
          };
        },
      }),
    };
  };

  try {
    const result = await listLocations(
      { id: organizationId, role: 'organization' },
      organizationId,
      { search: 'si', status: 'active', designation: 'Cook', page: '2', limit: '5' },
    );
    assert.equal(listFilter.status, 'active');
    assert.equal(listFilter.designation, 'cook');
    assert.equal(listFilter.$or.length, 5);
    assert.equal(skipped, 5);
    assert.equal(limited, 5);
    assert.deepEqual(result.pagination, { page: 2, limit: 5, total: 12, totalPages: 3 });
    assert.deepEqual(result.summary, { total: 20, active: 7, inactive: 13 });
    assert.deepEqual(result.designations, ['cook', 'plumber']);
    assert.equal(result.locations[0].workName, 'Site');
  } finally {
    Location.countDocuments = originalCount;
    Location.distinct = originalDistinct;
    Location.find = originalFind;
  }
});

test('organization users cannot list locations for another organization', async () => {
  await assert.rejects(
    listLocations(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      '507f1f77bcf86cd799439012',
    ),
    (error) => error.statusCode === 403,
  );
});

test('employee lists reject malformed location filters', async () => {
  await assert.rejects(
    listEmployees(
      { id: '507f1f77bcf86cd799439011', role: 'organization' },
      { locationId: 'invalid-id' },
    ),
    (error) => error.statusCode === 400 && error.message === 'Invalid location id.',
  );
});

test('attendance and payroll reject malformed location filters', async () => {
  const organization = { id: '507f1f77bcf86cd799439011', role: 'organization' };
  await assert.rejects(
    listAttendance(organization, { locationId: 'invalid-id' }),
    (error) => error.statusCode === 400 && error.message === 'Invalid location id.',
  );
  await assert.rejects(
    calculatePayroll(organization, {
      locationId: 'invalid-id',
      fromDate: '2026-10-01',
      toDate: '2026-10-20',
    }),
    (error) => error.statusCode === 400 && error.message === 'Invalid location id.',
  );
});

test('admins create a location only for an existing organization', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = Location.create;
  const organizationId = '507f1f77bcf86cd799439011';
  let createdInput;
  User.findOne = async (filter) => {
    assert.deepEqual(filter, { _id: organizationId, role: 'organization' });
    return { id: organizationId };
  };
  Location.create = async (input) => {
    createdInput = input;
    return {
      ...input,
      _id: '507f1f77bcf86cd799439012',
      toObject() { return this; },
    };
  };
  const originalMasterFindOne = MasterData.findOne;
  MasterData.findOne = () => ({ lean: async () => ({ type: 'designation', name: 'Cook', code: 'cook' }) });

  try {
    const location = await createLocation(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      organizationId,
      {
        workName: '  Kitchen work ',
        opNumber: ' OP-42 ',
        name: '  Main office ',
        address: '  1 Main Street  ',
        designation: 'cook',
      },
    );
    assert.deepEqual(createdInput, {
      workName: 'Kitchen work',
      opNumber: 'OP-42',
      name: 'Main office',
      loaReference: '',
      address: '1 Main Street',
      designation: 'cook',
      status: 'active',
      organizationId,
    });
    assert.equal(location.id, '507f1f77bcf86cd799439012');
    assert.equal(location.organizationId, organizationId);
  } finally {
    User.findOne = originalFindOne;
    Location.create = originalCreate;
    MasterData.findOne = originalMasterFindOne;
  }
});

test('admins can update location details within the owning organization', async () => {
  const originalFindOne = User.findOne;
  const originalLocationFindOne = Location.findOne;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const location = {
    _id: locationId,
    organizationId,
    workName: 'Old work',
    opNumber: '',
    name: 'Old site',
    address: '',
    designation: 'cook',
    status: 'active',
    async save() {},
    toObject() { return this; },
  };
  User.findOne = async () => ({ id: organizationId });
  Location.findOne = async (filter) => {
    assert.deepEqual(filter, { _id: locationId, organizationId });
    return location;
  };
  const originalMasterFindOne = MasterData.findOne;
  MasterData.findOne = () => ({ lean: async () => ({ type: 'designation', name: 'Plumber', code: 'plumber' }) });

  try {
    const updated = await updateLocation(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      organizationId,
      locationId,
      { workName: 'New work', opNumber: 'OP-9', name: 'New site', address: '1 Main Street', designation: 'plumber' },
    );
    assert.equal(updated.workName, 'New work');
    assert.equal(updated.opNumber, 'OP-9');
    assert.equal(updated.name, 'New site');
    assert.equal(updated.designation, 'plumber');
  } finally {
    User.findOne = originalFindOne;
    Location.findOne = originalLocationFindOne;
    MasterData.findOne = originalMasterFindOne;
  }
});

test('deleting a location clears employee placement but keeps employee records', async () => {
  const originalFindOne = User.findOne;
  const originalLocationFindOne = Location.findOne;
  const originalEmployeeUpdateMany = Employee.updateMany;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  let employeeUpdate;
  let locationDeleted = false;
  const location = {
    _id: locationId,
    organizationId,
    workName: 'Kitchen work',
    opNumber: '',
    name: 'Main site',
    address: '',
    designation: 'cook',
    status: 'active',
    async deleteOne() { locationDeleted = true; },
    toObject() { return this; },
  };
  User.findOne = async () => ({ id: organizationId });
  Location.findOne = async () => location;
  Employee.updateMany = async (filter, update) => {
    employeeUpdate = { filter, update };
  };

  try {
    await deleteLocation({ id: '507f1f77bcf86cd799439099', role: 'admin' }, organizationId, locationId);
    assert.deepEqual(employeeUpdate, {
      filter: { organizationId, locationId },
      update: { $set: { locationId: null, locationAssignedAt: null } },
    });
    assert.equal(locationDeleted, true);
  } finally {
    User.findOne = originalFindOne;
    Location.findOne = originalLocationFindOne;
    Employee.updateMany = originalEmployeeUpdateMany;
  }
});

test('employee creation rejects a designation that does not match its location', async () => {
  const originalLocationFindOne = Location.findOne;
  const originalLocationFindById = Location.findById;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  Location.findOne = async () => ({ id: locationId });
  Location.findById = () => ({ select: async () => ({ designation: 'cook' }) });

  try {
    await assert.rejects(
      createEmployee(
        { id: organizationId, role: 'organization' },
        {
          name: 'Employee',
          email: 'employee@example.com',
          designation: 'Plumber',
          locationId,
        },
      ),
      (error) => error.statusCode === 400 && error.message === 'Employee designation must match this location (cook).',
    );
  } finally {
    Location.findOne = originalLocationFindOne;
    Location.findById = originalLocationFindById;
  }
});

test('employees at another location can be moved to a matching new location', async () => {
  const originalUserFindOne = User.findOne;
  const originalLocationFindOne = Location.findOne;
  const originalLocationFindById = Location.findById;
  const originalEmployeeFind = Employee.find;
  const originalEmployeeUpdateMany = Employee.updateMany;
  const organizationId = '507f1f77bcf86cd799439011';
  const newLocationId = '507f1f77bcf86cd799439012';
  const oldLocationId = '507f1f77bcf86cd799439013';
  const employeeId = '507f1f77bcf86cd799439014';
  const employee = {
    _id: employeeId,
    organizationId,
    locationId: oldLocationId,
    designation: 'Cook',
    name: 'Employee',
    email: 'employee@example.com',
    status: 'active',
  };
  let assignmentFilter;
  let assignmentUpdate;
  User.findOne = async () => ({ id: organizationId });
  Location.findOne = async () => ({ id: newLocationId });
  Location.findById = () => ({ select: async () => ({ designation: 'cook' }) });
  Employee.find = (filter) => {
    if (filter.status === 'active') {
      assignmentFilter = filter;
      return Promise.resolve([employee]);
    }
    return { populate: async () => [{ ...employee, locationId: newLocationId }] };
  };
  Employee.updateMany = async (filter, update) => {
    assignmentUpdate = { filter, update };
  };

  try {
    const assigned = await assignEmployees(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      { organizationId, locationId: newLocationId, employeeIds: [employeeId] },
    );
    assert.equal(assignmentFilter.locationId.$ne, newLocationId);
    assert.equal(assignmentFilter.designation.test(employee.designation), true);
    assert.deepEqual(assignmentFilter.$or[2], { organizationId });
    assert.deepEqual(assignmentUpdate.filter, assignmentFilter);
    assert.equal(assignmentUpdate.update.$set.organizationId, organizationId);
    assert.equal(assignmentUpdate.update.$set.locationId, newLocationId);
    assert.ok(assignmentUpdate.update.$set.locationAssignedAt instanceof Date);
    assert.equal(assigned[0].locationId, newLocationId);
  } finally {
    User.findOne = originalUserFindOne;
    Location.findOne = originalLocationFindOne;
    Location.findById = originalLocationFindById;
    Employee.find = originalEmployeeFind;
    Employee.updateMany = originalEmployeeUpdateMany;
  }
});

function excelAttendanceFile(rows) {
  const XLSX = require('xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Attendance');
  return {
    originalname: 'attendance.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  };
}

test('organization users cannot parse or bulk upload attendance', async () => {
  const organization = { id: '507f1f77bcf86cd799439011', role: 'organization' };
  await assert.rejects(
    parseAttendanceSheet(organization, { date: '2026-10-20' }),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    bulkMarkAttendance(organization, { date: '2026-10-20', entries: [] }),
    (error) => error.statusCode === 403,
  );
});

test('attendance sheet matching uses father name when employee names are the same', () => {
  const employees = [
    { _id: '507f1f77bcf86cd799439021', name: 'Ram Bahadur Chettri', parentName: 'Nar Bahadur' },
    { _id: '507f1f77bcf86cd799439022', name: 'Ram Bahadur Chettri', parentName: 'Tek Bahadur' },
  ];
  const matched = matchExtractedEmployee(
    { name: 'RAM BAHADUR CHETTRI', parentName: 'NAR BAHADUR' },
    employees,
  );
  assert.equal(matched.match, 'exact');
  assert.equal(String(matched.employee._id), '507f1f77bcf86cd799439021');

  const ambiguous = matchExtractedEmployee(
    { name: 'RAM BAHADUR CHETTRI', parentName: '' },
    employees,
  );
  assert.equal(ambiguous.match, 'ambiguous');
  assert.equal(ambiguous.employee, null);
});

test('attendance sheet parser reads the selected day column', () => {
  const rows = parseSheetMatrix([
    ['S.no', 'Name of Employees', 'category', 1, 20, 21],
    [1, 'Prakash Chettri', 'Skilled', '', 'P', ''],
    [2, 'Unknown Worker', 'Un-skilled', '', 'A', ''],
    [3, 'Total', '', '', '', ''],
  ], '2026-10-20');
  assert.deepEqual(rows, [
    { extractedName: 'PRAKASH CHETTRI', extractedParentName: '', status: 'present' },
    { extractedName: 'UNKNOWN WORKER', extractedParentName: '', status: 'absent' },
  ]);
});

test('attendance sheet period is detected from the register heading', () => {
  assert.equal(detectSheetPeriod('Register of Attendance\nPeriod: October 2026').label, 'October 2026');
  assert.equal(detectSheetPeriod('Month: 09/2026').label, 'September 2026');
  assert.equal(detectSheetPeriod('For the month of Sept, 2026').label, 'September 2026');
  assert.equal(detectSheetPeriod('Name of Employees'), null);
});

test('admins parse attendance sheets against location employees', async () => {
  const originalUserFind = User.findOne;
  const originalLocationFind = Location.findOne;
  const originalEmployeeFind = Employee.find;
  const originalAttendanceFind = Attendance.find;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const employees = [
    { _id: '507f1f77bcf86cd799439021', name: 'Prakash Chettri', parentName: '' },
    { _id: '507f1f77bcf86cd799439022', name: 'Ram Bahadur Chettri', parentName: 'Nar Bahadur' },
  ];

  User.findOne = async () => ({ id: organizationId });
  Location.findOne = async () => ({ _id: locationId, organizationId, designation: 'cook' });
  Employee.find = (filter) => {
    if (filter.locationId) return { distinct: async () => employees.map(({ _id }) => _id) };
    return { sort: () => ({ lean: async () => employees }) };
  };
  Attendance.find = () => ({ lean: async () => [{ employeeId: '507f1f77bcf86cd799439021', status: 'present' }] });

  try {
    const result = await parseAttendanceSheet(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      {
        organizationId,
        locationId,
        date: '2026-10-20',
        file: excelAttendanceFile([
          ['Period: September 2026'],
          ['S.no', 'Name of Employees', 'category', 20],
          [1, 'Prakash Chettri', 'Skilled', 'P'],
          [2, 'Ram Bahadur Chettri S/O: Nar Bahadur', 'Un-skilled', 'A'],
          [3, 'Missing Person', 'Un-skilled', 'P'],
        ]),
      },
    );
    assert.equal(result.rows[0].match, 'exact');
    assert.equal(result.rows[0].alreadyMarked, true);
    assert.equal(result.rows[1].employeeId, '507f1f77bcf86cd799439022');
    assert.equal(result.rows[1].status, 'absent');
    assert.equal(result.rows[2].match, 'unmatched');
    assert.equal(result.dayColumn, 20);
    assert.equal(result.selectedPeriod.label, 'October 2026');
    assert.equal(result.sheetPeriod.label, 'September 2026');
    assert.match(result.warning, /September 2026.*October 2026/);
  } finally {
    User.findOne = originalUserFind;
    Location.findOne = originalLocationFind;
    Employee.find = originalEmployeeFind;
    Attendance.find = originalAttendanceFind;
  }
});

test('attendance sheet upload rejects missing date and location', async () => {
  const admin = { id: '507f1f77bcf86cd799439099', role: 'admin' };
  const file = excelAttendanceFile([['Name', 'Status'], ['Prakash Chettri', 'P']]);
  await assert.rejects(
    parseAttendanceSheet(admin, {
      organizationId: '507f1f77bcf86cd799439011',
      locationId: '507f1f77bcf86cd799439012',
      file,
    }),
    (error) => error.statusCode === 400 && error.message === 'Enter a valid attendance date.',
  );
  await assert.rejects(
    bulkMarkAttendance(admin, {
      organizationId: '507f1f77bcf86cd799439011',
      date: '2026-10-20',
      entries: [{ employeeId: '507f1f77bcf86cd799439021', status: 'present' }],
    }),
    (error) => error.statusCode === 400 && error.message === 'A valid location id is required.',
  );
});

test('attendance sheet upload rejects unsupported files', async () => {
  await assert.rejects(
    parseAttendanceSheet(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      {
        organizationId: '507f1f77bcf86cd799439011',
        locationId: '507f1f77bcf86cd799439012',
        date: '2026-10-20',
        file: { originalname: 'notes.txt', mimetype: 'text/plain', buffer: Buffer.from('no') },
      },
    ),
    (error) => error.statusCode === 400 && error.message === 'Upload a PDF, Excel, CSV, or image attendance sheet.',
  );
});

test('bulk attendance upload skips existing employee and date records', async () => {
  const originalUserFind = User.findOne;
  const originalLocationFind = Location.findOne;
  const originalEmployeeFind = Employee.find;
  const originalAttendanceFind = Attendance.find;
  const originalInsertMany = Attendance.insertMany;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const presentId = '507f1f77bcf86cd799439021';
  const absentId = '507f1f77bcf86cd799439022';
  let inserted;

  User.findOne = async () => ({ id: organizationId });
  Location.findOne = async () => ({ _id: locationId, organizationId, designation: 'cook' });
  Employee.find = (filter) => {
    if (filter.locationId) return { distinct: async () => [presentId, absentId] };
    return {
      sort: () => ({
        lean: async () => [
          { _id: presentId, name: 'Prakash Chettri', parentName: '' },
          { _id: absentId, name: 'Ram Bahadur Chettri', parentName: 'Nar Bahadur' },
        ],
      }),
    };
  };
  Attendance.find = () => ({
    select() { return this; },
    lean: async () => [{ employeeId: presentId, date: '2026-10-20' }],
  });
  Attendance.insertMany = async (docs) => {
    inserted = docs;
    return docs;
  };

  try {
    const result = await bulkMarkAttendance(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      {
        organizationId,
        locationId,
        date: '2026-10-20',
        entries: [
          { employeeId: presentId, status: 'present' },
          { employeeId: absentId, status: 'absent' },
          { employeeId: '507f1f77bcf86cd799439099', status: 'present' },
        ],
      },
    );
    assert.deepEqual(result, { saved: 1, updated: 0, skippedDuplicates: 1, skippedInvalid: 1 });
    assert.equal(inserted.length, 1);
    assert.equal(String(inserted[0].employeeId), absentId);
    assert.equal(inserted[0].status, 'absent');
  } finally {
    User.findOne = originalUserFind;
    Location.findOne = originalLocationFind;
    Employee.find = originalEmployeeFind;
    Attendance.find = originalAttendanceFind;
    Attendance.insertMany = originalInsertMany;
  }
});

test('monthly sheet parser reads every day column', () => {
  const { rows, dayColumns } = parseSheetMatrixMonth([
    ['Period: October 2026'],
    ['S.no', 'Name of Employees', "Father's name", 'category', 1, 2, 3, 'Total Present'],
    [1, 'Ram Bahadur Chettri', 'Dutt Ram', 'Skilled', 'P', 'A', '', 1],
    [2, 'Total', '', '', '', '', '', ''],
  ], '2026-10', 31);
  assert.deepEqual(dayColumns, [1, 2, 3]);
  assert.deepEqual(rows, [{
    extractedName: 'RAM BAHADUR CHETTRI',
    extractedParentName: 'DUTT RAM',
    days: { 1: 'present', 2: 'absent' },
  }]);
});

test('admins import a whole month and future days are skipped', async () => {
  const originalUserFind = User.findOne;
  const originalLocationFind = Location.findOne;
  const originalEmployeeFind = Employee.find;
  const originalAttendanceFind = Attendance.find;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const employeeId = '507f1f77bcf86cd799439021';
  const employees = [{ _id: employeeId, name: 'Prakash Chettri', parentName: '' }];
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = Number(now.toISOString().slice(8, 10));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayHeaders = Array.from({ length: daysInMonth }, (_, index) => index + 1);

  User.findOne = async () => ({ id: organizationId });
  Location.findOne = async () => ({ _id: locationId, organizationId, designation: 'cook' });
  Employee.find = (filter) => {
    if (filter.locationId) return { distinct: async () => [employeeId] };
    return { sort: () => ({ lean: async () => employees }) };
  };
  Attendance.find = () => ({ lean: async () => [{ employeeId, date: `${month}-01`, status: 'absent' }] });

  try {
    const result = await parseAttendanceMonth(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      {
        organizationId,
        locationId,
        month,
        timeZone: 'UTC',
        file: excelAttendanceFile([
          ['S.no', 'Name of Employees', ...dayHeaders],
          [1, 'Prakash Chettri', ...dayHeaders.map(() => 'P')],
        ]),
      },
    );
    assert.equal(result.lastImportableDay, today);
    assert.equal(result.rows[0].marks.length, today);
    assert.ok(result.rows[0].marks.every((mark) => mark === 'present'));
    assert.equal(result.rows[0].existing[0], 'absent');
    assert.equal(result.skippedFutureDays.length, daysInMonth - today);

    await assert.rejects(
      parseAttendanceMonth(
        { id: '507f1f77bcf86cd799439099', role: 'admin' },
        {
          organizationId,
          locationId,
          month,
          timeZone: 'UTC',
          file: excelAttendanceFile([['Name', 'Status'], ['Prakash Chettri', 'P']]),
        },
      ),
      (error) => error.statusCode === 400 && /No day columns/.test(error.message),
    );
    await assert.rejects(
      parseAttendanceMonth(
        { id: '507f1f77bcf86cd799439099', role: 'admin' },
        { organizationId, locationId, month: '2099-12', timeZone: 'UTC', file: excelAttendanceFile([['Name']]) },
      ),
      (error) => error.statusCode === 400 && /future month/.test(error.message),
    );
  } finally {
    User.findOne = originalUserFind;
    Location.findOne = originalLocationFind;
    Employee.find = originalEmployeeFind;
    Attendance.find = originalAttendanceFind;
  }
});

test('bulk attendance accepts a date on each entry', async () => {
  const originalUserFind = User.findOne;
  const originalLocationFind = Location.findOne;
  const originalEmployeeFind = Employee.find;
  const originalAttendanceFind = Attendance.find;
  const originalInsertMany = Attendance.insertMany;
  const originalBulkWrite = Attendance.bulkWrite;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const employeeId = '507f1f77bcf86cd799439021';
  let inserted = [];

  User.findOne = async () => ({ id: organizationId });
  Location.findOne = async () => ({ _id: locationId, organizationId, designation: 'cook' });
  Employee.find = (filter) => {
    if (filter.locationId) return { distinct: async () => [employeeId] };
    return { sort: () => ({ lean: async () => [{ _id: employeeId, name: 'Prakash Chettri' }] }) };
  };
  Attendance.find = () => ({
    select() { return this; },
    lean: async () => [{ employeeId, date: '2026-10-02' }],
  });
  Attendance.insertMany = async (docs) => {
    inserted = docs;
    return docs;
  };

  try {
    const result = await bulkMarkAttendance(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      {
        organizationId,
        locationId,
        entries: [
          { employeeId, status: 'present', date: '2026-10-01' },
          { employeeId, status: 'absent', date: '2026-10-02' },
          { employeeId, status: 'present', date: '2026-10-01' },
          { employeeId, status: 'present', date: 'bad' },
        ],
      },
    );
    assert.deepEqual(result, { saved: 1, updated: 0, skippedDuplicates: 1, skippedInvalid: 2 });
    assert.equal(inserted[0].date, '2026-10-01');

    let writes = [];
    Attendance.bulkWrite = async (operations) => {
      writes = operations;
      return { matchedCount: operations.length };
    };
    const replaced = await bulkMarkAttendance(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      {
        organizationId,
        locationId,
        entries: [{ employeeId, status: 'present', date: '2026-10-02', replace: true }],
      },
    );
    assert.deepEqual(replaced, { saved: 0, updated: 1, skippedDuplicates: 0, skippedInvalid: 0 });
    assert.equal(writes[0].updateOne.filter.date, '2026-10-02');
    assert.equal(writes[0].updateOne.update.$set.status, 'present');
    await assert.rejects(
      bulkMarkAttendance({ id: '507f1f77bcf86cd799439099', role: 'admin' }, {
        organizationId,
        locationId,
        entries: [{ employeeId, status: 'present' }],
      }),
      (error) => error.statusCode === 400 && error.message === 'Enter a valid attendance date.',
    );
  } finally {
    User.findOne = originalUserFind;
    Location.findOne = originalLocationFind;
    Employee.find = originalEmployeeFind;
    Attendance.find = originalAttendanceFind;
    Attendance.insertMany = originalInsertMany;
    Attendance.bulkWrite = originalBulkWrite;
  }
});

function queryResult(doc) {
  return Object.assign(Promise.resolve(doc), { lean: async () => doc });
}

test('attendance register is admin only and requires a month and location', async () => {
  await assert.rejects(
    getAttendanceRegister({ id: '507f1f77bcf86cd799439011', role: 'organization' }, { month: '2026-10' }),
    (error) => error.statusCode === 403,
  );
  const admin = { id: '507f1f77bcf86cd799439099', role: 'admin' };
  await assert.rejects(
    getAttendanceRegister(admin, { month: '2026-13', locationId: '507f1f77bcf86cd799439012' }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    getAttendanceRegister(admin, { month: '2026-10' }),
    (error) => error.statusCode === 400,
  );
});

test('attendance register builds the monthly Form XVI grid', async () => {
  const originalUserFind = User.findOne;
  const originalLocationFind = Location.findOne;
  const originalEmployeeFind = Employee.find;
  const originalAttendanceFind = Attendance.find;
  const organizationId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const ramId = '507f1f77bcf86cd799439021';
  const omId = '507f1f77bcf86cd799439022';
  const disabledId = '507f1f77bcf86cd799439023';
  const employees = [
    { _id: omId, name: 'Om Kumari Rai', parentName: '', skillCategory: 'Un-skilled', status: 'active' },
    { _id: ramId, name: 'Ram Bahadur Chettri', parentName: 'Dutt Ram', skillCategory: 'Skilled', status: 'active' },
    { _id: disabledId, name: 'Zed Former', parentName: '', skillCategory: '', status: 'disabled' },
  ];
  let attendanceFilter;

  User.findOne = () => queryResult({ id: organizationId, _id: organizationId, organizationName: 'Powergrid' });
  Location.findOne = () => queryResult({
    _id: locationId,
    organizationId,
    designation: 'event',
    workName: 'AMC contract for horticulture work',
    name: 'Rangpo S/S',
    address: 'Rangpo',
    opNumber: 'LOA-123',
  });
  Employee.find = (filter) => {
    if (filter.locationId) return { distinct: async () => employees.map(({ _id }) => _id) };
    return { sort: () => ({ lean: async () => employees }) };
  };
  Attendance.find = (filter) => {
    attendanceFilter = filter;
    return {
      lean: async () => [
        { employeeId: ramId, date: '2026-09-01', status: 'present' },
        { employeeId: ramId, date: '2026-09-02', status: 'absent' },
        { employeeId: ramId, date: '2026-09-30', status: 'present' },
        { employeeId: omId, date: '2026-09-15', status: 'present' },
      ],
    };
  };

  try {
    const register = await getAttendanceRegister(
      { id: '507f1f77bcf86cd799439099', role: 'admin' },
      { organizationId, locationId, month: '2026-09' },
    );
    assert.deepEqual(attendanceFilter.date, { $gte: '2026-09-01', $lte: '2026-09-30' });
    assert.equal(register.periodLabel, 'September 2026');
    assert.equal(register.daysInMonth, 30);
    assert.equal(register.organizationName, 'Powergrid');
    assert.equal(register.location.opNumber, 'LOA-123');
    assert.equal(register.rows.length, 2);

    const ram = register.rows.find((row) => row.employeeId === ramId);
    assert.equal(ram.parentName, 'Dutt Ram');
    assert.equal(ram.days.length, 30);
    assert.equal(ram.days[0], 'P');
    assert.equal(ram.days[1], 'A');
    assert.equal(ram.days[2], '');
    assert.equal(ram.days[29], 'P');
    assert.equal(ram.totalPresent, 2);
    assert.equal(register.rows.find((row) => row.employeeId === omId).days[14], 'P');
    assert.equal(register.totalMandays, 3);
    assert.deepEqual(register.rows.map((row) => row.serial), [1, 2]);
  } finally {
    User.findOne = originalUserFind;
    Location.findOne = originalLocationFind;
    Employee.find = originalEmployeeFind;
    Attendance.find = originalAttendanceFind;
  }
});
