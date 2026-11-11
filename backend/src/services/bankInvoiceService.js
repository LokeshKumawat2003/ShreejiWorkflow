const mongoose = require('mongoose');
const BankInvoiceBatch = require('../models/BankInvoiceBatch');
const Location = require('../models/Location');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { calculateBankPayments, calculatePayrollWithDeductions, monthRange, parseLocationIds } = require('./payrollService');

const FORMATS = new Set(['pdf', 'excel', 'print']);
const KINDS = new Set(['bank', 'payroll']);
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PREVIEW_PAGE_SIZE = 10;
const MAX_PREVIEW_PAGE_SIZE = 100;

function requireAdmin(user) {
  if (user.role !== 'admin') throw httpError(403, 'Only admins can prepare payment documents.');
}

function requireKind(kind) {
  if (!KINDS.has(kind)) throw httpError(400, 'Unknown document type.');
}

/** Bank letters saved before `kind` existed have no value. */
function kindFilter(kind) {
  return kind === 'bank' ? { kind: { $ne: 'payroll' } } : { kind };
}

function batchKind(batch) {
  return batch.kind === 'payroll' ? 'payroll' : 'bank';
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function payrollReferencePrefix(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `PAYROLL/ ${MONTH_SHORT[monthNumber - 1]}-${year}/`;
}

function serializeBatch(batch) {
  return {
    id: String(batch._id),
    kind: batchKind(batch),
    month: batch.month,
    reference: batch.reference,
    referenceNumber: batch.referenceNumber,
    letterDate: batch.letterDate,
    chequeNumber: batch.chequeNumber,
    skipMissing: batch.skipMissing,
    format: batch.format,
    status: batch.status,
    partial: Boolean(batch.partial),
    employees: batch.employees,
    total: batch.total,
    locations: batch.locations.map((location) => ({
      organizationId: String(location.organizationId),
      locationId: String(location.locationId),
      organizationName: location.organizationName,
      locationName: location.locationName,
      employees: location.employees,
      total: location.total,
      status: batch.status === 'cancelled' || location.status === 'cancelled' ? 'cancelled' : 'printed',
      cancelledAt: location.cancelledAt || (batch.status === 'cancelled' ? batch.cancelledAt : null),
    })),
    createdAt: batch.createdAt,
    cancelledAt: batch.cancelledAt,
    activity: (batch.activity || [])
      .map((entry) => ({ action: entry.action, reprint: entry.reprint, locationName: entry.locationName || '', byName: entry.byName, at: entry.at }))
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()),
  };
}

function activityEntry(user, action, reprint = false, locationName = '') {
  return { action, reprint, locationName, by: user.id, byName: user.name || user.email || '', at: new Date() };
}

function isActiveLocation(location) {
  return location.status !== 'cancelled';
}

async function nextReferenceNumber(kind, month) {
  const batches = await BankInvoiceBatch.find({ month, ...kindFilter(kind) }).select('referenceNumber').lean();
  const highest = batches.reduce((max, batch) => {
    const number = Number.parseInt(batch.referenceNumber, 10);
    return Number.isSafeInteger(number) && number > max ? number : max;
  }, 0);
  return String(highest + 1).padStart(2, '0');
}

function groupByLocation(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.locationId) || {
      organizationId: row.organizationId,
      locationId: row.locationId,
      organizationName: row.organizationName,
      locationName: row.locationName,
      employees: 0,
      total: 0,
      missingBankDetails: 0,
    };
    group.employees += 1;
    group.total += row.amount;
    if (row.missingBankDetails) group.missingBankDetails += 1;
    groups.set(row.locationId, group);
  }
  return groups;
}

function parseEmployeeIds(value) {
  if (value === undefined || value === null || value === '') return null;
  const ids = [...new Set((Array.isArray(value) ? value : String(value).split(','))
    .map((id) => String(id).trim())
    .filter(Boolean))];
  if (ids.length > 2000) throw httpError(400, 'Select 2000 employees or fewer.');
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw httpError(400, 'Invalid employee id.');
  return ids.length > 0 ? new Set(ids) : null;
}

