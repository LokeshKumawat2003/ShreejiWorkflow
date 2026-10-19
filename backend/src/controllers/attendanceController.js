const { listAttendance, listAttendanceHistory, markAttendance } = require('../services/attendanceService');
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

module.exports = { history, list, mark, payroll };