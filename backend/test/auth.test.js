const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { createApp } = require('../src/app');
const { requireRole } = require('../src/middleware/auth');
const Attendance = require('../src/models/Attendance');
const Employee = require('../src/models/Employee');
const User = require('../src/models/User');
const {
  assignEmployees,
  createEmployee,
  deleteEmployee,
  unassignEmployees,
  updateEmployee,
} = require('../src/services/employeeService');
const { listAttendance, listAttendanceHistory, markAttendance } = require('../src/services/attendanceService');
const { calculatePayroll } = require('../src/services/payrollService');
const { createOrganization, updateOrganization } = require('../src/services/organizationService');

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
      update: { $set: { organizationId: null } },
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
      update: { $set: { organizationId: null } },
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