/** Full (not partial) printed batches; only their non-cancelled locations count as printed. */
async function printedBatchesFor(kind, month, locationIds) {
  const filter = { month, status: 'printed', partial: { $ne: true }, ...kindFilter(kind) };
  if (locationIds) filter.locations = { $elemMatch: { locationId: { $in: locationIds }, status: { $ne: 'cancelled' } } };
  return BankInvoiceBatch.find(filter).sort({ createdAt: 1 }).lean();
}

async function rejectPrinted(kind, month, locationIds) {
  const alreadyPrinted = await printedBatchesFor(kind, month, locationIds);
  if (alreadyPrinted.length === 0) return;
  const selected = new Set(locationIds);
  const names = alreadyPrinted
    .flatMap((batch) => batch.locations)
    .filter((location) => isActiveLocation(location) && selected.has(String(location.locationId)))
    .map((location) => location.locationName);
  throw httpError(409, `Already printed this month: ${[...new Set(names)].join(', ')}. Cancel that entry in the history first to print again.`);
}

/** Two admins printing the same location at once: the earlier batch wins and the later one is removed. */
async function keepEarliest(kind, batch) {
  const conflicts = await printedBatchesFor(kind, batch.month, batch.locations.map((location) => location.locationId));
  const isEarlier = (other) => other.createdAt < batch.createdAt
    || (other.createdAt.getTime() === batch.createdAt.getTime() && String(other._id) < String(batch._id));
  if (conflicts.some((other) => String(other._id) !== String(batch._id) && isEarlier(other))) {
    await BankInvoiceBatch.deleteOne({ _id: batch._id });
    throw httpError(409, 'Some of these locations were just printed by someone else. Refresh and try again.');
  }
}

/** Payroll of several locations, possibly from different organizations, merged into one response. */
async function locationsPayroll(user, month, locationIds) {
  const { fromDate, toDate } = monthRange(month);
  const locations = await Location.find({ _id: { $in: locationIds } }).lean();
  const organizations = await User.find({ role: 'organization', _id: { $in: locations.map((location) => location.organizationId) } })
    .select('_id organizationName name email')
    .lean();
  const organizationNames = new Map(organizations.map((organization) => [
    String(organization._id),
    organization.organizationName || organization.name || organization.email || '',
  ]));

  const results = await Promise.all(locations
    .filter((location) => organizationNames.has(String(location.organizationId)))
    .map(async (location) => ({
      location,
      payroll: await calculatePayrollWithDeductions(user, {
        organizationId: String(location.organizationId),
        locationId: String(location._id),
        fromDate,
        toDate,
        attendanceOnly: true,
      }),
    })));

  const lines = results
    .flatMap(({ location, payroll }) => payroll.lines.map((line) => ({
      ...line,
      organizationId: String(location.organizationId),
      organizationName: organizationNames.get(String(location.organizationId)) || line.organizationName,
      locationId: String(location._id),
      locationName: location.workName || location.name || '',
    })))
    .sort((left, right) => (
      left.organizationName.localeCompare(right.organizationName)
      || left.locationName.localeCompare(right.locationName)
      || left.employeeName.localeCompare(right.employeeName)
    ));

  const totals = new Map();
  const netTotals = new Map();
  const summary = { employees: lines.length, presentDays: 0, absentDays: 0, paidDays: 0 };
  for (const line of lines) {
    totals.set(line.currency, (totals.get(line.currency) || 0) + line.grossPay);
    netTotals.set(line.currency, (netTotals.get(line.currency) || 0) + (line.netPay ?? line.grossPay));
    summary.presentDays += line.presentDays;
    summary.absentDays += line.absentDays;
    summary.paidDays += line.paidDays;
  }
  summary.paidDays = round2(summary.paidDays);
  const [year, monthNumber] = month.split('-').map(Number);

  return {
    month,
    fromDate,
    toDate,
    periodLabel: `${MONTH_SHORT[monthNumber - 1]} ${year}`,
    paidStatuses: results[0]?.payroll.paidStatuses ?? ['present', 'half_day', 'paid_leave'],
    rates: results[0]?.payroll.rates,
    lines,
    summary,
    totals: [...totals.entries()].map(([currency, total]) => ({ currency, total: round2(total) })),
    netTotals: [...netTotals.entries()].map(([currency, total]) => ({ currency, total: round2(total) })),
  };
}

