const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');

const PAYROLL_PAGE_SIZE = 10;
const MAX_PAYROLL_PAGE_SIZE = 100;

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function parseEmployeeIds(value) {
  if (value === undefined || value === null || value === '') return null;
  const ids = (Array.isArray(value) ? value : String(value).split(','))
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (ids.length > 1000) throw httpError(400, 'Select 1000 employees or fewer.');
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw httpError(400, 'Invalid employee id.');
  return new Set(ids);
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function resolveOrganizationId(user, requestedId) {
  if (user.role !== 'admin') return user.id;
  if (!requestedId) return null;
  if (!mongoose.isValidObjectId(requestedId)) throw httpError(400, 'A valid organization id is required.');
  const organization = await User.findOne({ _id: requestedId, role: 'organization' });
  if (!organization) throw httpError(404, 'Organization not found.');
  return organization.id;
}

async function calculatePayroll(user, options = {}) {
  const organizationId = await resolveOrganizationId(user, options.organizationId);
  let locationEmployeeIds;
  if (options.locationId) {
    if (!organizationId) throw httpError(400, 'A valid organization id is required for location payroll.');
    if (!mongoose.isValidObjectId(options.locationId)) throw httpError(400, 'Invalid location id.');
    const location = await Location.findOne({ _id: options.locationId, organizationId });
    if (!location) throw httpError(404, 'Location not found for this organization.');
    locationEmployeeIds = await Employee.find({
      organizationId,
      locationId: options.locationId,
      designation: new RegExp(`^${escapeRegex(location.designation)}$`, 'i'),
    }).distinct('_id');
  }
  const { fromDate, toDate } = options;
  if (!isValidDate(fromDate) || !isValidDate(toDate)) {
    throw httpError(400, 'Enter a valid payroll date range.');
  }
  if (fromDate > toDate) throw httpError(400, 'The start date must be on or before the end date.');

  const attendanceFilter = { date: { $gte: fromDate, $lte: toDate } };
  if (organizationId) attendanceFilter.organizationId = organizationId;
  if (locationEmployeeIds) attendanceFilter.employeeId = { $in: locationEmployeeIds };
  const attendance = await Attendance.find(attendanceFilter).lean();
  const attendanceEmployeeIds = [...new Set(attendance.map(({ employeeId }) => String(employeeId)))];
  const employeeConditions = locationEmployeeIds
    ? [{ _id: { $in: locationEmployeeIds }, organizationId }]
    : organizationId ? [{ organizationId }] : [{ organizationId: { $ne: null } }];
  if (attendanceEmployeeIds.length > 0) employeeConditions.push({ _id: { $in: attendanceEmployeeIds } });
  const employees = await Employee.find({ $or: employeeConditions }).lean();
  const organizationDetailsById = new Map();
  if (user.role === 'admin' && !organizationId) {
    const organizations = await User.find({ role: 'organization' })
      .select('_id organizationName phone address website')
      .lean();
    for (const organization of organizations) {
      organizationDetailsById.set(String(organization._id), organization);
    }
  }
  const attendanceByEmployee = new Map();

  for (const record of attendance) {
    const employeeId = String(record.employeeId);
    const counts = attendanceByEmployee.get(employeeId) || { present: 0, absent: 0 };
    const status = record.status === 'present' ? 'present' : 'absent';
    counts[status] += 1;
    attendanceByEmployee.set(employeeId, counts);
  }

  const lines = employees.map((employee) => {
    const counts = attendanceByEmployee.get(String(employee._id)) || { present: 0, absent: 0 };
    const paidDays = counts.present;
    const dailySalary = Number(employee.dailySalary) || 0;
    const currency = !employee.currency || employee.currency === 'NRI' ? 'INR' : employee.currency;
    const grossPay = Math.round((dailySalary * paidDays + Number.EPSILON) * 100) / 100;
    const organization = organizationDetailsById.get(String(employee.organizationId)) || {};
    return {
      employeeId: String(employee._id),
      employeeName: employee.name,
      employeeEmail: employee.email,
      employeePhone: employee.phone || '',
      employeeCreatedAt: employee.createdAt || null,
      bankName: employee.bankName || '',
      bankBranch: employee.bankBranch || '',
      bankAccountHolder: employee.bankAccountHolder || '',
      bankAccountNumber: employee.bankAccountNumber
        ? user.role === 'admin' ? String(employee.bankAccountNumber) : `**** ${String(employee.bankAccountNumber).slice(-4)}`
        : '',
      bankRoutingCode: employee.bankRoutingCode || '',
      organizationName: organization.organizationName || '',
      organizationPhone: organization.phone || '',
      organizationAddress: organization.address || '',
      organizationWebsite: organization.website || '',
      designation: employee.designation || '',
      department: employee.department || '',
      jobTitle: employee.jobTitle || '',
      currency,
      dailySalary,
      presentDays: counts.present,
      absentDays: counts.absent,
      paidDays,
      grossPay,
    };
  }).sort((left, right) => left.employeeName.localeCompare(right.employeeName));

  const selectedIds = parseEmployeeIds(options.employeeIds);
  const search = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : '';
  const pattern = search ? new RegExp(escapeRegex(search), 'i') : null;
  const matchingLines = lines.filter((line) => (
    (!selectedIds || selectedIds.has(line.employeeId))
    && (!pattern || [line.employeeName, line.employeeEmail, line.designation, line.organizationName].some((value) => pattern.test(value || '')))
  ));

  const totalsByCurrency = new Map();
  const summary = { employees: matchingLines.length, presentDays: 0, absentDays: 0, paidDays: 0 };
  for (const line of matchingLines) {
    totalsByCurrency.set(line.currency, (totalsByCurrency.get(line.currency) || 0) + line.grossPay);
    summary.presentDays += line.presentDays;
    summary.absentDays += line.absentDays;
    summary.paidDays += line.paidDays;
  }

  const result = {
    fromDate,
    toDate,
    paidStatuses: ['present'],
    lines: matchingLines,
    summary,
    totals: [...totalsByCurrency.entries()].map(([currency, total]) => ({
      currency,
      total: Math.round((total + Number.EPSILON) * 100) / 100,
    })),
  };

  if (options.page === undefined) return result;
  const limit = Math.min(positiveInteger(options.limit, PAYROLL_PAGE_SIZE), MAX_PAYROLL_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(matchingLines.length / limit));
  const page = Math.min(positiveInteger(options.page, 1), totalPages);
  return {
    ...result,
    lines: matchingLines.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: matchingLines.length, totalPages },
  };
}

module.exports = { calculatePayroll };