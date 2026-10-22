const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getCompanyProfile, updateCompanyProfile } = require('../services/companyProfileService');
const { httpError } = require('../utils/httpError');

const router = express.Router();

function requireDatabase(req, res, next) {
	if (mongoose.connection.readyState !== 1) {
		return next(httpError(503, 'The database is not available.'));
	}
	return next();
}

router.use(requireAuth, requireRole('admin', 'organization'), requireDatabase);
router.get('/company', async (req, res) => res.json({ company: await getCompanyProfile() }));
router.put('/company', requireRole('admin'), async (req, res) => (
	res.json({ company: await updateCompanyProfile(req.user, req.body || {}) })
));

module.exports = router;
