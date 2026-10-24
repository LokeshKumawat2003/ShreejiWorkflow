const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');
const { getDocumentSettings } = require('./documentSettingsService');

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
      skillCategory: employee.skillCategory || '',
      parentName: employee.parentName || '',
      basicPay: Number(employee.basicPay) || 0,
      dearnessAllowance: Number(employee.dearnessAllowance) || 0,
      epfoApplicable: Boolean(employee.epfoApplicable),
      esicApplicable: Boolean(employee.esicApplicable),
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
    (!options.attendanceOnly || attendanceByEmployee.has(line.employeeId))
    && (!selectedIds || selectedIds.has(line.employeeId))
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

const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rate(settings, field) {
  const value = Number(settings[field]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Builds one FORM XVII row; deductions stay unrounded so the net matches the paper register. */
function wageRegisterRow(line, rates) {
  const dailyWage = line.dailySalary > 0 ? line.dailySalary : round2(line.basicPay + line.dearnessAllowance);
  const workingDays = line.presentDays;
  const wages = round2(dailyWage * workingDays);
  const bonus = wages * (rates.bonusRate / 100);
  const totalWages = wages + bonus;
  const epfBase = rates.epfWageCeiling > 0 ? Math.min(wages, rates.epfWageCeiling) : wages;
  const epf = line.epfoApplicable ? epfBase * (rates.epfRate / 100) : 0;
  const esi = line.esicApplicable ? wages * (rates.esiRate / 100) : 0;
  return {
    employeeId: line.employeeId,
    employeeName: line.employeeName,
    parentName: line.parentName,
    post: line.skillCategory || line.designation,
    workingDays,
    dailyWage,
    wages,
    bonus: round2(bonus),
    totalWages: round2(totalWages),
    epf: Math.round(epf),
    esi: Math.round(esi),
    grossPayment: Math.round(totalWages - epf - esi),
    raw: { bonus, totalWages, epf, esi },
  };
}

async function calculateWageRegister(user, options = {}) {
  const month = typeof options.month === 'string' ? options.month : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw httpError(400, 'Select a valid month.');
  if (!options.locationId) throw httpError(400, 'Select a location for the wage register.');
  const organizationId = await resolveOrganizationId(user, options.organizationId);
  if (!organizationId) throw httpError(400, 'A valid organization id is required for location payroll.');
  if (!mongoose.isValidObjectId(options.locationId)) throw httpError(400, 'Invalid location id.');

  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const fromDate = `${month}-01`;
  const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const [payroll, location, organization, settings] = await Promise.all([
    calculatePayroll(user, { organizationId, locationId: options.locationId, fromDate, toDate }),
    Location.findOne({ _id: options.locationId, organizationId }).lean(),
    User.findOne({ _id: organizationId, role: 'organization' }).select('organizationName').lean(),
    getDocumentSettings('wageRegister'),
  ]);
  if (!location) throw httpError(404, 'Location not found for this organization.');

  const rates = {
    bonusRate: rate(settings, 'bonusRate'),
    epfRate: rate(settings, 'epfRate'),
    epfWageCeiling: rate(settings, 'epfWageCeiling'),
    esiRate: rate(settings, 'esiRate'),
  };
  const nameCounts = new Map();
  for (const line of payroll.lines) {
    const key = line.employeeName.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  const rows = payroll.lines.map((line, index) => {
    const { raw, ...row } = wageRegisterRow(line, rates);
    return {
      ...row,
      serial: index + 1,
      showParentName: Boolean(row.parentName) && nameCounts.get(line.employeeName.trim().toLowerCase()) > 1,
      _raw: raw,
    };
  });

  const totals = rows.reduce((sum, row) => ({
    workingDays: sum.workingDays + row.workingDays,
    wages: sum.wages + row.wages,
    bonus: sum.bonus + row._raw.bonus,
    totalWages: sum.totalWages + row._raw.totalWages,
    epf: sum.epf + row._raw.epf,
    esi: sum.esi + row._raw.esi,
    grossPayment: sum.grossPayment + row.grossPayment,
  }), { workingDays: 0, wages: 0, bonus: 0, totalWages: 0, epf: 0, esi: 0, grossPayment: 0 });
  const publicRows = rows.map(({ _raw, ...row }) => row);

  const limit = Math.min(positiveInteger(options.limit, publicRows.length || 1), MAX_PAYROLL_PAGE_SIZE);
  const totalPages = options.page === undefined ? 1 : Math.max(1, Math.ceil(publicRows.length / limit));
  const page = options.page === undefined ? 1 : Math.min(positiveInteger(options.page, 1), totalPages);

  return {
    month,
    fromDate,
    toDate,
    periodLabel: `${MONTH_NAMES[monthNumber - 1]}-${year}`,
    header: {
      title: settings.title,
      formTitle: settings.formTitle,
      contractorName: settings.contractorName,
      note: settings.note,
      signatoryCompany: settings.signatoryCompany,
      signatoryTitle: settings.signatoryTitle,
      signatureImage: settings.signatureImage,
      organizationName: organization?.organizationName || '',
      workName: location.workName || '',
      address: location.address || location.name || '',
      loaReference: location.loaReference || '',
      opNumber: location.opNumber || '',
    },
    rates,
    rows: options.page === undefined ? publicRows : publicRows.slice((page - 1) * limit, page * limit),
    totals: {
      employees: rows.length,
      workingDays: totals.workingDays,
      wages: round2(totals.wages),
      bonus: Math.round(totals.bonus),
      totalWages: Math.round(totals.totalWages),
      epf: Math.round(totals.epf),
      esi: Math.round(totals.esi),
      grossPayment: totals.grossPayment,
    },
    pagination: { page, limit: options.page === undefined ? publicRows.length : limit, total: publicRows.length, totalPages },
  };
}

function monthRange(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw httpError(400, 'Select a valid month.');
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { year, monthNumber, fromDate: `${month}-01`, toDate: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** Bank transfer list for a month: one row per paid employee, amount = FORM XVII net payment (column N). */
async function calculateBankPayments(user, options = {}) {
  if (user.role !== 'admin') throw httpError(403, 'Only admins can prepare bank payment letters.');
  const { year, monthNumber, fromDate, toDate } = monthRange(options.month);
  if (options.locationId && !options.organizationId) throw httpError(400, 'Select an organization for this location.');

  const organizationId = await resolveOrganizationId(user, options.organizationId);
  if (options.locationId && !mongoose.isValidObjectId(options.locationId)) throw httpError(400, 'Invalid location id.');
  const locationFilter = {};
  if (organizationId) locationFilter.organizationId = organizationId;
  if (options.locationId) locationFilter._id = options.locationId;

  const [locations, organizations, wageSettings, letter] = await Promise.all([
    Location.find(locationFilter).lean(),
    User.find({ role: 'organization', ...(organizationId ? { _id: organizationId } : {}) }).select('_id organizationName').lean(),
    getDocumentSettings('wageRegister'),
    getDocumentSettings('bankLetter'),
  ]);
  if (options.locationId && locations.length === 0) throw httpError(404, 'Location not found for this organization.');
  const rates = {
    bonusRate: rate(wageSettings, 'bonusRate'),
    epfRate: rate(wageSettings, 'epfRate'),
    epfWageCeiling: rate(wageSettings, 'epfWageCeiling'),
    esiRate: rate(wageSettings, 'esiRate'),
  };
  const organizationNames = new Map(organizations.map((organization) => [String(organization._id), organization.organizationName || '']));

  // Same employees and amounts as each location's FORM XVII register (column N).
  const registers = await Promise.all(locations
    .filter((location) => organizationNames.has(String(location.organizationId)))
    .map(async (location) => {
      const payroll = await calculatePayroll(user, {
        organizationId: String(location.organizationId),
        locationId: String(location._id),
        fromDate,
        toDate,
      });
      return payroll.lines.map((line) => ({ line, location, amount: wageRegisterRow(line, rates).grossPayment }));
    }));

  const allRows = registers
    .flat()
    .filter(({ amount }) => amount > 0)
    .sort((left, right) => (
      (organizationNames.get(String(left.location.organizationId)) || '').localeCompare(organizationNames.get(String(right.location.organizationId)) || '')
      || (left.location.workName || left.location.name || '').localeCompare(right.location.workName || right.location.name || '')
      || left.line.employeeName.localeCompare(right.line.employeeName)
    ))
    .map(({ line, location, amount }, index) => ({
      serial: index + 1,
      employeeId: line.employeeId,
      employeeName: line.employeeName,
      organizationName: organizationNames.get(String(location.organizationId)) || '',
      locationName: location.workName || location.name || '',
      designation: line.designation,
      workingDays: line.presentDays,
      accountHolder: line.bankAccountHolder,
      accountNumber: line.bankAccountNumber,
      ifsc: line.bankRoutingCode,
      bankName: line.bankName,
      bankBranch: line.bankBranch,
      amount,
      missingBankDetails: !line.bankAccountNumber || !line.bankRoutingCode || !line.bankName,
    }));

  const search = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : '';
  const pattern = search ? new RegExp(escapeRegex(search), 'i') : null;
  const rows = pattern
    ? allRows.filter((row) => [row.employeeName, row.accountNumber, row.ifsc, row.bankName, row.organizationName, row.locationName].some((value) => pattern.test(value || '')))
    : allRows;

  const summary = {
    employees: rows.length,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    missingBankDetails: rows.filter((row) => row.missingBankDetails).length,
    banks: new Set(rows.map((row) => row.bankName.trim().toUpperCase()).filter(Boolean)).size,
  };

  const monthLabel = `${MONTH_NAMES[monthNumber - 1].slice(0, 3)}-${year}`;
  const result = {
    month: options.month,
    fromDate,
    toDate,
    periodLabel: `${MONTH_NAMES[monthNumber - 1]}-${year}`,
    referencePrefix: `${letter.refPrefix}/ ${monthLabel}/`,
    letter,
    rows,
    summary,
  };
  if (options.page === undefined) return result;
  const limit = Math.min(positiveInteger(options.limit, PAYROLL_PAGE_SIZE), MAX_PAYROLL_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const page = Math.min(positiveInteger(options.page, 1), totalPages);
  return { ...result, rows: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: rows.length, totalPages } };
}

module.exports = { calculateBankPayments, calculatePayroll, calculateWageRegister, wageRegisterRow };