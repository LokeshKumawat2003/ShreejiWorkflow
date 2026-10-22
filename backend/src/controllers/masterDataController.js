const {
	createMasterData,
	deleteMasterData,
	listMasterData,
	updateMasterData,
} = require('../services/masterDataService');

async function list(req, res) {
	const result = await listMasterData(req.user, req.query);
	return res.json(Array.isArray(result) ? { items: result } : result);
}

async function create(req, res) {
	const item = await createMasterData(req.user, req.body || {});
	return res.status(201).json({ item });
}

async function update(req, res) {
	const item = await updateMasterData(req.user, req.params.id, req.body || {});
	return res.json({ item });
}

async function remove(req, res) {
	const item = await deleteMasterData(req.user, req.params.id);
	return res.json({ item });
}

module.exports = { create, list, remove, update };
