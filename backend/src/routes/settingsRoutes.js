const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getDocumentSettings, updateDocumentSettings } = require('../services/documentSettingsService');
const { httpError } = require('../utils/httpError');

const router = express.Router();

function requireDatabase(req, res, next) {
	if (mongoose.connection.readyState !== 1) {
		return next(httpError(503, 'The database is not available.'));
	}
	return next();
}

router.use(requireAuth, requireRole('admin', 'organization'), requireDatabase);
router.get('/documents/:type', async (req, res) => res.json({ settings: await getDocumentSettings(req.params.type) }));
router.put('/documents/:type', requireRole('admin'), async (req, res) => (
	res.json({ settings: await updateDocumentSettings(req.user, req.params.type, req.body || {}) })
));

module.exports = router;
