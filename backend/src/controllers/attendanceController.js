const {
  bulkMarkAttendance,
  getAttendanceRegister,
  getAttendanceSymbols,
  getAttendanceUploadFile,
  listAttendance,
  listAttendanceHistory,
  markAttendance,
  parseAttendanceMonth,
  parseAttendanceSheet,
  updateAttendanceSymbols,
} = require('../services/attendanceService');
const {
  cancelDocumentBatch,
  createDocumentBatch,
  getDocumentBatch,
  listDocumentBatches,
  listDocumentLocations,
  logDocumentActivity,
  previewLocationsPayroll,
} = require('../services/bankInvoiceService');
const { clearAttendanceSheet, getAttendanceSheet, saveAttendanceSheet } = require('../services/attendanceSheetService');
const { calculateBankPayments, calculatePayrollWithDeductions, calculateWageRegister } = require('../services/payrollService');

async function list(req, res) {
  return res.json(await listAttendance(req.user, req.query));
}

async function mark(req, res) {
  const attendance = await markAttendance(req.user, req.body || {});
  return res.json({ attendance });
}

async function history(req, res) {
  return res.json(await listAttendanceHistory(req.user, req.query));
}

async function payroll(req, res) {
  return res.json(await calculatePayrollWithDeductions(req.user, { ...req.query, attendanceOnly: true }));
}

async function wageRegister(req, res) {
  return res.json(await calculateWageRegister(req.user, req.query));
}

async function bankPayments(req, res) {
  return res.json(await calculateBankPayments(req.user, req.query));
}

/** Handlers shared by bank letters and payroll runs; `kind` keeps their printed status separate. */
function documentHandlers(kind) {
  return {
    locations: async (req, res) => res.json(await listDocumentLocations(req.user, req.query, kind)),
    batches: async (req, res) => res.json(await listDocumentBatches(req.user, req.query, kind)),
    create: async (req, res) => res.status(201).json(await createDocumentBatch(req.user, req.body || {}, kind)),
    get: async (req, res) => res.json(await getDocumentBatch(req.user, req.params.id, kind)),
    cancel: async (req, res) => res.json(await cancelDocumentBatch(req.user, req.params.id, req.body || {}, kind)),
    activity: async (req, res) => res.json(await logDocumentActivity(req.user, req.params.id, req.body || {}, kind)),
  };
}

const bankInvoiceHandlers = documentHandlers('bank');
const payrollRunHandlers = {
  ...documentHandlers('payroll'),
  preview: async (req, res) => res.json(await previewLocationsPayroll(req.user, req.query)),
};

async function parse(req, res) {
  return res.json(await parseAttendanceSheet(req.user, {
    ...(req.body || {}),
    file: req.file,
  }));
}

async function parseMonth(req, res) {
  return res.json(await parseAttendanceMonth(req.user, {
    ...(req.body || {}),
    file: req.file,
  }));
}

async function bulk(req, res) {
  return res.json(await bulkMarkAttendance(req.user, req.body || {}));
}

async function register(req, res) {
  return res.json(await getAttendanceRegister(req.user, req.query));
}

async function sheet(req, res) {
  return res.json(await getAttendanceSheet(req.user, req.query));
}

async function saveSheet(req, res) {
  return res.json(await saveAttendanceSheet(req.user, req.body || {}));
}

async function clearSheet(req, res) {
  return res.json(await clearAttendanceSheet(req.user, req.query));
}

async function symbols(req, res) {
  return res.json(await getAttendanceSymbols(req.user));
}

async function saveSymbols(req, res) {
  return res.json(await updateAttendanceSymbols(req.user, req.body || {}));
}

const INLINE_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

async function uploadFile(req, res) {
  const file = await getAttendanceUploadFile(req.user, req.params.id);
  const inline = INLINE_UPLOAD_TYPES.has(file.mimeType);
  res.set('Content-Type', inline ? file.mimeType : 'application/octet-stream');
  res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${file.fileName.replace(/[^\w.-]/g, '_')}"`);
  return res.send(file.buffer);
}

module.exports = {
  bankInvoiceHandlers,
  bankPayments,
  bulk,
  payrollRunHandlers,
  clearSheet,
  history,
  list,
  mark,
  parse,
  parseMonth,
  payroll,
  register,
  saveSheet,
  saveSymbols,
  sheet,
  symbols,
  uploadFile,
  wageRegister,
};