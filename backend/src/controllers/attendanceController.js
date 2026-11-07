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
  bankPayments,
  bulk,
  history,
  list,
  mark,
  parse,
  parseMonth,
  payroll,
  register,
  saveSymbols,
  symbols,
  uploadFile,
  wageRegister,
};