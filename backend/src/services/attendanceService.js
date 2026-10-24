const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { canMarkAttendanceOn, countsAttendanceOn } = require('../utils/employeeStatus');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');
const {
  extractRowsFromFile,
  extractSheetSource,
  fileKind,
  matchExtractedEmployee,
  parseSheetMatrixMonth,
  periodFromParts,
} = require('./attendanceSheetParser');

const ATTENDANCE_STATUSES = ['present', 'absent'];
const HISTORY_PAGE_SIZE = 10;
const REGISTER_PAGE_SIZE = 20;
const REGISTER_MAX_PAGE_SIZE = 100;
const REGISTER_FILTERS = ['all', 'absent', 'full', 'unmarked'];

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function currentDateInTimeZone(timeZone = 'UTC') {
  if (typeof timeZone !== 'string' || timeZone.length > 100) {
    throw httpError(400, 'Enter a valid time zone.');
  }

  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
  } catch {
    throw httpError(400, 'Enter a valid time zone.');
  }

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function getOrganizationId(user, requestedId) {
  if (user.role !== 'admin') return user.id;
  if (!mongoose.isValidObjectId(requestedId)) {
    throw httpError(400, 'A valid organization id is required.');
  }

  const organization = await User.findOne({ _id: requestedId, role: 'organization' });
  if (!organization) throw httpError(404, 'Organization not found.');
  return organization.id;
}

async function getLocationEmployeeIds(locationId, organizationId) {
  if (!locationId) return null;
  if (!mongoose.isValidObjectId(locationId)) throw httpError(400, 'Invalid location id.');
  const location = await Location.findOne({ _id: locationId, organizationId });
  if (!location) throw httpError(404, 'Location not found for this organization.');
  return Employee.find({
    organizationId,
    locationId,
    designation: new RegExp(`^${escapeRegex(location.designation)}$`, 'i'),
  }).distinct('_id');
}

async function listAttendance(user, options = {}) {
  const organizationId = await getOrganizationId(user, options.organizationId);
  const date = options.date || new Date().toISOString().slice(0, 10);
  if (!isValidDate(date)) throw httpError(400, 'Enter a valid attendance date.');
  const locationEmployeeIds = await getLocationEmployeeIds(options.locationId, organizationId);
  const employeeFilter = { organizationId };
  const attendanceFilter = { organizationId, date };
  if (locationEmployeeIds) {
    employeeFilter._id = { $in: locationEmployeeIds };
    attendanceFilter.employeeId = { $in: locationEmployeeIds };
  }

  const [employees, records] = await Promise.all([
    Employee.find(employeeFilter).sort({ name: 1, _id: 1 }).lean(),
    Attendance.find(attendanceFilter).lean(),
  ]);
  const recordsByEmployee = new Map(records.map((record) => [String(record.employeeId), record]));
  const visibleEmployees = employees.filter((employee) => (
    canMarkAttendanceOn(employee, date) || recordsByEmployee.has(String(employee._id))
  ));

  return {
    date,
    attendance: visibleEmployees.map((employee) => {
      const record = recordsByEmployee.get(String(employee._id));
      return {
        employeeId: String(employee._id),
        name: employee.name,
        email: employee.email,
        jobTitle: employee.jobTitle,
        department: employee.department,
        employeeStatus: employee.status,
        canMark: canMarkAttendanceOn(employee, date),
        status: record ? (record.status === 'present' ? 'present' : 'absent') : null,
        updatedAt: record?.updatedAt || null,
      };
    }),
  };
}

