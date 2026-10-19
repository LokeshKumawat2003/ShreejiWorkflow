const {
  assignEmployees,
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  unassignEmployees,
  updateEmployee,
} = require('../services/employeeService');

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

async function assign(req, res) {
  const employees = await assignEmployees(req.user, req.body || {});
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

module.exports = { assign, create, get, list, remove, unassign, update };