function payrollByLocation(lines) {
  const groups = new Map();
  for (const line of lines) {
    const group = groups.get(line.locationId) || {
      organizationId: line.organizationId,
      locationId: line.locationId,
      organizationName: line.organizationName,
      locationName: line.locationName,
      employees: 0,
      total: 0,
    };
    group.employees += 1;
    group.total = round2(group.total + (line.netPay ?? line.grossPay));
    groups.set(line.locationId, group);
  }
  return [...groups.values()];
}

/** Every location, grouped by organization, with this month's amount and whether it is already printed. */
async function listDocumentLocations(user, query = {}, kind = 'bank') {
  requireAdmin(user);
  requireKind(kind);
  monthRange(query.month);
  const [payments, locations, organizations, batches, nextReference] = await Promise.all([
    calculateBankPayments(user, { month: query.month }),
    Location.find().select('_id organizationId workName name status').lean(),
    User.find({ role: 'organization' }).select('_id organizationName name email').lean(),
    printedBatchesFor(kind, query.month),
    nextReferenceNumber(kind, query.month),
  ]);

  const amounts = groupByLocation(payments.rows);
  const printedBy = new Map();
  for (const batch of batches) {
    for (const location of batch.locations) {
      if (isActiveLocation(location)) printedBy.set(String(location.locationId), batch);
    }
  }

  const groups = new Map(organizations.map((organization) => [String(organization._id), {
    organizationId: String(organization._id),
    organizationName: organization.organizationName || organization.name || organization.email || '',
    locations: [],
  }]));

  for (const location of locations) {
    const group = groups.get(String(location.organizationId));
    if (!group) continue;
    const id = String(location._id);
    const amount = amounts.get(id);
    const batch = printedBy.get(id);
    if (!amount && !batch && location.status === 'disabled') continue;
    group.locations.push({
      locationId: id,
      locationName: location.workName || location.name || '',
      locationStatus: location.status,
      employees: amount ? amount.employees : 0,
      total: amount ? amount.total : 0,
      missingBankDetails: amount ? amount.missingBankDetails : 0,
      status: batch ? 'printed' : 'pending',
      batchId: batch ? String(batch._id) : null,
      reference: batch ? batch.reference : '',
      printedAt: batch ? batch.createdAt : null,
    });
  }

  const organizationList = [...groups.values()]
    .filter((group) => group.locations.length > 0)
    .map((group) => ({ ...group, locations: group.locations.sort((left, right) => left.locationName.localeCompare(right.locationName)) }))
    .sort((left, right) => left.organizationName.localeCompare(right.organizationName));

  const all = organizationList.flatMap((group) => group.locations);
  return {
    month: query.month,
    periodLabel: payments.periodLabel,
    referencePrefix: kind === 'payroll' ? payrollReferencePrefix(query.month) : payments.referencePrefix,
    nextReference,
    organizations: organizationList,
    summary: {
      locations: all.length,
      printed: all.filter((location) => location.status === 'printed').length,
      pending: all.filter((location) => location.status === 'pending' && location.employees > 0).length,
    },
  };
}

async function listDocumentBatches(user, query = {}, kind = 'bank') {
  requireAdmin(user);
  requireKind(kind);
  monthRange(query.month);
  const batches = await BankInvoiceBatch.find({ month: query.month, ...kindFilter(kind) }).sort({ createdAt: -1 }).lean();
  return { batches: batches.map(serializeBatch) };
}

function letterRows(payments, skipMissing) {
  return (skipMissing ? payments.rows.filter((row) => !row.missingBankDetails) : payments.rows)
    .map((row, index) => ({ ...row, serial: index + 1 }));
}

