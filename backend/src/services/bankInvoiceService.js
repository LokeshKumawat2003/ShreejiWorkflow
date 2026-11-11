const mongoose = require('mongoose');
const BankInvoiceBatch = require('../models/BankInvoiceBatch');
const Location = require('../models/Location');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { calculateBankPayments, monthRange, parseLocationIds } = require('./payrollService');

const FORMATS = new Set(['pdf', 'excel', 'print']);

function requireAdmin(user) {
  if (user.role !== 'admin') throw httpError(403, 'Only admins can prepare bank payment letters.');
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function serializeBatch(batch) {
  return {
    id: String(batch._id),
    month: batch.month,
    reference: batch.reference,
    referenceNumber: batch.referenceNumber,
    letterDate: batch.letterDate,
    chequeNumber: batch.chequeNumber,
    skipMissing: batch.skipMissing,
    format: batch.format,
    status: batch.status,
    employees: batch.employees,
    total: batch.total,
    locations: batch.locations.map((location) => ({
      organizationId: String(location.organizationId),
      locationId: String(location.locationId),
      organizationName: location.organizationName,
      locationName: location.locationName,
      employees: location.employees,
      total: location.total,
    })),
    createdAt: batch.createdAt,
    cancelledAt: batch.cancelledAt,
    activity: (batch.activity || [])
      .map((entry) => ({ action: entry.action, reprint: entry.reprint, byName: entry.byName, at: entry.at }))
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()),
  };
}

function activityEntry(user, action, reprint = false) {
  return { action, reprint, by: user.id, byName: user.name || user.email || '', at: new Date() };
}

async function nextReferenceNumber(month) {
  const batches = await BankInvoiceBatch.find({ month }).select('referenceNumber').lean();
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

async function printedBatchesFor(month, locationIds) {
  const filter = { month, status: 'printed' };
  if (locationIds) filter['locations.locationId'] = { $in: locationIds };
  return BankInvoiceBatch.find(filter).sort({ createdAt: 1 }).lean();
}

/** Every location, grouped by organization, with this month's amount and whether it is already on a printed letter. */
async function listBankInvoiceLocations(user, query = {}) {
  requireAdmin(user);
  monthRange(query.month);
  const [payments, locations, organizations, batches, nextReference] = await Promise.all([
    calculateBankPayments(user, { month: query.month }),
    Location.find().select('_id organizationId workName name status').lean(),
    User.find({ role: 'organization' }).select('_id organizationName name email').lean(),
    printedBatchesFor(query.month),
    nextReferenceNumber(query.month),
  ]);

  const amounts = groupByLocation(payments.rows);
  const printedBy = new Map();
  for (const batch of batches) {
    for (const location of batch.locations) printedBy.set(String(location.locationId), batch);
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
    referencePrefix: payments.referencePrefix,
    nextReference,
    organizations: organizationList,
    summary: {
      locations: all.length,
      printed: all.filter((location) => location.status === 'printed').length,
      pending: all.filter((location) => location.status === 'pending' && location.employees > 0).length,
    },
  };
}

async function listBankInvoiceBatches(user, query = {}) {
  requireAdmin(user);
  monthRange(query.month);
  const batches = await BankInvoiceBatch.find({ month: query.month }).sort({ createdAt: -1 }).lean();
  return { batches: batches.map(serializeBatch) };
}

function letterRows(payments, skipMissing) {
  return (skipMissing ? payments.rows.filter((row) => !row.missingBankDetails) : payments.rows)
    .map((row, index) => ({ ...row, serial: index + 1 }));
}

async function createBankInvoiceBatch(user, body = {}) {
  requireAdmin(user);
  const { month } = body;
  monthRange(month);
  const locationIds = parseLocationIds(body.locationIds);
  if (!locationIds || locationIds.length === 0) throw httpError(400, 'Select at least one location.');
  if (!isValidDate(body.letterDate)) throw httpError(400, 'Enter a valid letter date.');
  const format = FORMATS.has(body.format) ? body.format : 'pdf';
  const skipMissing = body.skipMissing !== false;

  const alreadyPrinted = await printedBatchesFor(month, locationIds);
  if (alreadyPrinted.length > 0) {
    const selected = new Set(locationIds);
    const names = alreadyPrinted
      .flatMap((batch) => batch.locations)
      .filter((location) => selected.has(String(location.locationId)))
      .map((location) => location.locationName);
    throw httpError(409, `Already printed this month: ${[...new Set(names)].join(', ')}. Cancel that letter first to print again.`);
  }

  const payments = await calculateBankPayments(user, { month, locationIds });
  const rows = letterRows(payments, skipMissing);
  if (rows.length === 0) throw httpError(400, 'No payable employees in the selected locations.');

  const referenceNumber = cleanText(body.referenceNumber, 10) || await nextReferenceNumber(month);
  const reference = `${payments.referencePrefix} ${referenceNumber}`;
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
    month,
    reference,
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

  // Two admins printing the same location at once: the earlier batch wins.
  const conflicts = await printedBatchesFor(month, locations.map((location) => location.locationId));
  const isEarlier = (other) => other.createdAt < batch.createdAt
    || (other.createdAt.getTime() === batch.createdAt.getTime() && String(other._id) < String(batch._id));
  if (conflicts.some((other) => String(other._id) !== String(batch._id) && isEarlier(other))) {
    await BankInvoiceBatch.deleteOne({ _id: batch._id });
    throw httpError(409, 'Some of these locations were just printed by someone else. Refresh and try again.');
  }

  return { batch: serializeBatch(batch), ...payments, rows };
}

async function findBatch(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid bank invoice id.');
  const batch = await BankInvoiceBatch.findById(id);
  if (!batch) throw httpError(404, 'Bank invoice not found.');
  return batch;
}

async function getBankInvoiceBatch(user, id) {
  requireAdmin(user);
  const batch = await findBatch(id);
  const payments = await calculateBankPayments(user, {
    month: batch.month,
    locationIds: batch.locations.map((location) => String(location.locationId)),
  });
  return { batch: serializeBatch(batch), ...payments, rows: letterRows(payments, batch.skipMissing) };
}

async function cancelBankInvoiceBatch(user, id) {
  requireAdmin(user);
  const batch = await findBatch(id);
  if (batch.status !== 'cancelled') {
    batch.status = 'cancelled';
    batch.cancelledAt = new Date();
    batch.activity.push(activityEntry(user, 'cancel'));
    await batch.save();
  }
  return { batch: serializeBatch(batch) };
}

async function logBankInvoiceActivity(user, id, body = {}) {
  requireAdmin(user);
  if (!FORMATS.has(body.action)) throw httpError(400, 'Choose PDF, Excel or Print.');
  const batch = await findBatch(id);
  batch.activity.push(activityEntry(user, body.action, true));
  await batch.save();
  return { batch: serializeBatch(batch) };
}

module.exports = {
  cancelBankInvoiceBatch,
  createBankInvoiceBatch,
  getBankInvoiceBatch,
  listBankInvoiceBatches,
  listBankInvoiceLocations,
  logBankInvoiceActivity,
};
