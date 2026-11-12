const assert = require('node:assert/strict');
const test = require('node:test');
const Attendance = require('../src/models/Attendance');
const Employee = require('../src/models/Employee');
const Location = require('../src/models/Location');
const User = require('../src/models/User');
const MasterData = require('../src/models/MasterData');
const { bulkMarkAttendance, currentDateInTimeZone, markAttendance, parseAttendanceMonth } = require('../src/services/attendanceService');
const { computeTotals } = require('../src/services/clientInvoiceService');
const { createLocation, updateLocation } = require('../src/services/locationService');
const { listOrganizations } = require('../src/services/organizationService');
const Overtime = require('../src/models/Overtime');
const { setOvertimeHours, wageRegisterRow } = require('../src/services/payrollService');
const { hasJoinedBy } = require('../src/utils/employeeStatus');

const admin = { id: '507f1f77bcf86cd799439099', role: 'admin' };
const organizationId = '507f1f77bcf86cd799439011';
const locationId = '507f1f77bcf86cd799439012';
const employeeId = '507f1f77bcf86cd799439021';

/** Replaces model methods for one test and puts the originals back afterwards. */
function stub(t, model, methods) {
  const originals = Object.fromEntries(Object.keys(methods).map((name) => [name, model[name]]));
  Object.assign(model, methods);
  t.after(() => Object.assign(model, originals));
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** The next day after `date` that is not a Sunday. */
function nextWorkingDay(date) {
  let next = addDays(date, 1);
  if (new Date(`${next}T00:00:00Z`).getUTCDay() === 0) next = addDays(next, 1);
  return next;
}

test('an employee counts as joined from the joining date; no joining date means always joined', () => {
  const employee = { dateOfJoining: '2025-05-12' };
  assert.equal(hasJoinedBy(employee, '2025-05-11'), false);
  assert.equal(hasJoinedBy(employee, '2025-05-12'), true);
  assert.equal(hasJoinedBy(employee, '2026-01-01'), true);
  assert.equal(hasJoinedBy({ dateOfJoining: '' }, '2020-01-01'), true);
  assert.equal(hasJoinedBy({}, '2020-01-01'), true);
});

test('admins cannot mark attendance for a future date', async () => {
  const tomorrow = nextWorkingDay(currentDateInTimeZone('Asia/Kolkata'));
  await assert.rejects(
    markAttendance(admin, { employeeId, date: tomorrow, status: 'present', organizationId, timeZone: 'Asia/Kolkata' }),
    (error) => error.statusCode === 400 && error.message === 'Attendance cannot be marked for a future date.',
  );
});

test('admins cannot mark attendance before the employee joined', async (t) => {
  stub(t, User, { findOne: async () => ({ id: organizationId }) });
  stub(t, Employee, { findOne: async () => ({ _id: employeeId, name: 'Bikash Sherpa', status: 'active', dateOfJoining: '2025-05-12' }) });
  let saved = false;
  stub(t, Attendance, { findOneAndUpdate: async () => { saved = true; return null; } });

  await assert.rejects(
    markAttendance(admin, { employeeId, date: '2025-05-10', status: 'present', organizationId }),
    (error) => error.statusCode === 400 && error.message === 'Bikash Sherpa joined on 2025-05-12. Attendance cannot be marked before that date.',
  );
  assert.equal(saved, false);
});

test('attendance on the joining date itself is saved', async (t) => {
  stub(t, User, { findOne: async () => ({ id: organizationId }) });
  stub(t, Employee, { findOne: async () => ({ _id: employeeId, name: 'Bikash Sherpa', status: 'active', dateOfJoining: '2025-05-12' }) });
  let options;
  stub(t, Attendance, {
    findOneAndUpdate: async (filter, update, given) => {
      options = given;
      return { employeeId, date: filter.date, status: update.$set.status, updatedAt: null };
    },
  });

  const record = await markAttendance(admin, { employeeId, date: '2025-05-12', status: 'half_day', organizationId });
  assert.deepEqual(record, { employeeId, date: '2025-05-12', status: 'half_day', updatedAt: null });
  assert.equal(options.returnDocument, 'after');
  assert.equal('new' in options, false);
});

test('bulk attendance skips future dates and days before joining', async (t) => {
  const today = currentDateInTimeZone('Asia/Kolkata');
  const future = nextWorkingDay(today);
  let inserted = [];
  stub(t, User, { findOne: async () => ({ id: organizationId }) });
  stub(t, Location, { findOne: async () => ({ _id: locationId, organizationId, designation: 'mali' }) });
  stub(t, Employee, {
    find: (filter) => {
      if (filter.locationId) return { distinct: async () => [employeeId] };
      return { sort: () => ({ lean: async () => [{ _id: employeeId, name: 'Bikash', status: 'active', dateOfJoining: '2025-05-12' }] }) };
    },
  });
  stub(t, Attendance, {
    find: () => ({ select() { return this; }, lean: async () => [] }),
    insertMany: async (docs) => { inserted = docs; return docs; },
  });

  const result = await bulkMarkAttendance(admin, {
    organizationId,
    locationId,
    timeZone: 'Asia/Kolkata',
    entries: [
      { employeeId, status: 'present', date: '2025-05-10' },
      { employeeId, status: 'present', date: '2025-05-12' },
      { employeeId, status: 'present', date: future },
    ],
  });
  assert.deepEqual(result, { saved: 1, updated: 0, skippedDuplicates: 0, skippedInvalid: 2, skippedBlocked: 0 });
  assert.deepEqual(inserted.map(({ date }) => date), ['2025-05-12']);
});

const posts = [
  { workName: 'Horticulture', designations: ['Mali', 'Supervisor'] },
  { workName: 'Security', designations: ['Security Guard'] },
];

function masterDesignation(name) {
  return { type: 'designation', name, code: name.toLowerCase() };
}

test('a location work name does not limit its designation to that work name', async (t) => {
  stub(t, User, { findOne: async () => ({ id: organizationId, posts }) });
  stub(t, MasterData, { findOne: () => ({ lean: async () => masterDesignation('Mali') }) });
  stub(t, Location, { create: async (input) => ({ ...input, _id: locationId, toObject() { return this; } }) });

  const location = await createLocation(admin, organizationId, { workName: 'Security', name: 'Main gate', designation: 'Mali' });
  assert.equal(location.designation, 'Mali');
});

test('a location designation must be one of the organization designations', async (t) => {
  stub(t, User, { findOne: async () => ({ id: organizationId, posts }) });
  stub(t, MasterData, { findOne: () => ({ lean: async () => masterDesignation('Sweeper') }) });

  await assert.rejects(
    createLocation(admin, organizationId, { workName: 'Office cleaning', name: 'Office', designation: 'Sweeper' }),
    (error) => error.statusCode === 400 && error.message === '"Sweeper" is not one of this organization\'s designations. Add it to the organization\'s work names first.',
  );
});

test('a location matching its work name, or a free work name with an organization designation, is created', async (t) => {
  stub(t, User, { findOne: async () => ({ id: organizationId, posts }) });
  let name = 'Supervisor';
  stub(t, MasterData, { findOne: () => ({ lean: async () => masterDesignation(name) }) });
  const createdInputs = [];
  stub(t, Location, {
    create: async (input) => {
      createdInputs.push(input);
      return { ...input, _id: locationId, toObject() { return this; } };
    },
  });

  await createLocation(admin, organizationId, { workName: 'horticulture', name: 'Colony park', designation: 'supervisor' });
  name = 'Security Guard';
  await createLocation(admin, organizationId, { workName: 'Main gate watch', name: 'Gate', designation: 'Security Guard' });
  assert.deepEqual(createdInputs.map((input) => input.designation), ['Supervisor', 'Security Guard']);
});

test('updating a location to another organization designation is allowed whatever its work name', async (t) => {
  stub(t, User, { findOne: async () => ({ id: organizationId, posts }) });
  let name = 'Sweeper';
  stub(t, MasterData, { findOne: () => ({ lean: async () => masterDesignation(name) }) });
  const location = {
    _id: locationId,
    organizationId,
    workName: 'Security',
    name: 'Gate',
    designation: 'Security Guard',
    status: 'active',
    async save() {},
    toObject() { return this; },
  };
  stub(t, Location, { findOne: async () => location });

  await assert.rejects(
    updateLocation(admin, organizationId, locationId, { designation: 'Sweeper' }),
    (error) => error.statusCode === 400 && error.message.startsWith('"Sweeper" is not one of this organization\'s designations'),
  );
  assert.equal(location.designation, 'Security Guard');
  name = 'Mali';
  const updated = await updateLocation(admin, organizationId, locationId, { designation: 'Mali', opNumber: 'PO-7' });
  assert.equal(updated.designation, 'Mali');
  assert.equal(updated.opNumber, 'PO-7');
});

test('organizations without work names can use any designation for a location', async (t) => {
  stub(t, User, { findOne: async () => ({ id: organizationId, posts: [] }) });
  stub(t, MasterData, { findOne: () => ({ lean: async () => masterDesignation('Mali') }) });
  stub(t, Location, { create: async (input) => ({ ...input, _id: locationId, toObject() { return this; } }) });

  const location = await createLocation(admin, organizationId, { workName: 'Security', name: 'Gate', designation: 'Mali' });
  assert.equal(location.designation, 'Mali');
});

test('organizations listed for a designation are only those with an active location for it', async (t) => {
  let locationFilter;
  let organizationFilter;
  stub(t, Location, {
    distinct: async (field, filter) => {
      assert.equal(field, 'organizationId');
      locationFilter = filter;
      return [organizationId];
    },
  });
  stub(t, User, {
    countDocuments: async () => 1,
    find: (filter) => {
      organizationFilter = filter;
      return { sort: () => ({ skip: () => ({ limit: async () => [] }) }) };
    },
  });

  await listOrganizations({ status: 'active', designation: '  Security   Guard ' });
  assert.equal(locationFilter.status, 'active');
  assert.ok(locationFilter.designation.test('security guard'));
  assert.equal(locationFilter.designation.test('Security Guard Supervisor'), false);
  assert.deepEqual(organizationFilter._id, { $in: [organizationId] });
  assert.equal(organizationFilter.status, 'active');
  assert.equal('posts.designations' in organizationFilter, false);
});

test('organizations listed without a designation are not limited by locations', async (t) => {
  let distinctCalled = false;
  let organizationFilter;
  stub(t, Location, { distinct: async () => { distinctCalled = true; return []; } });
  stub(t, User, {
    countDocuments: async () => 0,
    find: (filter) => {
      organizationFilter = filter;
      return { sort: () => ({ skip: () => ({ limit: async () => [] }) }) };
    },
  });

  await listOrganizations({ status: 'active' });
  assert.equal(distinctCalled, false);
  assert.equal('_id' in organizationFilter, false);
});

test('invoice GST rounds an exact half paisa up', () => {
  const totals = computeTotals([
    { section: 'service', qty: 1, amount: 454599.25 },
    { section: 'supply', qty: 2, amount: 900 },
  ], 18);
  assert.equal(totals.gstAmount, 81827.87);
  assert.equal(totals.netPayable, 537327.12);
  assert.equal(computeTotals([{ section: 'service', qty: 1, amount: 1000.05 }], 12).gstAmount, 120.01);
  assert.equal(computeTotals([{ section: 'service', qty: 1, amount: 100 }], 2.5).gstAmount, 2.5);
});

// October 2026 has 27 days other than Sundays.
const OCTOBER_WORKING_DATES = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`)
  .filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() !== 0);

function stubLocationEmployee(t) {
  stub(t, User, { findOne: async () => ({ id: organizationId }) });
  stub(t, Location, { findOne: async () => ({ _id: locationId, organizationId, designation: 'mali' }) });
  stub(t, Employee, {
    find: (filter) => {
      if (filter.locationId) return { distinct: async () => [employeeId] };
      return { sort: () => ({ lean: async () => [{ _id: employeeId, name: 'Bikash Sherpa', status: 'active' }] }) };
    },
  });
}

test('saving attendance leaves days blank once the month has 26 paid days', async (t) => {
  assert.equal(OCTOBER_WORKING_DATES.length, 27);
  stubLocationEmployee(t);
  const saved = OCTOBER_WORKING_DATES.slice(0, 25).map((date) => ({ employeeId, date, status: 'present' }));
  let inserted = [];
  stub(t, Attendance, {
    find: (filter) => ({ select() { return this; }, lean: async () => (filter.$or ? saved : []) }),
    insertMany: async (docs) => { inserted = docs; return docs; },
  });

  const result = await bulkMarkAttendance(admin, {
    organizationId,
    locationId,
    timeZone: 'Asia/Kolkata',
    entries: [
      { employeeId, status: 'present', date: OCTOBER_WORKING_DATES[26] },
      { employeeId, status: 'half_day', date: OCTOBER_WORKING_DATES[25] },
    ],
  });
  assert.deepEqual(result, { saved: 1, updated: 0, skippedDuplicates: 0, skippedInvalid: 0, skippedBlocked: 0, skippedOverLimit: 1 });
  assert.deepEqual(inserted.map(({ date, status }) => [date, status]), [[OCTOBER_WORKING_DATES[25], 'half_day']]);
});

test('absences are saved even after the month has 26 paid days', async (t) => {
  stubLocationEmployee(t);
  const saved = OCTOBER_WORKING_DATES.slice(0, 26).map((date) => ({ employeeId, date, status: 'present' }));
  let inserted = [];
  stub(t, Attendance, {
    find: (filter) => ({ select() { return this; }, lean: async () => (filter.$or ? saved : []) }),
    insertMany: async (docs) => { inserted = docs; return docs; },
  });

  const result = await bulkMarkAttendance(admin, {
    organizationId,
    locationId,
    timeZone: 'Asia/Kolkata',
    entries: [{ employeeId, status: 'absent', date: OCTOBER_WORKING_DATES[26] }],
  });
  assert.deepEqual(result, { saved: 1, updated: 0, skippedDuplicates: 0, skippedInvalid: 0, skippedBlocked: 0 });
  assert.equal(inserted[0].status, 'absent');
});

const WAGE_RATES = {
  bonusRate: 8.33, epfRate: 12, epfWageCeiling: 25000, esiRate: 0.75, esiWageCeiling: 21000, overtimeHoursPerDay: 8, overtimeRateMultiplier: 2,
};
const WAGE_LINE = { employeeId, employeeName: 'Bikash', parentName: '', dailySalary: 800, paidDays: 26, epfoApplicable: true, esicApplicable: true };

test('overtime hours are paid at twice the hourly wage and added to the net payment', () => {
  const row = wageRegisterRow({ ...WAGE_LINE, overtimeHours: 10 }, WAGE_RATES);
  assert.equal(row.wages, 20800);
  assert.equal(row.overtimeRate, 200);
  assert.equal(row.overtimeWages, 2000);
  assert.equal(row.bonus, 1732.64);
  assert.equal(row.totalWages, 24532.64);
  assert.equal(row.epf, 2496);
  assert.equal(row.esi, 158);
  assert.equal(row.grossPayment, 21879);
});

test('a register without overtime keeps the same figures as before', () => {
  const row = wageRegisterRow(WAGE_LINE, WAGE_RATES);
  assert.equal(row.overtimeHours, 0);
  assert.equal(row.overtimeWages, 0);
  assert.equal(row.totalWages, 22532.64);
  assert.equal(row.esi, 156);
  assert.equal(row.grossPayment, 19881);
});

test('only admins enter overtime, for this or an earlier month, in valid hours', async (t) => {
  const thisMonth = currentDateInTimeZone('Asia/Kolkata').slice(0, 7);
  const input = { organizationId, locationId, employeeId, month: thisMonth, hours: '12.5', timeZone: 'Asia/Kolkata' };
  stub(t, User, { findOne: async () => ({ id: organizationId }) });
  stub(t, Employee, { findOne: () => ({ select: () => ({ lean: async () => ({ _id: employeeId, name: 'Bikash' }) }) }) });
  let saved = null;
  let deleted = null;
  stub(t, Overtime, {
    findOneAndUpdate: async (filter, update) => { saved = { filter, update }; return {}; },
    deleteOne: async (filter) => { deleted = filter; return {}; },
  });

  await assert.rejects(setOvertimeHours({ id: organizationId, role: 'organization' }, input), (error) => error.statusCode === 403);
  await assert.rejects(setOvertimeHours(admin, { ...input, month: '2999-01' }), (error) => /future month/.test(error.message));
  for (const hours of ['-1', 'abc', '401', '1.234']) {
    await assert.rejects(setOvertimeHours(admin, { ...input, hours }), (error) => error.statusCode === 400 && /Overtime must be/.test(error.message));
  }

  assert.deepEqual(await setOvertimeHours(admin, input), { employeeId, month: thisMonth, hours: 12.5 });
  assert.equal(saved.update.$set.hours, 12.5);
  assert.equal(String(saved.update.$set.locationId), locationId);

  await setOvertimeHours(admin, { ...input, hours: '0' });
  assert.deepEqual(deleted, { employeeId, month: thisMonth });
});

test('a month sheet with 27 present days shows the 27th day blank', async (t) => {
  stubLocationEmployee(t);
  stub(t, Attendance, { find: () => ({ lean: async () => [] }) });
  const XLSX = require('xlsx');
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['S.no', 'Name of Employees', ...days],
    [1, 'Bikash Sherpa', ...days.map(() => 'P')],
  ]), 'Attendance');

  const result = await parseAttendanceMonth(admin, {
    organizationId,
    locationId,
    month: '2026-10',
    timeZone: 'Asia/Kolkata',
    file: {
      originalname: 'attendance.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    },
  });
  const [row] = result.rows;
  assert.equal(row.marks.filter((mark) => mark === 'present').length, 26);
  assert.equal(row.marks[30], null);
  assert.equal(row.details[30].mark, 'P');
  assert.equal(row.details[30].reason, 'Left blank: the month already has 26 paid days.');
});
