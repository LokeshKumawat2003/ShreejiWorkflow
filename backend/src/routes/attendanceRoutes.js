const express = require('express');
const multer = require('multer');
const { bulk, history, list, mark, parse, parseMonth, payroll, register, wageRegister } = require('../controllers/attendanceController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { httpError } = require('../utils/httpError');

const router = express.Router();
const allowedSheetTypes = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/octet-stream',
]);
const allowedSheetNames = /\.(pdf|xlsx|xls|csv|png|jpe?g|webp)$/i;

const uploadAttendanceSheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    const hasAllowedType = allowedSheetTypes.has(file.mimetype);
    const hasAllowedName = allowedSheetNames.test(file.originalname || '');
    if (!hasAllowedType && !hasAllowedName) {
      return callback(httpError(400, 'Upload a PDF, Excel, CSV, or image attendance sheet.'));
    }
    return callback(null, true);
  },
});

function parseAttendanceUpload(req, res, next) {
  uploadAttendanceSheet.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.statusCode) return next(error);
    if (error.code === 'LIMIT_FILE_SIZE') return next(httpError(413, 'Attendance sheet must be 8 MB or smaller.'));
    return next(httpError(400, 'Unable to read the attendance sheet.'));
  });
}

router.use(requireAuth, requireRole('admin', 'organization'));
router.get('/history', history);
router.get('/payroll', payroll);
router.get('/wage-register', wageRegister);
router.get('/register', requireRole('admin'), register);
router.post('/parse', requireRole('admin'), parseAttendanceUpload, parse);
router.post('/parse-month', requireRole('admin'), parseAttendanceUpload, parseMonth);
router.post('/bulk', requireRole('admin'), bulk);
router.get('/', list);
router.put('/', mark);

module.exports = router;