async function listAttendanceHistory(user, options = {}) {
  const organizationId = await getOrganizationId(user, options.organizationId);
  const locationEmployeeIds = await getLocationEmployeeIds(options.locationId, organizationId);
  const requestedPage = Number(options.page);
  const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLimit = Number(options.limit);
  const limit = Math.min(
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : HISTORY_PAGE_SIZE,
    HISTORY_PAGE_SIZE,
  );
  const filter = { organizationId };
  if (locationEmployeeIds) filter.employeeId = { $in: locationEmployeeIds };
  const status = ATTENDANCE_STATUSES.includes(options.status) ? options.status : 'all';
  if (status === 'absent') filter.status = { $in: ['absent', 'late', 'leave'] };
  else if (status !== 'all') filter.status = status;

  const fromDate = options.fromDate || '';
  const toDate = options.toDate || '';
  if ((fromDate && !isValidDate(fromDate)) || (toDate && !isValidDate(toDate))) {
    throw httpError(400, 'Enter a valid attendance date range.');
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw httpError(400, 'The start date must be on or before the end date.');
  }
  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = fromDate;
    if (toDate) filter.date.$lte = toDate;
  }

  const search = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : '';
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const employeeIds = await Employee.find({
      organizationId,
      $or: [
        { name: pattern },
        { email: pattern },
        { department: pattern },
        { jobTitle: pattern },
      ],
    }).distinct('_id');
    const matchingEmployeeIds = locationEmployeeIds
      ? employeeIds.filter((id) => locationEmployeeIds.some((locationId) => String(locationId) === String(id)))
      : employeeIds;
    filter.employeeId = { $in: matchingEmployeeIds };
  }

  const total = await Attendance.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pageNumber, totalPages);
  const records = await Attendance.find(filter)
    .populate('employeeId', 'name email department jobTitle')
    .sort({ date: -1, updatedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    records: records.map((record) => {
      const employee = record.employeeId && typeof record.employeeId === 'object'
        ? record.employeeId
        : null;
      return {
        id: String(record._id),
        employeeId: String(employee?._id || record.employeeId),
        employeeName: employee?.name || 'Employee record unavailable',
        employeeEmail: employee?.email || '',
        department: employee?.department || '',
        jobTitle: employee?.jobTitle || '',
        date: record.date,
        status: record.status === 'present' ? 'present' : 'absent',
        updatedAt: record.updatedAt,
      };
    }),
    pagination: { page, limit, total, totalPages },
  };
}

function blockedMessage(employee) {
  return employee.disabledOn
    ? `${employee.name || 'This employee'} was blocked on ${employee.disabledOn}. Attendance cannot be marked from that date.`
    : `${employee.name || 'This employee'} is blocked. Attendance cannot be marked.`;
}

async function markAttendance(user, input = {}) {
  const organizationId = await getOrganizationId(user, input.organizationId);
  if (input.locationId) await getLocationEmployeeIds(input.locationId, organizationId);
  const { employeeId, date, status } = input;
  if (!mongoose.isValidObjectId(employeeId)) throw httpError(400, 'Invalid employee id.');
  if (!isValidDate(date)) throw httpError(400, 'Enter a valid attendance date.');
  if (user.role === 'organization' && date !== currentDateInTimeZone(input.timeZone)) {
    throw httpError(400, 'Organizations can only mark attendance for today.');
  }
  if (!ATTENDANCE_STATUSES.includes(status)) throw httpError(400, 'Select a valid attendance status.');

  const employeeFilter = { _id: employeeId, organizationId };
  if (input.locationId) employeeFilter.locationId = input.locationId;
  if (user.role === 'organization') employeeFilter.status = 'active';
  const employee = await Employee.findOne(employeeFilter);
  if (!employee) throw httpError(404, 'Employee not found for this organization.');
  if (!canMarkAttendanceOn(employee, date)) throw httpError(400, blockedMessage(employee));

  const filter = { employeeId, date };
  const update = { $set: { organizationId, status, markedBy: user.id } };
  let record;

  try {
    record = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    record = await Attendance.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (!record) throw error;
  }

  return {
    employeeId: String(record.employeeId),
    date: record.date,
    status: record.status,
    updatedAt: record.updatedAt,
  };
}

function requireAdmin(user) {
  if (user.role !== 'admin') {
    throw httpError(403, 'You do not have permission to access this resource.');
  }
}

