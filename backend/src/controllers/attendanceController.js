const {
  bulkMarkAttendance,
  getAttendanceRegister,
  listAttendance,
  listAttendanceHistory,
  markAttendance,
  parseAttendanceMonth,
  parseAttendanceSheet,
} = require('../services/attendanceService');
const { calculatePayroll } = require('../services/payrollService');

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
  return res.json(await calculatePayroll(req.user, req.query));
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

module.exports = { bulk, history, list, mark, parse, parseMonth, payroll, register };