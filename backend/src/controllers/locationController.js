const { createLocation, deleteLocation, listLocations, updateLocation } = require('../services/locationService');

async function list(req, res) {
	return res.json(await listLocations(req.user, req.params.organizationId, req.query));
}

async function create(req, res) {
	const location = await createLocation(req.user, req.params.organizationId, req.body || {});
	return res.status(201).json({ location });
}

async function update(req, res) {
	const location = await updateLocation(req.user, req.params.organizationId, req.params.locationId, req.body || {});
	return res.json({ location });
}

async function remove(req, res) {
	const location = await deleteLocation(req.user, req.params.organizationId, req.params.locationId);
	return res.json({ location });
}

module.exports = { create, list, remove, update };