async function getLocationEmployees(locationId, organizationId) {
  if (!locationId) throw httpError(400, 'A valid location id is required.');
  const locationEmployeeIds = await getLocationEmployeeIds(locationId, organizationId);
  if (!locationEmployeeIds) throw httpError(400, 'A valid location id is required.');
  return Employee.find({
    organizationId,
    _id: { $in: locationEmployeeIds },
  }).sort({ name: 1, _id: 1 }).lean();
}

function publicEmployee(employee) {
  return {
    employeeId: String(employee._id),
    employeeName: employee.name,
    parentName: employee.parentName || '',
  };
}

async function parseAttendanceSheet(user, input = {}) {
  requireAdmin(user);
  const date = input.date;
  if (!isValidDate(date)) throw httpError(400, 'Enter a valid attendance date.');
  if (!input.file?.buffer) throw httpError(400, 'Upload an attendance sheet.');
  if (!fileKind(input.file)) throw httpError(400, 'Upload a PDF, Excel, CSV, or image attendance sheet.');
  const organizationId = await getOrganizationId(user, input.organizationId);

  const employees = await getLocationEmployees(input.locationId, organizationId);
  const { rows: extractedRows, period } = await extractRowsFromFile(input.file, date);
  const records = await Attendance.find({
    organizationId,
    date,
    employeeId: { $in: employees.map((employee) => employee._id) },
  }).lean();
  const recordsByEmployee = new Map(records.map((record) => [String(record.employeeId), record]));
  const selectedPeriod = periodFromParts(Number(date.slice(5, 7)), Number(date.slice(0, 4)));
  const periodMismatch = period
    && (period.month !== selectedPeriod.month || period.year !== selectedPeriod.year);

  return {
    date,
    dayColumn: Number(date.slice(8, 10)),
    selectedPeriod,
    sheetPeriod: period,
    warning: periodMismatch
      ? `This sheet is for ${period.label}, but the selected date is in ${selectedPeriod.label}. Change the date or upload the correct month.`
      : '',
    employees: employees.map(publicEmployee),
    rows: extractedRows.map((row) => {
      const matched = matchExtractedEmployee(
        { name: row.extractedName, parentName: row.extractedParentName },
        employees,
      );
      const employee = matched.employee;
      const existing = employee ? recordsByEmployee.get(String(employee._id)) : null;
      const blocked = Boolean(employee) && !canMarkAttendanceOn(employee, date);
      return {
        extractedName: row.extractedName,
        extractedParentName: row.extractedParentName || '',
        employeeId: employee ? String(employee._id) : null,
        employeeName: employee?.name || '',
        parentName: employee?.parentName || '',
        status: blocked ? null : row.status,
        blocked,
        match: matched.match,
        alreadyMarked: Boolean(existing),
        existingStatus: existing ? (existing.status === 'present' ? 'present' : 'absent') : null,
      };
    }),
  };
}

function parseMonthInput(month) {
  const match = typeof month === 'string' ? month.match(/^(\d{4})-(\d{2})$/) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const period = periodFromParts(monthNumber, year);
  if (!period) return null;
  return { month, year, monthNumber, period, daysInMonth: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() };
}

