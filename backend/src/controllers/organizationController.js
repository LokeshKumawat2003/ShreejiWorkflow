const {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
} = require('../services/organizationService');

async function list(req, res) {
  const result = await listOrganizations({
    search: req.query.search,
    status: req.query.status,
    sort: req.query.sort,
    page: req.query.page,
    limit: req.query.limit,
  });
  return res.json(result);
}

async function create(req, res) {
  const result = await createOrganization(req.body || {});
  return res.status(201).json(result);
}

async function get(req, res) {
  const organization = await getOrganization(req.params.id);
  return res.json({ organization });
}

async function remove(req, res) {
  const organization = await deleteOrganization(req.params.id);
  return res.json({ organization });
}

async function update(req, res) {
  const organization = await updateOrganization(req.params.id, req.body || {});
  return res.json({ organization });
}

module.exports = { create, get, list, remove, update };