const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');

const ATTENDANCE_STATUSES = ['present', 'absent'];
const HISTORY_PAGE_SIZE = 10;

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

async function listAttendance(user, options = {}) {
  const organizationId = await getOrganizationId(user, options.organizationId);
  const date = options.date || new Date().toISOString().slice(0, 10);
  if (!isValidDate(date)) throw httpError(400, 'Enter a valid attendance date.');

  const [employees, records] = await Promise.all([
    Employee.find({ organizationId }).sort({ name: 1, _id: 1 }).lean(),
    Attendance.find({ organizationId, date }).lean(),
  ]);
  const recordsByEmployee = new Map(records.map((record) => [String(record.employeeId), record]));
  const visibleEmployees = employees.filter((employee) => (
    employee.status === 'active' || recordsByEmployee.has(String(employee._id))
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
        status: record ? (record.status === 'present' ? 'present' : 'absent') : null,
        updatedAt: record?.updatedAt || null,
      };
    }),
  };
}

async function listAttendanceHistory(user, options = {}) {
  const organizationId = await getOrganizationId(user, options.organizationId);
  const requestedPage = Number(options.page);
  const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLimit = Number(options.limit);
  const limit = Math.min(
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : HISTORY_PAGE_SIZE,
    HISTORY_PAGE_SIZE,
  );
  const filter = { organizationId };
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
      $or: [
        { name: pattern },
        { email: pattern },
        { department: pattern },
        { jobTitle: pattern },
      ],
    }).distinct('_id');
    filter.employeeId = { $in: employeeIds };
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

async function markAttendance(user, input = {}) {
  const organizationId = await getOrganizationId(user, input.organizationId);
  const { employeeId, date, status } = input;
  if (!mongoose.isValidObjectId(employeeId)) throw httpError(400, 'Invalid employee id.');
  if (!isValidDate(date)) throw httpError(400, 'Enter a valid attendance date.');
  if (user.role === 'organization' && date !== currentDateInTimeZone(input.timeZone)) {
    throw httpError(400, 'Organizations can only mark attendance for today.');
  }
  if (!ATTENDANCE_STATUSES.includes(status)) throw httpError(400, 'Select a valid attendance status.');

  const employeeFilter = { _id: employeeId, organizationId };
  if (user.role === 'organization') employeeFilter.status = 'active';
  const employee = await Employee.findOne(employeeFilter);
  if (!employee) throw httpError(404, 'Employee not found for this organization.');

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

module.exports = { listAttendance, listAttendanceHistory, markAttendance };