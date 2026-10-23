const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadSignatureImage } = require('../services/cloudinaryService');
const { getDocumentSettings, updateDocumentSettings } = require('../services/documentSettingsService');
const { httpError } = require('../utils/httpError');

const router = express.Router();
const uploadSignature = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 2 * 1024 * 1024 },
	fileFilter(req, file, callback) {
		if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
			return callback(httpError(400, 'Signature must be a PNG or JPG image.'));
		}
		return callback(null, true);
	},
});

function parseSignature(req, res, next) {
	uploadSignature.single('signature')(req, res, (error) => {
		if (!error) return next();
		if (error.statusCode) return next(error);
		if (error.code === 'LIMIT_FILE_SIZE') return next(httpError(413, 'Signature image must be 2 MB or smaller.'));
		return next(httpError(400, 'Unable to read the signature image.'));
	});
}

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
router.post('/signature', requireRole('admin'), parseSignature, async (req, res) => {
	if (!req.file) throw httpError(400, 'Choose a signature image to upload.');
	res.status(201).json({ image: await uploadSignatureImage(req.file.buffer) });
});

module.exports = router;