async function createBankBatch(user, body) {
  const { month } = body;
  const locationIds = parseLocationIds(body.locationIds);
  if (!locationIds || locationIds.length === 0) throw httpError(400, 'Select at least one location.');
  if (!isValidDate(body.letterDate)) throw httpError(400, 'Enter a valid letter date.');
  const format = FORMATS.has(body.format) ? body.format : 'pdf';
  const skipMissing = body.skipMissing !== false;
  await rejectPrinted('bank', month, locationIds);

  const payments = await calculateBankPayments(user, { month, locationIds });
  const rows = letterRows(payments, skipMissing);
  if (rows.length === 0) throw httpError(400, 'No payable employees in the selected locations.');

  const referenceNumber = cleanText(body.referenceNumber, 10) || await nextReferenceNumber('bank', month);
  const included = groupByLocation(rows);
  const locations = [...groupByLocation(payments.rows).values()].map((location) => ({
    organizationId: location.organizationId,
    locationId: location.locationId,
    organizationName: location.organizationName,
    locationName: location.locationName,
    employees: included.get(location.locationId)?.employees || 0,
    total: included.get(location.locationId)?.total || 0,
  }));

  const batch = await BankInvoiceBatch.create({
    kind: 'bank',
    month,
    reference: `${payments.referencePrefix} ${referenceNumber}`,
    referenceNumber,
    letterDate: body.letterDate,
    chequeNumber: cleanText(body.chequeNumber, 30),
    skipMissing,
    format,
    locations,
    employees: rows.length,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    createdBy: user.id,
    activity: [activityEntry(user, format)],
  });
  await keepEarliest('bank', batch);
  return { batch: serializeBatch(batch), ...payments, rows };
}

async function createPayrollBatch(user, body) {
  const { month } = body;
  const locationIds = parseLocationIds(body.locationIds);
  if (!locationIds || locationIds.length === 0) throw httpError(400, 'Select at least one location.');
  const format = FORMATS.has(body.format) ? body.format : 'pdf';
  const employeeIds = parseEmployeeIds(body.employeeIds);
  if (!employeeIds) await rejectPrinted('payroll', month, locationIds);

  const fullPayroll = await locationsPayroll(user, month, locationIds);
  const payroll = employeeIds ? onlyEmployees(fullPayroll, employeeIds) : fullPayroll;
  if (payroll.lines.length === 0) throw httpError(400, 'No employees with attendance in the selection.');
  const partial = payroll.lines.length < fullPayroll.lines.length;
  if (employeeIds && !partial) await rejectPrinted('payroll', month, locationIds);

  const referenceNumber = await nextReferenceNumber('payroll', month);
  const locations = payrollByLocation(payroll.lines);
  const batch = await BankInvoiceBatch.create({
    kind: 'payroll',
    month,
    reference: `${payrollReferencePrefix(month)} ${referenceNumber}`,
    referenceNumber,
    format,
    locations,
    partial,
    employeeIds: partial ? payroll.lines.map((line) => line.employeeId) : [],
    employees: payroll.lines.length,
    total: round2(locations.reduce((sum, location) => sum + location.total, 0)),
    createdBy: user.id,
    activity: [activityEntry(user, format)],
  });
  if (!partial) await keepEarliest('payroll', batch);
  return { batch: serializeBatch(batch), payroll };
}

/** Keeps only the chosen employees and recomputes the totals. */
function onlyEmployees(payroll, employeeIds) {
  const lines = payroll.lines.filter((line) => employeeIds.has(String(line.employeeId)));
  const totals = new Map();
  const netTotals = new Map();
  const summary = { employees: lines.length, presentDays: 0, absentDays: 0, paidDays: 0 };
  for (const line of lines) {
    totals.set(line.currency, (totals.get(line.currency) || 0) + line.grossPay);
    netTotals.set(line.currency, (netTotals.get(line.currency) || 0) + (line.netPay ?? line.grossPay));
    summary.presentDays += line.presentDays;
    summary.absentDays += line.absentDays;
    summary.paidDays += line.paidDays;
  }
  summary.paidDays = round2(summary.paidDays);
  return {
    ...payroll,
    lines,
    summary,
    totals: [...totals.entries()].map(([currency, total]) => ({ currency, total: round2(total) })),
    netTotals: [...netTotals.entries()].map(([currency, total]) => ({ currency, total: round2(total) })),
  };
}

