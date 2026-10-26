const {
  assignEmployees,
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  transferEmployees,
  unassignEmployees,
  updateEmployee,
} = require('../services/employeeService');
const { importEmployees } = require('../services/employeeImportService');
const { sendAppointmentLetterEmail, sendOrganizationAppointmentLettersEmail } = require('../services/appointmentLetterEmailService');

async function list(req, res) {
  return res.json(await listEmployees(req.user, req.query));
}

async function create(req, res) {
  const employee = await createEmployee(req.user, req.body || {});
  return res.status(201).json({ employee });
}

async function get(req, res) {
  const employee = await getEmployee(req.user, req.params.id);
  return res.json({ employee });
}

async function update(req, res) {
  const employee = await updateEmployee(req.user, req.params.id, req.body || {});
  return res.json({ employee });
}

async function importFile(req, res) {
  return res.json(await importEmployees(req.user, req.file, req.body || {}));
}

async function assign(req, res) {
  const employees = await assignEmployees(req.user, req.body || {});
  return res.json({ employees });
}

async function transfer(req, res) {
  const employees = await transferEmployees(req.user, req.body || {});
  return res.json({ employees });
}

async function unassign(req, res) {
  const employees = await unassignEmployees(req.user, req.body || {});
  return res.json({ employees });
}

async function remove(req, res) {
  const employee = await deleteEmployee(req.user, req.params.id);
  return res.json({ employee });
}

async function sendAppointmentLetter(req, res) {
  const result = await sendAppointmentLetterEmail(req.user, {
    employeeId: req.params.id,
    locationId: req.body.locationId,
    file: req.file,
  });
  return res.json(result);
}

async function sendOrganizationAppointmentLetters(req, res) {
  const result = await sendOrganizationAppointmentLettersEmail(req.user, {
    locationId: req.body.locationId,
    file: req.file,
  });
  return res.json(result);
}

module.exports = { assign, create, get, importFile, list, remove, sendAppointmentLetter, sendOrganizationAppointmentLetters, transfer, unassign, update };