async function parseAttendanceMonth(user, input = {}) {
  requireAdmin(user);
  const selected = parseMonthInput(input.month);
  if (!selected) throw httpError(400, 'Select a valid attendance month.');
  if (!input.file?.buffer) throw httpError(400, 'Upload an attendance sheet.');
  if (!fileKind(input.file)) throw httpError(400, 'Upload a PDF, Excel, CSV, or image attendance sheet.');

  const today = currentDateInTimeZone(input.timeZone || 'UTC');
  const currentMonth = today.slice(0, 7);
  if (selected.month > currentMonth) throw httpError(400, 'Attendance cannot be imported for a future month.');
  const lastImportableDay = selected.month === currentMonth ? Number(today.slice(8, 10)) : selected.daysInMonth;

  const organizationId = await getOrganizationId(user, input.organizationId);
  const employees = await getLocationEmployees(input.locationId, organizationId);
  const source = await extractSheetSource(input.file);
  const parsed = parseSheetMatrixMonth(source.matrix, selected.month, selected.daysInMonth);
  if (parsed.dayColumns.length === 0) {
    throw httpError(400, 'No day columns (1-31) were found in this sheet. Use single day upload for this file.');
  }

  const futureDays = new Set();
  for (const row of parsed.rows) {
    for (const day of Object.keys(row.days).map(Number)) {
      if (day > lastImportableDay) futureDays.add(day);
    }
  }

  const fromDate = `${selected.month}-01`;
  const toDate = `${selected.month}-${String(selected.daysInMonth).padStart(2, '0')}`;
  const records = await Attendance.find({
    organizationId,
    date: { $gte: fromDate, $lte: toDate },
    employeeId: { $in: employees.map((employee) => employee._id) },
  }).lean();
  const existingByKey = new Map(records.map((record) => [
    `${String(record.employeeId)}|${Number(record.date.slice(8, 10))}`,
    record.status === 'present' ? 'present' : 'absent',
  ]));

  const periodMismatch = source.period
    && (source.period.month !== selected.monthNumber || source.period.year !== selected.year);

  return {
    month: selected.month,
    periodLabel: selected.period.label,
    daysInMonth: selected.daysInMonth,
    lastImportableDay,
    sheetDays: parsed.dayColumns,
    skippedFutureDays: [...futureDays].sort((a, b) => a - b),
    sheetPeriod: source.period,
    warning: periodMismatch
      ? `This sheet is for ${source.period.label}, but the selected month is ${selected.period.label}. Change the month or upload the correct sheet.`
      : '',
    employees: employees.map(publicEmployee),
    rows: parsed.rows.map((row) => {
      const matched = matchExtractedEmployee(
        { name: row.extractedName, parentName: row.extractedParentName },
        employees,
      );
      const employee = matched.employee;
      const marks = Array.from({ length: lastImportableDay }, (_, index) => {
        const date = `${selected.month}-${String(index + 1).padStart(2, '0')}`;
        return employee && !canMarkAttendanceOn(employee, date) ? null : row.days[index + 1] || null;
      });
      const existing = Array.from({ length: lastImportableDay }, (_, index) => (
        employee ? existingByKey.get(`${String(employee._id)}|${index + 1}`) || null : null
      ));
      return {
        extractedName: row.extractedName,
        extractedParentName: row.extractedParentName || '',
        employeeId: employee ? String(employee._id) : null,
        employeeName: employee?.name || '',
        parentName: employee?.parentName || '',
        match: matched.match,
        marks,
        existing,
      };
    }),
  };
}

const MAX_BULK_ENTRIES = 5000;