async function createDocumentBatch(user, body = {}, kind = 'bank') {
  requireAdmin(user);
  requireKind(kind);
  monthRange(body.month);
  return kind === 'payroll' ? createPayrollBatch(user, body) : createBankBatch(user, body);
}

async function findBatch(id, kind) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid id.');
  const batch = await BankInvoiceBatch.findById(id);
  if (!batch || batchKind(batch) !== kind) throw httpError(404, 'Not found.');
  return batch;
}

async function getDocumentBatch(user, id, kind = 'bank') {
  requireAdmin(user);
  requireKind(kind);
  const batch = await findBatch(id, kind);
  const active = batch.locations.filter(isActiveLocation);
  const locationIds = (active.length > 0 ? active : batch.locations).map((location) => String(location.locationId));
  if (kind === 'payroll') {
    const payroll = await locationsPayroll(user, batch.month, locationIds);
    return {
      batch: serializeBatch(batch),
      payroll: batch.partial ? onlyEmployees(payroll, new Set(batch.employeeIds.map(String))) : payroll,
    };
  }
  const payments = await calculateBankPayments(user, { month: batch.month, locationIds });
  return { batch: serializeBatch(batch), ...payments, rows: letterRows(payments, batch.skipMissing) };
}

/** Cancels one location of a batch (or every location when none is given); the batch is cancelled once all are. */
async function cancelDocumentBatch(user, id, body = {}, kind = 'bank') {
  requireAdmin(user);
  requireKind(kind);
  const batch = await findBatch(id, kind);
  if (batch.status === 'cancelled') return { batch: serializeBatch(batch) };

  const now = new Date();
  const locationId = body.locationId ? String(body.locationId) : '';
  const targets = locationId
    ? batch.locations.filter((location) => String(location.locationId) === locationId)
    : batch.locations.filter(isActiveLocation);
  if (locationId && targets.length === 0) throw httpError(404, 'That location is not on this entry.');

  for (const location of targets) {
    if (!isActiveLocation(location)) continue;
    location.status = 'cancelled';
    location.cancelledAt = now;
    batch.activity.push(activityEntry(user, 'cancel', false, location.locationName));
  }
  if (batch.locations.every((location) => !isActiveLocation(location))) {
    batch.status = 'cancelled';
    batch.cancelledAt = now;
  }
  await batch.save();
  return { batch: serializeBatch(batch) };
}

async function logDocumentActivity(user, id, body = {}, kind = 'bank') {
  requireAdmin(user);
  requireKind(kind);
  if (!FORMATS.has(body.action)) throw httpError(400, 'Choose PDF, Excel or Print.');
  const batch = await findBatch(id, kind);
  batch.activity.push(activityEntry(user, body.action, true));
  await batch.save();
  return { batch: serializeBatch(batch) };
}

/** Payroll preview for the locations ticked on the Payroll page, one page at a time. */
async function previewLocationsPayroll(user, query = {}) {
  requireAdmin(user);
  monthRange(query.month);
  const locationIds = parseLocationIds(query.locationIds);
  if (!locationIds || locationIds.length === 0) throw httpError(400, 'Select at least one location.');
  const payroll = await locationsPayroll(user, query.month, locationIds);
  if (query.page === undefined) return payroll;
  const limit = Math.min(positiveInteger(query.limit, PREVIEW_PAGE_SIZE), MAX_PREVIEW_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(payroll.lines.length / limit));
  const page = Math.min(positiveInteger(query.page, 1), totalPages);
  return {
    ...payroll,
    lines: payroll.lines.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: payroll.lines.length, totalPages },
  };
}

module.exports = {
  cancelDocumentBatch,
  createDocumentBatch,
  getDocumentBatch,
  listDocumentBatches,
  listDocumentLocations,
  logDocumentActivity,
  previewLocationsPayroll,
};
