const mongoose = require('mongoose');
const AttendanceSheetDraft = require('../models/AttendanceSheetDraft');
const Location = require('../models/Location');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');

const SHEET_MARKS = new Set(['P', 'A', 'HD', 'L', 'PL', 'CL', 'SL', 'WO', 'H', '']);
const MAX_EMPLOYEES = 1000;

async function resolveSheetScope(user, input) {
  const month = typeof input.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) ? input.month : '';
  if (!month) throw httpError(400, 'Select a valid sheet month.');
  if (!mongoose.isValidObjectId(input.locationId)) throw httpError(400, 'A valid location id is required.');

  let organizationId = user.id;
  if (user.role === 'admin') {
    if (!mongoose.isValidObjectId(input.organizationId)) throw httpError(400, 'A valid organization id is required.');
    const organization = await User.exists({ _id: input.organizationId, role: 'organization' });
    if (!organization) throw httpError(404, 'Organization not found.');
    organizationId = String(input.organizationId);
  }

  const location = await Location.exists({ _id: input.locationId, organizationId });
  if (!location) throw httpError(404, 'Location not found for this organization.');
  return { organizationId, locationId: String(input.locationId), month };
}

function sanitizeMarks(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw httpError(400, 'Sheet marks must be an object.');
  const entries = Object.entries(input);
  if (entries.length > MAX_EMPLOYEES) throw httpError(400, 'Too many employees in this sheet.');

  const marks = {};
  for (const [employeeId, days] of entries) {
    if (!mongoose.isValidObjectId(employeeId)) throw httpError(400, 'Sheet contains an invalid employee id.');
    if (!Array.isArray(days) || days.length > 31 || days.some((mark) => !SHEET_MARKS.has(mark))) {
      throw httpError(400, 'Sheet contains an invalid attendance mark.');
    }
    marks[employeeId] = days;
  }
  return marks;
}

function publicSheet(sheet, scope) {
  return {
    ...scope,
    marks: sheet?.marks || {},
    updatedAt: sheet?.updatedAt || null,
  };
}

async function getAttendanceSheet(user, input = {}) {
  const scope = await resolveSheetScope(user, input);
  const sheet = await AttendanceSheetDraft.findOne(scope).lean();
  return publicSheet(sheet, scope);
}

async function saveAttendanceSheet(user, input = {}) {
  const scope = await resolveSheetScope(user, input);
  const marks = sanitizeMarks(input.marks);
  const sheet = await AttendanceSheetDraft.findOneAndUpdate(
    scope,
    { $set: { marks, updatedBy: user.id } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean();
  return publicSheet(sheet, scope);
}

async function clearAttendanceSheet(user, input = {}) {
  const scope = await resolveSheetScope(user, input);
  await AttendanceSheetDraft.deleteOne(scope);
  return publicSheet(null, scope);
}

module.exports = { clearAttendanceSheet, getAttendanceSheet, saveAttendanceSheet };
