const express = require('express');
const multer = require('multer');
const { assign, create, get, importFile, list, remove, sendAppointmentLetter, sendOrganizationAppointmentLetters, transfer, unassign, update } = require('../controllers/employeeController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { httpError } = require('../utils/httpError');

const router = express.Router();
const uploadAppointmentLetter = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter(req, file, callback) {
		if (file.mimetype !== 'application/pdf') {
			return callback(httpError(400, 'Appointment letter must be a PDF.'));
		}
		return callback(null, true);
	},
});

function parseAppointmentLetter(req, res, next) {
	uploadAppointmentLetter.single('letter')(req, res, (error) => {
		if (!error) return next();
		if (error.statusCode) return next(error);
		if (error.code === 'LIMIT_FILE_SIZE') return next(httpError(413, 'Appointment letter PDF must be 5 MB or smaller.'));
		return next(httpError(400, 'Unable to read appointment letter PDF.'));
	});
}

const uploadEmployeeSheet = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter(req, file, callback) {
		if (!/\.(xlsx|xls|csv)$/i.test(file.originalname || '')) {
			return callback(httpError(400, 'Upload the employee Excel file (.xlsx, .xls or .csv).'));
		}
		return callback(null, true);
	},
});

function parseEmployeeSheet(req, res, next) {
	uploadEmployeeSheet.single('file')(req, res, (error) => {
		if (!error) return next();
		if (error.statusCode) return next(error);
		if (error.code === 'LIMIT_FILE_SIZE') return next(httpError(413, 'Employee Excel file must be 5 MB or smaller.'));
		return next(httpError(400, 'Unable to read the employee Excel file.'));
	});
}

router.use(requireAuth, requireRole('admin', 'organization'));
router.get('/', list);
router.post('/', create);
router.post('/import', requireRole('admin'), parseEmployeeSheet, importFile);
router.post('/assign', assign);
router.post('/unassign', unassign);
router.post('/transfer', requireRole('admin'), transfer);
router.post('/appointment-letters/organization', parseAppointmentLetter, sendOrganizationAppointmentLetters);
router.post('/:id/appointment-letter', parseAppointmentLetter, sendAppointmentLetter);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;