async function bulkMarkAttendance(user, input = {}) {
  requireAdmin(user);
  const entries = Array.isArray(input.entries) ? input.entries.slice(0, MAX_BULK_ENTRIES) : [];
  const defaultDate = input.date;
  if (defaultDate !== undefined && defaultDate !== '' && !isValidDate(defaultDate)) {
    throw httpError(400, 'Enter a valid attendance date.');
  }
  if (!defaultDate && !entries.some((entry) => isValidDate(entry?.date))) {
    throw httpError(400, 'Enter a valid attendance date.');
  }
  if (!input.locationId) throw httpError(400, 'A valid location id is required.');
  const organizationId = await getOrganizationId(user, input.organizationId);
  const employees = await getLocationEmployees(input.locationId, organizationId);
  const employeesById = new Map(employees.map((employee) => [String(employee._id), employee]));
  const seen = new Set();
  const candidateIds = new Set();
  const candidateDates = new Set();
  const accepted = [];
  let skippedInvalid = 0;
  let skippedBlocked = 0;

  for (const entry of entries) {
    const employeeId = String(entry?.employeeId || '');
    const status = entry?.status;
    const date = entry?.date || defaultDate;
    const key = `${employeeId}|${date}`;
    if (!employeesById.has(employeeId) || !ATTENDANCE_STATUSES.includes(status) || !isValidDate(date) || seen.has(key)) {
      skippedInvalid += 1;
      continue;
    }
    if (!canMarkAttendanceOn(employeesById.get(employeeId), date)) {
      skippedBlocked += 1;
      continue;
    }
    seen.add(key);
    candidateIds.add(employeeId);
    candidateDates.add(date);
    accepted.push({ employeeId, status, date, replace: entry?.replace === true });
  }

  const existing = accepted.length === 0 ? [] : await Attendance.find({
    organizationId,
    date: { $in: [...candidateDates] },
    employeeId: { $in: [...candidateIds] },
  }).select('employeeId date').lean();
  const existingKeys = new Set(existing.map((record) => `${String(record.employeeId)}|${record.date}`));
  const toInsert = [];
  const toUpdate = [];
  let skippedDuplicates = 0;

  for (const entry of accepted) {
    if (existingKeys.has(`${entry.employeeId}|${entry.date}`)) {
      if (entry.replace) toUpdate.push(entry);
      else skippedDuplicates += 1;
      continue;
    }
    toInsert.push({
      organizationId,
      employeeId: entry.employeeId,
      date: entry.date,
      status: entry.status,
      markedBy: user.id,
    });
  }

  let saved = 0;
  if (toInsert.length > 0) {
    try {
      const inserted = await Attendance.insertMany(toInsert, { ordered: false });
      saved = inserted.length;
    } catch (error) {
      if (error.code !== 11000 && !error.writeErrors) throw error;
      saved = error.result?.nInserted || error.insertedDocs?.length || 0;
      skippedDuplicates += toInsert.length - saved;
    }
  }

  let updated = 0;
  if (toUpdate.length > 0) {
    const result = await Attendance.bulkWrite(toUpdate.map((entry) => ({
      updateOne: {
        filter: { organizationId, employeeId: entry.employeeId, date: entry.date },
        update: { $set: { status: entry.status, markedBy: user.id } },
      },
    })), { ordered: false });
    updated = result.matchedCount ?? result.nMatched ?? toUpdate.length;
  }

  return { saved, updated, skippedDuplicates, skippedInvalid, skippedBlocked };
}

const REGISTER_CONTRACTOR = {
  name: 'M/s. Shreeji Caretaker Company',
  address: 'Kankroli, Rajsamand',
  signatory: 'SHREE JI CARETAKER CO.',
};

async function getAttendanceRegister(user, input = {}) {
  requireAdmin(user);
  const monthMatch = typeof input.month === 'string' ? input.month.match(/^(\d{4})-(\d{2})$/) : null;
  const year = monthMatch ? Number(monthMatch[1]) : 0;
  const monthNumber = monthMatch ? Number(monthMatch[2]) : 0;
  const period = periodFromParts(monthNumber, year);
  if (!period) throw httpError(400, 'Select a valid register month.');
  if (!input.locationId) throw httpError(400, 'A valid location id is required.');
  const organizationId = await getOrganizationId(user, input.organizationId);

  const employees = await getLocationEmployees(input.locationId, organizationId);
  const [location, organization] = await Promise.all([
    Location.findOne({ _id: input.locationId, organizationId }).lean(),
    User.findOne({ _id: organizationId, role: 'organization' }).lean(),
  ]);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const fromDate = `${input.month}-01`;
  const toDate = `${input.month}-${String(daysInMonth).padStart(2, '0')}`;
  const records = await Attendance.find({
    organizationId,
    employeeId: { $in: employees.map((employee) => employee._id) },
    date: { $gte: fromDate, $lte: toDate },
  }).lean();

  const employeesById = new Map(employees.map((employee) => [String(employee._id), employee]));
  const marksByEmployee = new Map();
  for (const record of records) {
    const key = String(record.employeeId);
    if (!countsAttendanceOn(employeesById.get(key), record.date)) continue;
    if (!marksByEmployee.has(key)) marksByEmployee.set(key, new Map());
    marksByEmployee.get(key).set(Number(record.date.slice(8, 10)), record.status === 'present' ? 'P' : 'A');
  }

  const today = currentDateInTimeZone(input.timeZone || 'UTC');
  const elapsedDays = today.slice(0, 7) > input.month
    ? daysInMonth
    : today.slice(0, 7) < input.month ? 0 : Number(today.slice(8, 10));
  const workingDaysFor = (employee) => {
    if (employee.status !== 'disabled') return elapsedDays;
    if (!employee.disabledOn || employee.disabledOn < fromDate) return 0;
    if (employee.disabledOn > toDate) return elapsedDays;
    return Math.min(elapsedDays, Number(employee.disabledOn.slice(8, 10)) - 1);
  };

  const allRows = employees
    .filter((employee) => (
      workingDaysFor(employee) > 0
      || employee.status === 'active'
      || marksByEmployee.has(String(employee._id))
    ))
    .map((employee, index) => {
      const marks = marksByEmployee.get(String(employee._id)) || new Map();
      const days = Array.from({ length: daysInMonth }, (_, day) => marks.get(day + 1) || '');
      return {
        serial: index + 1,
        employeeId: String(employee._id),
        name: employee.name,
        parentName: employee.parentName || '',
        skillCategory: employee.skillCategory || '',
        employeeStatus: employee.status,
        disabledOn: employee.status === 'disabled' ? employee.disabledOn || '' : '',
        workingDays: workingDaysFor(employee),
        days,
        totalPresent: days.filter((mark) => mark === 'P').length,
      };
    });

  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const row of allRows) {
    for (const [index, mark] of row.days.entries()) {
      if (mark === 'P') present += 1;
      else if (mark === 'A') absent += 1;
      else if (index < row.workingDays) unmarked += 1;
    }
  }
  const summary = {
    employees: allRows.length,
    present,
    absent,
    unmarked,
  };
  const categories = [...new Set(allRows.map((row) => row.skillCategory).filter(Boolean))].sort();

  const search = typeof input.search === 'string' ? input.search.trim().slice(0, 100).toLowerCase() : '';
  const category = typeof input.category === 'string' && input.category !== 'all' ? input.category : '';
  const attendanceFilter = REGISTER_FILTERS.includes(input.filter) ? input.filter : 'all';
  const filteredRows = allRows.filter((row) => {
    if (category && row.skillCategory !== category) return false;
    const elapsed = row.days.slice(0, row.workingDays);
    if (attendanceFilter === 'absent' && !row.days.includes('A')) return false;
    if (attendanceFilter === 'full' && (elapsed.length === 0 || elapsed.some((mark) => mark !== 'P'))) return false;
    if (attendanceFilter === 'unmarked' && !elapsed.includes('')) return false;
    if (!search) return true;
    return row.name.toLowerCase().includes(search) || row.parentName.toLowerCase().includes(search);
  });

  let rows = filteredRows;
  let pagination = null;
  if (input.page !== undefined) {
    const requestedPage = Number(input.page);
    const requestedLimit = Number(input.limit);
    const limit = Math.min(
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : REGISTER_PAGE_SIZE,
      REGISTER_MAX_PAGE_SIZE,
    );
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / limit));
    const page = Math.min(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, totalPages);
    rows = filteredRows.slice((page - 1) * limit, page * limit);
    pagination = { page, limit, total: filteredRows.length, totalPages };
  }

  return {
    month: input.month,
    periodLabel: period.label,
    daysInMonth,
    contractor: REGISTER_CONTRACTOR,
    organizationName: organization?.organizationName || organization?.name || '',
    location: {
      workName: location?.workName || '',
      name: location?.name || '',
      address: location?.address || '',
      opNumber: location?.opNumber || '',
    },
    rows,
    totalMandays: rows.reduce((sum, row) => sum + row.totalPresent, 0),
    elapsedDays,
    summary,
    categories,
    pagination,
  };
}

module.exports = {
  bulkMarkAttendance,
  currentDateInTimeZone,
  getAttendanceRegister,
  listAttendance,
  listAttendanceHistory,
  markAttendance,
  parseAttendanceMonth,
  parseAttendanceSheet,
};